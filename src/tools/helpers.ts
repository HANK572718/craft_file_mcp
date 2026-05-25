/** Shared helpers for building MCP tool results. */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Build a successful tool result.
 *
 * Serialises `data` as pretty JSON for the text content and also exposes it as
 * `structuredContent` for clients that consume structured output.
 *
 * @param data Small JSON-serialisable payload (never raw file bytes).
 * @returns A {@link CallToolResult}.
 */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const result: CallToolResult = { content: [{ type: "text", text }] };
  if (typeof data === "object" && data !== null) {
    result.structuredContent = data as Record<string, unknown>;
  }
  return result;
}

/**
 * Build an error tool result from a thrown value.
 *
 * @param err The caught error or value.
 * @returns A {@link CallToolResult} with `isError` set.
 */
export function fail(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
