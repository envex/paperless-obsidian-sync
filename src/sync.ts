import { PaperlessClient } from "./paperless.ts";
import { LiveSyncWriter } from "./livesync.ts";
import { cleanupContent } from "./cleanup.ts";
import { log } from "./logger.ts";

function sanitizePath(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-").trim();
}

export async function runSync(
  paperless: PaperlessClient,
  livesync: LiveSyncWriter,
  syncTags: string[] = []
): Promise<void> {
  log(`[${new Date().toISOString()}] Starting sync...`);
  if (syncTags.length > 0) log(`  Tag filter: ${syncTags.join(", ")}`);

  await livesync.ensureDatabase();

  const [tags, lastSync] = await Promise.all([paperless.getTags(), livesync.getLastSync()]);

  if (lastSync) log(`  Last sync: ${lastSync.toISOString()}`);

  const allDocuments = await paperless.getDocuments(lastSync ?? undefined);

  let documents = allDocuments;
  if (syncTags.length > 0) {
    const normalised = syncTags.map((t) => t.toLowerCase());
    const filterIds = new Set(
      [...tags.entries()].filter(([, name]) => normalised.includes(name.toLowerCase())).map(([id]) => id)
    );
    documents = allDocuments.filter((doc) => doc.tags.some((id) => filterIds.has(id)));
  }

  log(`  Documents to sync: ${documents.length}${syncTags.length > 0 ? ` (of ${allDocuments.length} total)` : ""}`);

  let synced = 0;
  let failed = 0;

  for (const doc of documents) {
    try {
      const primaryTagId = doc.tags[0];
      const tagName = primaryTagId !== undefined ? (tags.get(primaryTagId) ?? "Untagged") : "Untagged";
      const folder = sanitizePath(tagName);
      const title = sanitizePath(doc.title);
      const obsidianPath = `Paperless/${folder}/${title}.md`;

      const content = await cleanupContent(doc.content);
      await livesync.writeFile(obsidianPath, content);
      synced++;
    } catch (err) {
      log(`  Failed to sync doc ${doc.id} "${doc.title}": ${err}`);
      failed++;
    }
  }

  await livesync.setLastSync(new Date());
  log(`  Synced: ${synced}`);

  if (failed > 0) {
    log(`  Failed: ${failed}`);
  }
}
