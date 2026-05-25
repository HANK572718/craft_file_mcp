/** Registers the `craft_get_daily_note` tool. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CraftClient } from "../craftClient.js";
import { fail, ok } from "./helpers.js";

/**
 * Register the daily-note reader tool on the given server.
 *
 * Minimal navigation helper: fetches a daily note (or a specific block) so a
 * caller can read content or find a `siblingId` to position an upload. Returns
 * markdown by default to keep output compact.
 *
 * @param server The MCP server to register on.
 * @param client The Craft API client to delegate to.
 */
export function registerGetDailyNote(
  server: McpServer,
  client: CraftClient,
): void {
  server.registerTool(
    "craft_get_daily_note",
    {
      title: "Read a Craft daily note",
      description:
        "Fetch blocks from a daily note (by date) or a specific block (by id). " +
        "Use it to read content or to find a block's id for positioning an " +
        "upload with before/after. Returns markdown by default.",
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe(
            "Daily note date: today/yesterday/tomorrow or YYYY-MM-DD. " +
              "Used when id is not given; defaults to today.",
          ),
        id: z
          .string()
          .optional()
          .describe("Fetch a specific block/page by id instead of by date."),
        maxDepth: z
          .number()
          .int()
          .optional()
          .describe("Max descendant depth to fetch. Default -1 (all)."),
        format: z
          .enum(["markdown", "json"])
          .optional()
          .describe("Output format. Defaults to markdown."),
      },
    },
    async (args) => {
      try {
        // The API needs an id or a date; default to today when neither is set.
        const date = args.id ? args.date : args.date ?? "today";
        const content = await client.getBlocks({ ...args, date });
        return ok(content);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
