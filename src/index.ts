import { initHasher } from "./chunker.ts";
import { PaperlessClient } from "./paperless.ts";
import { LiveSyncWriter } from "./livesync.ts";
import { initCleanup } from "./cleanup.ts";
import { runSync } from "./sync.ts";

const {
  PAPERLESS_URL,
  PAPERLESS_TOKEN,
  COUCHDB_URL,
  COUCHDB_DB = "obsidian",
  COUCHDB_USER,
  COUCHDB_PASSWORD,
  SYNC_INTERVAL_MINUTES = "60",
  ANTHROPIC_API_KEY,
} = process.env;

if (!PAPERLESS_URL || !PAPERLESS_TOKEN || !COUCHDB_URL || !COUCHDB_USER || !COUCHDB_PASSWORD) {
  console.error("Missing required environment variables. Check .env.example.");
  process.exit(1);
}

await initHasher();

if (ANTHROPIC_API_KEY) {
  initCleanup(ANTHROPIC_API_KEY);
  console.log("AI OCR cleanup enabled.");
}

const paperless = new PaperlessClient(PAPERLESS_URL, PAPERLESS_TOKEN);
const livesync = new LiveSyncWriter(COUCHDB_URL, COUCHDB_DB, COUCHDB_USER, COUCHDB_PASSWORD);

const intervalMs = parseInt(SYNC_INTERVAL_MINUTES) * 60 * 1000;

await runSync(paperless, livesync);
setInterval(() => runSync(paperless, livesync), intervalMs);
