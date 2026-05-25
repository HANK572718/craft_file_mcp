/** Registers the `craft_upload_file` tool. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CraftClient } from "../craftClient.js";
import { fail, ok } from "./helpers.js";

/**
 * Register the file-upload tool on the given server.
 *
 * The tool reads a local file and uploads it to Craft as a block. File bytes
 * are sent straight from disk to the API; only the small result (block id,
 * asset URL, size) is returned to the model.
 *
 * @param server The MCP server to register on.
 * @param client The Craft API client to delegate to.
 */
export function registerUploadFile(
  server: McpServer,
  client: CraftClient,
): void {
  server.registerTool(
    "craft_upload_file",
    {
      title: "Upload a file to Craft",
      description:
        "Upload a local file (image/video/document) to Craft and insert it as " +
        "a block in a daily note. The file is read from disk and streamed to " +
        "the API; its bytes never pass through the conversation. Returns the " +
        "created blockId and a downloadable assetUrl.",
      inputSchema: {
        localPath: z
          .string()
          .describe("Absolute path to the local file to upload."),
        position: z
          .enum(["start", "end", "before", "after"])
          .optional()
          .describe(
            "Where to insert. start/end target the daily note; before/after " +
              "target a sibling (requires siblingId). Defaults to end.",
          ),
        date: z
          .string()
          .optional()
          .describe(
            "Daily note date: today/yesterday/tomorrow or YYYY-MM-DD. " +
              "Defaults to today.",
          ),
        siblingId: z
          .string()
          .optional()
          .describe("Block id to insert relative to; required for before/after."),
        contentType: z
          .string()
          .optional()
          .describe("MIME type override; inferred from the extension if omitted."),
      },
    },
    async (args) => {
      try {
        return ok(await client.uploadFile(args));
      } catch (err) {
        return fail(err);
      }
    },
  );
}
