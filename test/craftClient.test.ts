import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CraftClient, guessContentType } from "../src/craftClient.js";

const BASE = "https://connect.craft.do/links/TESTTOKEN/api/v1";

/** Build a mock fetch that records its calls and returns the given response. */
function mockFetch(response: Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response;
  });
  return { fn, calls };
}

const tmpDirs: string[] = [];
async function tmpDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "craft-mcp-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe("guessContentType", () => {
  it("maps known extensions", () => {
    expect(guessContentType("/a/b/photo.PNG")).toBe("image/png");
    expect(guessContentType("doc.pdf")).toBe("application/pdf");
  });
  it("falls back to octet-stream", () => {
    expect(guessContentType("mystery.xyz")).toBe("application/octet-stream");
  });
});

describe("buildUrl", () => {
  const client = new CraftClient(BASE, mockFetch(new Response("")).fn);
  it("appends path and omits undefined query params", () => {
    const url = client.buildUrl("/blocks", {
      id: "ABC",
      date: undefined,
      maxDepth: 0,
    });
    expect(url).toBe(`${BASE}/blocks?id=ABC&maxDepth=0`);
  });
  it("tolerates a trailing slash on the base URL", () => {
    const c = new CraftClient(`${BASE}/`, mockFetch(new Response("")).fn);
    expect(c.buildUrl("/connection")).toBe(`${BASE}/connection`);
  });
});

describe("getConnection", () => {
  it("GETs /connection with JSON Accept and parses the body", async () => {
    const { fn, calls } = mockFetch(
      new Response(JSON.stringify({ space: { id: "S1" } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await new CraftClient(BASE, fn).getConnection();
    expect(calls[0].url).toBe(`${BASE}/connection`);
    expect((calls[0].init?.headers as Record<string, string>).Accept).toBe(
      "application/json",
    );
    expect(result).toEqual({ space: { id: "S1" } });
  });
});

describe("getBlocks", () => {
  it("requests markdown by default and returns text", async () => {
    const { fn, calls } = mockFetch(new Response("# Today"));
    const out = await new CraftClient(BASE, fn).getBlocks({ date: "today" });
    expect(calls[0].url).toBe(`${BASE}/blocks?date=today`);
    expect((calls[0].init?.headers as Record<string, string>).Accept).toBe(
      "text/markdown",
    );
    expect(out).toBe("# Today");
  });
  it("requests JSON when format=json", async () => {
    const { fn, calls } = mockFetch(
      new Response(JSON.stringify({ id: "B1" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const out = await new CraftClient(BASE, fn).getBlocks({
      id: "B1",
      format: "json",
    });
    expect((calls[0].init?.headers as Record<string, string>).Accept).toBe(
      "application/json",
    );
    expect(out).toEqual({ id: "B1" });
  });
});

describe("uploadFile", () => {
  it("POSTs raw bytes with query params and merges metadata", async () => {
    const dir = await tmpDir();
    const file = join(dir, "hello.png");
    await writeFile(file, Buffer.from("PNGDATA"));
    const { fn, calls } = mockFetch(
      new Response(JSON.stringify({ blockId: "BLK", assetUrl: "https://x/y" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await new CraftClient(BASE, fn).uploadFile({
      localPath: file,
      position: "end",
      date: "today",
    });
    expect(calls[0].url).toBe(`${BASE}/upload?position=end&date=today`);
    expect(calls[0].init?.method).toBe("POST");
    expect(
      (calls[0].init?.headers as Record<string, string>)["Content-Type"],
    ).toBe("image/png");
    expect(result).toEqual({
      blockId: "BLK",
      assetUrl: "https://x/y",
      bytesSent: 7,
      fileName: "hello.png",
    });
  });
});

describe("downloadAsset", () => {
  it("streams the response body to disk and reports size", async () => {
    const dir = await tmpDir();
    const out = join(dir, "out.bin");
    const { fn } = mockFetch(
      new Response(Buffer.from("DOWNLOADED-BYTES"), {
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    const result = await new CraftClient(BASE, fn).downloadAsset({
      assetUrl: "https://assets/abc",
      localPath: out,
    });
    expect(result.bytesWritten).toBe("DOWNLOADED-BYTES".length);
    expect(result.contentType).toBe("application/octet-stream");
    expect((await readFile(out)).toString()).toBe("DOWNLOADED-BYTES");
  });
});

describe("error handling", () => {
  it("throws with status and body snippet on non-2xx", async () => {
    const { fn } = mockFetch(
      new Response("nope", { status: 404, statusText: "Not Found" }),
    );
    await expect(
      new CraftClient(BASE, fn).getConnection(),
    ).rejects.toThrow(/404 Not Found - nope/);
  });
});
