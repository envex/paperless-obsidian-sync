# paperless-sync

Syncs documents from [Paperless-NGX](https://docs.paperless-ngx.com/) into [Obsidian](https://obsidian.md/) via [LiveSync](https://github.com/vrtmrz/obsidian-livesync), writing directly to the CouchDB database.

Documents are organised into folders by their primary tag:

```
Paperless/
  Finance/
    Invoice January 2025.md
  Medical/
    Blood Test Results.md
  Untagged/
    Some Document.md
```

## How it works

1. Fetches documents from Paperless-NGX via its REST API
2. Optionally cleans up OCR artifacts using Claude Haiku (when `ANTHROPIC_API_KEY` is set)
3. Writes each document to CouchDB using LiveSync's chunked storage format
4. Tracks the last sync timestamp in CouchDB so only modified documents are fetched on subsequent runs

## Requirements

- Paperless-NGX instance with API access
- Obsidian LiveSync CouchDB database
- Node 22+ (or Docker)

## Setup

Copy `.env.example` to `.env` and fill in your values:

```env
PAPERLESS_URL=http://your-paperless-host:8777
PAPERLESS_TOKEN=your_api_token

COUCHDB_URL=http://your-couchdb-host
COUCHDB_DB=obsidian
COUCHDB_USER=your_user
COUCHDB_PASSWORD=your_password

SYNC_INTERVAL_MINUTES=60

# Optional: clean up OCR text with Claude Haiku before syncing
ANTHROPIC_API_KEY=
```

**Paperless token:** Settings → API Tokens in the Paperless-NGX UI.

**CouchDB credentials:** The same ones configured in the Obsidian LiveSync plugin.

## Running locally

```bash
pnpm install
pnpm dev
```

## Deploying with Docker

```bash
docker compose up -d
```

Or via [Dokploy](https://dokploy.com): point a new Docker Compose application at this repo and set the environment variables in the Dokploy UI.

## AI OCR cleanup (optional)

When `ANTHROPIC_API_KEY` is set, each document is passed through Claude Haiku before being written to Obsidian. It fixes common OCR artifacts — broken words, misread characters, garbled whitespace — without changing the content or meaning of the document.

The system prompt is cached, so the cost is minimal beyond the per-document input tokens.

## Type checking

```bash
pnpm typecheck
```
