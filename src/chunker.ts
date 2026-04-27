import xxhashInit from "xxhash-wasm";

const MAX_CHUNK_SIZE = 1000;
const MIN_CHUNK_SIZE = 100;
const MAX_CHUNKS = 100;

let h64: (input: string) => bigint;

export async function initHasher() {
  const xx = await xxhashInit();
  h64 = xx.h64;
}

export function hashChunk(content: string): string {
  return `h:${h64(`${content}-${content.length}`).toString(36)}`;
}

export function splitIntoChunks(content: string): string[] {
  let minSize = MIN_CHUNK_SIZE;
  while (content.length / minSize > MAX_CHUNKS) {
    minSize += MIN_CHUNK_SIZE;
  }

  const chunks: string[] = [];
  const lines = content.split("\n");
  let buf = "";

  for (let i = 0; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    buf += lines[i] + (isLast ? "" : "\n");

    if (buf.length > minSize || isLast) {
      while (buf.length > MAX_CHUNK_SIZE) {
        chunks.push(buf.substring(0, MAX_CHUNK_SIZE));
        buf = buf.substring(MAX_CHUNK_SIZE);
      }
      if (buf.length > 0) {
        chunks.push(buf);
        buf = "";
      }
    }
  }

  return chunks.filter((c) => c.length > 0);
}
