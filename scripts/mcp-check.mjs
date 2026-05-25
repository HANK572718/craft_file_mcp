#!/usr/bin/env node
/**
 * Verify the built MCP server over stdio using the MCP client SDK.
 *
 * Spawns dist/index.js, lists tools, and calls craft_connection_info through
 * the JSON-RPC transport. Run `npm run build` first and set CRAFT_API_BASE_URL.
 *
 * Usage:
 *   CRAFT_API_BASE_URL="https://connect.craft.do/links/XXXX/api/v1" \
 *     node scripts/mcp-check.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env },
});
const client = new Client({ name: "mcp-check", version: "0.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).sort().join(", "));

const res = await client.callTool({
  name: "craft_connection_info",
  arguments: {},
});
const text = res.content?.[0]?.text ?? "";
console.log("craft_connection_info ->", text.slice(0, 200));
console.log("isError:", res.isError === true);

await client.close();
const okTools = tools.length === 4;
const okCall = !res.isError && text.includes("space");
console.log(`\nMCP-CHECK ${okTools && okCall ? "PASS" : "FAIL"}`);
process.exit(okTools && okCall ? 0 : 1);
