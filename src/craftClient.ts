/** Thin HTTP client for the Craft Daily Notes API. */

import { readFile, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { basename, extname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Subset of `fetch` this client depends on; injectable for tests. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** Query parameters; `undefined` values are omitted from the URL. */
type Query = Record<string, string | number | boolean | undefined>;

/** Result of a file upload. */
export interface UploadResult {
  blockId: string;
  assetUrl: string;
  bytesSent: number;
  fileName: string;
}

/** Result of an asset download. */
export interface DownloadResult {
  localPath: string;
  bytesWritten: number;
  contentType: string;
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".zip": "application/zip",
};

/**
 * Guess a MIME type from a file path's extension.
 *
 * @param path File path or name.
 * @returns A known MIME type, or `application/octet-stream` as a fallback.
 */
export function guessContentType(path: string): string {
  return EXTENSION_CONTENT_TYPES[extname(path).toLowerCase()] ??
    "application/octet-stream";
}

/**
 * Client for the Craft Daily Notes API.
 *
 * Authentication is carried entirely by the token embedded in `baseUrl`, so no
 * headers are added for auth. File bytes are streamed directly between disk and
 * the API and are never returned to the caller, keeping large payloads out of
 * the LLM context.
 */
export class CraftClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  /**
   * @param baseUrl Craft API base URL with embedded token (no trailing slash).
   * @param fetchImpl `fetch` implementation to use (defaults to global fetch).
   */
  constructor(baseUrl: string, fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  /**
   * Build an absolute URL for an API path with optional query parameters.
   *
   * @param path Path beginning with `/`, e.g. `/blocks`.
   * @param query Query parameters; `undefined` entries are skipped.
   * @returns The fully-qualified request URL.
   */
  buildUrl(path: string, query: Query = {}): string {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  /**
   * Throw a descriptive error for a non-2xx response.
   *
   * @param res The failed response.
   * @throws Error Always; includes status and a truncated body snippet.
   */
  private async fail(res: Response): Promise<never> {
    let snippet = "";
    try {
      snippet = (await res.text()).slice(0, 500);
    } catch {
      // ignore body read errors
    }
    throw new Error(
      `Craft API request failed: ${res.status} ${res.statusText} - ${snippet}`,
    );
  }

  /**
   * Fetch connection metadata (space id/name/timezone/time).
   *
   * @returns The parsed connection info object.
   */
  async getConnection(): Promise<unknown> {
    const res = await this.fetchImpl(this.buildUrl("/connection"), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) await this.fail(res);
    return res.json();
  }

  /**
   * Fetch blocks from a daily note or a specific block id.
   *
   * @param opts Selection and rendering options. Provide `id` or `date`; if
   *   neither is given the caller should default `date` to "today".
   * @returns Markdown string when `format` is "markdown" (default), otherwise
   *   the parsed JSON block tree.
   */
  async getBlocks(opts: {
    id?: string;
    date?: string;
    maxDepth?: number;
    fetchMetadata?: boolean;
    format?: "markdown" | "json";
  }): Promise<unknown> {
    const accept = opts.format === "json"
      ? "application/json"
      : "text/markdown";
    const res = await this.fetchImpl(
      this.buildUrl("/blocks", {
        id: opts.id,
        date: opts.date,
        maxDepth: opts.maxDepth,
        fetchMetadata: opts.fetchMetadata,
      }),
      { headers: { Accept: accept } },
    );
    if (!res.ok) await this.fail(res);
    return accept === "application/json" ? res.json() : res.text();
  }

  /**
   * Upload a local file to Craft and insert it as a block.
   *
   * The file is read from disk and sent as the raw request body; its bytes are
   * never surfaced to the caller. Authentication relies on the token in the
   * base URL.
   *
   * @param opts Upload options. `localPath` is required; `position`/`date`/
   *   `siblingId` mirror the API; `contentType` is inferred when omitted.
   * @returns Block id, asset URL, bytes sent, and file name.
   */
  async uploadFile(opts: {
    localPath: string;
    position?: "start" | "end" | "before" | "after";
    date?: string;
    siblingId?: string;
    contentType?: string;
  }): Promise<UploadResult> {
    const data = await readFile(opts.localPath);
    const contentType = opts.contentType ?? guessContentType(opts.localPath);
    const res = await this.fetchImpl(
      this.buildUrl("/upload", {
        position: opts.position,
        date: opts.date,
        siblingId: opts.siblingId,
      }),
      {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: data,
      },
    );
    if (!res.ok) await this.fail(res);
    const body = (await res.json()) as { blockId: string; assetUrl: string };
    return {
      blockId: body.blockId,
      assetUrl: body.assetUrl,
      bytesSent: data.byteLength,
      fileName: basename(opts.localPath),
    };
  }

  /**
   * Download an asset URL to a local file.
   *
   * The response body is streamed straight to disk, so the bytes never pass
   * through the caller or the LLM context.
   *
   * @param opts `assetUrl` to fetch and `localPath` to write.
   * @returns The local path, bytes written, and reported content type.
   */
  async downloadAsset(opts: {
    assetUrl: string;
    localPath: string;
  }): Promise<DownloadResult> {
    const res = await this.fetchImpl(opts.assetUrl);
    if (!res.ok) await this.fail(res);
    if (!res.body) {
      throw new Error("Craft asset response had no body to download.");
    }
    const contentType = res.headers.get("content-type") ??
      "application/octet-stream";
    await pipeline(
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(opts.localPath),
    );
    const info = await stat(opts.localPath);
    return {
      localPath: opts.localPath,
      bytesWritten: info.size,
      contentType,
    };
  }
}
