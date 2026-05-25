# craft-file-mcp

An [MCP](https://modelcontextprotocol.io/) server for **uploading and downloading files to/from [Craft.do](https://www.craft.do/)** — without pushing file bytes through your LLM's context window.

![MCP server](https://img.shields.io/badge/MCP-server-blue)
![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-green)

## Why this exists

The official Craft connector returns content through the model's context. For images or
medium/large files that is expensive in tokens — and can blow past context limits entirely.

`craft-file-mcp` keeps **file bytes out of the conversation**. Each tool takes a *local
path* and returns a small JSON result; the bytes flow **disk ↔ Craft API directly**:

```
craft_upload_file(localPath) ──reads file──▶ POST /upload ──▶ { blockId, assetUrl }
craft_download_asset(assetUrl, localPath) ──GET asset──▶ streamed to disk ──▶ { bytesWritten }
```

The model only ever sees paths and small metadata, never base64 payloads. If you hit the
same "I want my agent to move real files in and out of Craft cheaply" problem, this is for you.

## Tools

| Tool | Purpose |
|------|---------|
| `craft_upload_file` | Upload a local file (image/video/document) into a daily note. Returns `blockId`, `assetUrl`, `bytesSent`. |
| `craft_download_asset` | Stream a Craft `assetUrl` to a local path. Returns `bytesWritten`, `contentType`. |
| `craft_get_daily_note` | Read a daily note (by date) or a block (by id) as markdown/JSON — e.g. to find a `siblingId` for positioning an upload. |
| `craft_connection_info` | Return space metadata; a quick check that the credential works. |

> Targets Craft's **Daily Notes** API scope. Uploads land in a daily note (by `date`,
> default today) or relative to a block (`siblingId` + `position`).

## Requirements

- **Node.js ≥ 18** (uses the global `fetch` and web-stream interop).
- A Craft API URL (see below). The Craft API is experimental and subject to change.

## Installation

```bash
git clone https://github.com/HANK572718/craft_file_mcp.git
cd craft_file_mcp
npm install
npm run build
```

### Get your Craft API URL

In the Craft app: **Imagine tab (sidebar) → Settings → API → copy the API URL**.
It looks like `https://connect.craft.do/links/XXXXXXXX/api/v1`.

> ⚠️ The access token is embedded in the URL path. **Treat the whole URL as a secret** —
> anyone with it can read and write your Craft space. Never commit it. If it leaks, rotate
> it from **Settings → API**.

## Configuration

Add the server to your MCP client. For **Claude Code** (`~/.claude.json`) or
**Claude Desktop** (`claude_desktop_config.json`):

```jsonc
{
  "mcpServers": {
    "craft-files": {
      "command": "node",
      "args": ["/absolute/path/to/craft_file_mcp/dist/index.js"],
      "env": {
        "CRAFT_API_BASE_URL": "https://connect.craft.do/links/XXXXXXXX/api/v1"
      }
    }
  }
}
```

> If your system `node` is older than 18, point `command` at a Node ≥ 18 binary directly,
> e.g. `"command": "/path/to/.nvm/versions/node/v20.x.y/bin/node"`.

You can also register it from the CLI:

```bash
claude mcp add -s user \
  -e CRAFT_API_BASE_URL=https://connect.craft.do/links/XXXXXXXX/api/v1 \
  craft-files -- node /absolute/path/to/craft_file_mcp/dist/index.js
```

## Usage examples

Once connected, ask your agent to:

- "Upload `/home/me/diagram.png` to my Craft daily note." → `craft_upload_file`
- "Download that Craft asset to `/home/me/out.png`." → `craft_download_asset`
- "Show today's daily note." → `craft_get_daily_note`

## Development

```bash
npm run dev        # run from source via tsx
npm test           # unit tests (mocked fetch)
npm run typecheck  # tsc --noEmit

# end-to-end against a real Craft URL (requires CRAFT_API_BASE_URL):
CRAFT_API_BASE_URL="https://connect.craft.do/links/XXXX/api/v1" node scripts/smoke.mjs
CRAFT_API_BASE_URL="https://connect.craft.do/links/XXXX/api/v1" node scripts/mcp-check.mjs

# inspect interactively:
npx @modelcontextprotocol/inspector node dist/index.js
```

## Project layout

```
src/
  index.ts          # entry: McpServer + stdio transport
  config.ts         # loads/validates CRAFT_API_BASE_URL
  craftClient.ts    # thin HTTP client (upload/download/getBlocks/getConnection)
  tools/            # one file per MCP tool
test/               # unit tests (mocked fetch)
scripts/            # smoke.mjs (client round trip), mcp-check.mjs (MCP protocol)
server.json         # MCP registry manifest
```

## Publishing (optional)

To make it installable via `npx` and discoverable in the
[MCP registry](https://registry.modelcontextprotocol.io/):

```bash
npm publish                 # publishes craft-file-mcp to npm
mcp-publisher publish       # publishes server.json to the MCP registry
```

## API notes

Authentication is carried entirely by the token in the URL path (the OpenAPI spec declares
no security schemes), so no auth headers are sent. There is no dedicated download endpoint —
downloads fetch the `assetUrl` returned by an upload directly.

## License

[Apache 2.0](./LICENSE) © HANK572718

Contributions are welcome — let's make this better together. By contributing you agree
your contributions are licensed under Apache 2.0.
