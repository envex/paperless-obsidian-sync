import { hashChunk, splitIntoChunks } from "./chunker.ts";

interface LeafDoc {
  _id: string;
  type: "leaf";
  data: string;
}

interface FileDoc {
  _id: string;
  _rev?: string;
  path: string;
  type: "plain";
  children: string[];
  ctime: number;
  mtime: number;
  size: number;
  eden: Record<string, never>;
}

interface SyncState {
  _id: string;
  _rev?: string;
  lastSync: string;
}

export class LiveSyncWriter {
  private authHeader: string;
  private dbUrl: string;

  constructor(couchdbUrl: string, db: string, user: string, password: string) {
    this.authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
    this.dbUrl = `${couchdbUrl.replace(/\/$/, "")}/${db}`;
  }

  async writeFile(obsidianPath: string, content: string): Promise<void> {
    const chunks = splitIntoChunks(content);
    const chunkIds = chunks.map(hashChunk);

    await this.writeChunks(chunks, chunkIds);

    const docId = obsidianPath.toLowerCase();
    const existing = await this.getDoc<FileDoc>(docId);
    const now = Date.now();

    const fileDoc: FileDoc = {
      _id: docId,
      path: obsidianPath,
      type: "plain",
      children: chunkIds,
      ctime: existing?.ctime ?? now,
      mtime: now,
      size: Buffer.byteLength(content, "utf8"),
      eden: {},
    };

    if (existing?._rev) fileDoc._rev = existing._rev;

    await this.putDoc(fileDoc);
  }

  async getLastSync(): Promise<Date | null> {
    const doc = await this.getDoc<SyncState>("_local/paperless-sync");
    return doc ? new Date(doc.lastSync) : null;
  }

  async clearLastSync(): Promise<void> {
    const existing = await this.getDoc<SyncState>("_local/paperless-sync");
    if (!existing?._rev) return;
    const res = await fetch(
      `${this.dbUrl}/${encodeURIComponent("_local/paperless-sync")}?rev=${existing._rev}`,
      { method: "DELETE", headers: { Authorization: this.authHeader } }
    );
    if (!res.ok) throw new Error(`CouchDB DELETE failed: ${res.status}`);
  }

  async setLastSync(date: Date): Promise<void> {
    const existing = await this.getDoc<SyncState>("_local/paperless-sync");
    const doc: SyncState = {
      _id: "_local/paperless-sync",
      lastSync: date.toISOString(),
    };
    if (existing?._rev) doc._rev = existing._rev;
    await this.putDoc(doc);
  }

  private async writeChunks(chunks: string[], ids: string[]): Promise<void> {
    const docs: LeafDoc[] = chunks.map((data, i) => ({
      _id: ids[i],
      type: "leaf",
      data,
    }));

    const res = await fetch(`${this.dbUrl}/_bulk_docs`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ docs }),
    });

    if (!res.ok) throw new Error(`Bulk write failed: ${res.status}`);

    const results: { id: string; error?: string }[] = await res.json();
    const nonConflict = results.filter((r) => r.error && r.error !== "conflict");
    if (nonConflict.length > 0) {
      throw new Error(`Chunk write errors: ${nonConflict.map((r) => `${r.id}: ${r.error}`).join(", ")}`);
    }
  }

  private async getDoc<T extends { _rev?: string }>(id: string): Promise<T | null> {
    const res = await fetch(`${this.dbUrl}/${encodeURIComponent(id)}`, {
      headers: { Authorization: this.authHeader },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`CouchDB GET failed: ${res.status} ${id}`);
    return res.json();
  }

  private async putDoc(doc: object): Promise<void> {
    const id = (doc as { _id: string })._id;
    const res = await fetch(`${this.dbUrl}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(doc),
    });
    if (!res.ok) throw new Error(`CouchDB PUT failed: ${res.status} ${id}`);
  }
}
