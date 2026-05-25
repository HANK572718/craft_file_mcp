/** Registers the `craft_connection_info` tool. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CraftClient } from "../craftClient.js";
import { fail, ok } from "./helpers.js";

/**
 * Register the connection-info tool on the given server.
 *
 * Returns Craft space metadata (id, name, timezone, time). Handy as a quick
 * check that the configured API credential works.
 *
 * @param server The MCP server to register on.
 * @param client The Craft API client to delegate to.
 */
export function registerConnectionInfo(
  server: McpServer,
  client: CraftClient,
): void {
  server.registerTool(
    "craft_connection_info",
    {
      title: "Craft connection info",
      description:
        "Return Craft space metadata (id, name, timezone, current time). Use it " +
        "to verify the configured API credential is valid.",
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await client.getConnection());
      } catch (err) {
        return fail(err);
      }
    },
  );
}
