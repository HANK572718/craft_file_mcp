#!/usr/bin/env node
/** Entry point for the Craft file-transfer MCP server (stdio transport). */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { CraftClient } from "./craftClient.js";
import { registerUploadFile } from "./tools/uploadFile.js";
import { registerDownloadAsset } from "./tools/downloadAsset.js";
import { registerGetDailyNote } from "./tools/getDailyNote.js";
import { registerConnectionInfo } from "./tools/connectionInfo.js";

/**
 * Build the MCP server with all Craft tools registered.
 *
 * @param client The Craft API client the tools delegate to.
 * @returns A configured {@link McpServer} ready to connect to a transport.
 */
export function createServer(client: CraftClient): McpServer {
  const server = new McpServer({ name: "craft-files", version: "0.1.0" });
  registerConnectionInfo(server, client);
  registerGetDailyNote(server, client);
  registerUploadFile(server, client);
  registerDownloadAsset(server, client);
  return server;
}

/** Load config, build the server, and serve over stdio. */
async function main(): Promise<void> {
  const config = loadConfig();
  const client = new CraftClient(config.baseUrl);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logging must go to stderr; stdout is reserved for the JSON-RPC stream.
  console.error("craft-files MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting craft-files MCP server:", err);
  process.exit(1);
});
