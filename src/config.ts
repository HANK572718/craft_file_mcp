/** Configuration loading for the Craft MCP server. */

/** Resolved configuration for talking to the Craft API. */
export interface CraftConfig {
  /** Craft API base URL, e.g. https://connect.craft.do/links/XXXX/api/v1 (token embedded). */
  baseUrl: string;
}

/**
 * Load and validate configuration from environment variables.
 *
 * Reads `CRAFT_API_BASE_URL`, trims it, and strips any trailing slashes so
 * endpoint paths can be appended cleanly. Throws if the variable is missing
 * or obviously malformed, since every request depends on it.
 *
 * @param env Environment map to read from (defaults to `process.env`).
 * @returns The validated {@link CraftConfig}.
 * @throws Error If `CRAFT_API_BASE_URL` is unset or not an http(s) URL.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): CraftConfig {
  const raw = env.CRAFT_API_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "CRAFT_API_BASE_URL is not set. Copy your API URL from the Craft app " +
        "(Imagine tab -> Settings -> API) and set it as the CRAFT_API_BASE_URL " +
        "environment variable.",
    );
  }
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(
      `CRAFT_API_BASE_URL must be an http(s) URL, got: ${raw}`,
    );
  }
  return { baseUrl: raw.replace(/\/+$/, "") };
}
