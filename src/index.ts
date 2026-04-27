import { initHasher } from "./chunker.ts";
import { PaperlessClient } from "./paperless.ts";
import { LiveSyncWriter } from "./livesync.ts";
import { initCleanup } from "./cleanup.ts";
import { runSync } from "./sync.ts";
import { startServer } from "./server.ts";
import { log } from "./logger.ts";

const {
  PAPERLESS_URL,
  PAPERLESS_TOKEN,
  COUCHDB_URL,
  COUCHDB_DB = "obsidian",
  COUCHDB_USER,
  COUCHDB_PASSWORD,
  SYNC_INTERVAL_MINUTES = "60",
  ANTHROPIC_API_KEY,
  SYNC_TAGS = "",
  PORT = "3000",
} = process.env;

if (!PAPERLESS_URL || !PAPERLESS_TOKEN || !COUCHDB_URL || !COUCHDB_USER || !COUCHDB_PASSWORD) {
  console.error("Missing required environment variables. Check .env.example.");
  process.exit(1);
}

await initHasher();

if (ANTHROPIC_API_KEY) {
  initCleanup(ANTHROPIC_API_KEY);
  log("AI OCR cleanup enabled.");
}

const paperless = new PaperlessClient(PAPERLESS_URL, PAPERLESS_TOKEN);
const livesync = new LiveSyncWriter(COUCHDB_URL, COUCHDB_DB, COUCHDB_USER, COUCHDB_PASSWORD);
const syncTags = SYNC_TAGS.split(",").map((t) => t.trim()).filter(Boolean);

const intervalMs = parseInt(SYNC_INTERVAL_MINUTES) * 60 * 1000;

let syncing = false;

async function sync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    await runSync(paperless, livesync, syncTags);
  } finally {
    syncing = false;
  }
}

async function forceResync(): Promise<void> {
  if (syncing) return;
  await livesync.clearLastSync();
  sync();
}

startServer(parseInt(PORT), forceResync);

await sync();
setInterval(sync, intervalMs);
