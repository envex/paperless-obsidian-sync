import { createServer } from "http";
import { onLog, getLogBuffer } from "./logger.ts";

function html(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paperless Sync</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen p-6 font-mono text-sm">
  <div class="max-w-3xl mx-auto space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-base font-semibold text-white">Paperless Sync</h1>
        <span id="status" class="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">idle</span>
      </div>
      <button id="btn"
        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md text-xs font-medium transition-colors">
        Force Resync
      </button>
    </div>
    <div id="log" class="bg-gray-900 border border-gray-800 rounded-lg p-4 h-[calc(100vh-7rem)] overflow-y-auto space-y-px"></div>
  </div>
  <script>
    const logEl = document.getElementById('log');
    const btn = document.getElementById('btn');
    const status = document.getElementById('status');
    let syncing = false;

    function addLine(text) {
      const el = document.createElement('div');
      el.className = 'leading-5 ' + (
        /failed|error/i.test(text) ? 'text-red-400' :
        /starting sync/i.test(text) ? 'text-blue-400 pt-2 first:pt-0' :
        /done\\./i.test(text) ? 'text-green-400' :
        /ai ocr|cleanup|enabled/i.test(text) ? 'text-yellow-400' :
        'text-gray-400'
      );
      el.textContent = text;
      logEl.appendChild(el);
      logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(text, colour) {
      status.textContent = text;
      status.className = 'text-xs px-2 py-0.5 rounded-full ' + colour;
    }

    const es = new EventSource('/events');
    es.onmessage = (e) => {
      const line = JSON.parse(e.data);
      addLine(line);
      if (/starting sync/i.test(line)) setStatus('syncing', 'bg-blue-900 text-blue-300');
      if (/done\\./i.test(line)) { setStatus('idle', 'bg-gray-800 text-gray-400'); syncing = false; btn.disabled = false; btn.textContent = 'Force Resync'; }
    };
    es.onerror = () => setStatus('disconnected', 'bg-red-900 text-red-300');

    btn.addEventListener('click', async () => {
      if (syncing) return;
      syncing = true;
      btn.disabled = true;
      btn.textContent = 'Syncing…';
      setStatus('syncing', 'bg-blue-900 text-blue-300');
      const res = await fetch('/resync', { method: 'POST' });
      if (res.status === 409) {
        syncing = false;
        btn.disabled = false;
        btn.textContent = 'Force Resync';
        setStatus('idle', 'bg-gray-800 text-gray-400');
      }
    });
  </script>
</body>
</html>`;
}

export function startServer(port: number, onResync: () => void): void {
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html());
    } else if (req.method === "GET" && req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      for (const line of getLogBuffer()) {
        res.write(`data: ${JSON.stringify(line)}\n\n`);
      }
      const unsub = onLog((line) => res.write(`data: ${JSON.stringify(line)}\n\n`));
      req.on("close", unsub);
    } else if (req.method === "POST" && req.url === "/resync") {
      onResync();
      res.writeHead(202);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`UI running at http://localhost:${port}`);
  });
}
