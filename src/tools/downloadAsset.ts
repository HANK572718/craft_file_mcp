/** Registers the `craft_download_asset` tool. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CraftClient } from "../craftClient.js";
import { fail, ok } from "./helpers.js";

/**
 * Register the asset-download tool on the given server.
 *
 * The tool fetches a Craft asset URL and streams it to a local path. Bytes go
 * straight to disk; only the resulting path and size are returned.
 *
 * @param server The MCP server to register on.
 * @param client The Craft API client to delegate to.
 */
export function registerDownloadAsset(
  server: McpServer,
  client: CraftClient,
): void {
  server.registerTool(
    "craft_download_asset",
    {
      title: "Download a Craft asset to disk",
      description:
        "Download a Craft asset (e.g. the assetUrl returned by craft_upload_file) " +
        "to a local file. The response is streamed directly to disk; its bytes " +
        "never pass through the conversation. Returns the local path and size.",
      inputSchema: {
        assetUrl: z
          .string()
          .url()
          .describe("The asset URL to download (from an upload result or block)."),
        localPath: z
          .string()
          .describe("Absolute path to write the downloaded file to."),
      },
    },
    async (args) => {
      try {
        return ok(await client.downloadAsset(args));
      } catch (err) {
        return fail(err);
      }
    },
  );
}
