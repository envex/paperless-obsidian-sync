import { PaperlessClient } from "./paperless.ts";
import { LiveSyncWriter } from "./livesync.ts";
import { cleanupContent } from "./cleanup.ts";

function sanitizePath(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-").trim();
}

export async function runSync(paperless: PaperlessClient, livesync: LiveSyncWriter): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting sync...`);

  const [tags, lastSync] = await Promise.all([paperless.getTags(), livesync.getLastSync()]);

  if (lastSync) console.log(`  Last sync: ${lastSync.toISOString()}`);

  const documents = await paperless.getDocuments(lastSync ?? undefined);
  console.log(`  Documents to sync: ${documents.length}`);

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
      console.error(`  Failed to sync doc ${doc.id} "${doc.title}":`, err);
      failed++;
    }
  }

  await livesync.setLastSync(new Date());
  console.log(`  Done. Synced: ${synced}, Failed: ${failed}`);
}
