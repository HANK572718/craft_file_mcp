#!/usr/bin/env node
/**
 * End-to-end smoke test against a real Craft API URL.
 *
 * Usage:
 *   CRAFT_API_BASE_URL="https://connect.craft.do/links/XXXX/api/v1" \
 *     node scripts/smoke.mjs
 *
 * Steps: connection info -> upload a tiny PNG -> download it back ->
 * compare bytes -> read today's daily note. Run `npm run build` first.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../dist/config.js";
import { CraftClient } from "../dist/craftClient.js";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const { baseUrl } = loadConfig();
const client = new CraftClient(baseUrl);
const dir = await mkdtemp(join(tmpdir(), "craft-smoke-"));

console.log("1) connection info");
const conn = await client.getConnection();
console.log("   space:", JSON.stringify(conn.space ?? conn));

console.log("2) upload 1x1 PNG to today's daily note");
const src = join(dir, "smoke-1x1.png");
await writeFile(src, PNG_1X1);
const up = await client.uploadFile({ localPath: src, position: "end" });
console.log("   ->", JSON.stringify(up));

console.log("3) download the asset back");
const dst = join(dir, "downloaded.png");
const down = await client.downloadAsset({ assetUrl: up.assetUrl, localPath: dst });
console.log("   ->", JSON.stringify(down));

console.log("4) compare bytes");
const got = await readFile(dst);
const srcHash = sha256(PNG_1X1);
const gotHash = sha256(got);
console.log(`   src sha256 = ${srcHash}`);
console.log(`   got sha256 = ${gotHash}`);
const match = srcHash === gotHash;
console.log(`   match: ${match}`);

console.log("5) read today's daily note (markdown, first 300 chars)");
const md = await client.getBlocks({ date: "today", format: "markdown" });
console.log("   " + String(md).slice(0, 300).replace(/\n/g, "\n   "));

console.log(`\nSMOKE ${match ? "PASS" : "FAIL"} (uploaded blockId=${up.blockId})`);
process.exit(match ? 0 : 1);
