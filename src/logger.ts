type Listener = (line: string) => void;

const listeners = new Set<Listener>();
const buffer: string[] = [];
const BUFFER_SIZE = 500;

export function log(message: string): void {
  console.log(message);
  buffer.push(message);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
  for (const fn of listeners) fn(message);
}

export function onLog(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLogBuffer(): string[] {
  return [...buffer];
}
