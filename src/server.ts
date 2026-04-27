import { createServer, type IncomingMessage } from "http";
import { onLog, getLogBuffer } from "./logger.ts";

const LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="17" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>`;

const FAVICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="5.5" fill="#c678dd"/><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V9z" fill="rgba(255,255,255,0.2)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3v6h5.5" stroke="white" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M12 17v-5M9.5 14.5L12 12l2.5 2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

function html(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paperless Sync</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }

    :root {
      --red: #e06c75;
      --green: #98c379;
      --yellow: #d19a66;
      --blue: #61afef;
      --purple: #c678dd;
      --text: #abb2bf;
      --bg: #1e2127;
      --bg-nav: #21252b;
      --bg-card: #282c34;
      --border: rgba(255,255,255,0.06);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    nav {
      display: flex;
      align-items: center;
      padding: 1rem 2rem;
      background: var(--bg-nav);
      border-bottom: 1px solid var(--border);
      gap: 2.5rem;
      flex-shrink: 0;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--purple);
      border-radius: 8px;
      flex-shrink: 0;
    }

    .nav-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .status-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: rgba(255,255,255,0.3);
      white-space: nowrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
      transition: background 0.15s ease, color 0.15s ease;
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7);
    }

    .btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.9);
    }

    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .content {
      flex: 1;
      overflow: hidden;
      display: flex;
      padding: 1.25rem;
    }

    .card {
      position: relative;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      flex: 1;
      transition: border-color 0.2s ease;
    }

    .card:hover { border-color: rgba(255,255,255,0.1); }

    .card-scroll {
      overflow-y: auto;
      overflow-x: hidden;
      height: 100%;
      padding: 0 1.1rem 1.1rem;
      scrollbar-width: none;
    }

    .card-scroll::-webkit-scrollbar { display: none; }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.9rem 0;
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--bg-card);
      min-height: 58px;
    }

    .card-title-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    h2 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }

    .card-body {
      display: flex;
      flex-direction: column;
    }

    .log-line {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.78rem;
      line-height: 1.7;
      color: var(--text);
    }

    .log-line.group-start { margin-top: 0.6rem; }
    .log-line.group-start:first-child { margin-top: 0; }

    .fade-top, .fade-bottom {
      position: absolute;
      left: 0; right: 0;
      height: 56px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .fade-top {
      top: 0;
      background: linear-gradient(to top, transparent, var(--bg-card));
      border-radius: 16px 16px 0 0;
    }

    .fade-bottom {
      bottom: 0;
      background: linear-gradient(to bottom, transparent, var(--bg-card));
      border-radius: 0 0 16px 16px;
    }

    .fade-top.visible, .fade-bottom.visible { opacity: 1; }

    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    .pulsing { animation: pulse 1.5s ease-in-out infinite; }
  </style>
</head>
<body>
  <nav>
    <span class="logo">
      <span class="logo-icon">${LOGO_SVG}</span>
      Paperless Sync
    </span>
    <div class="nav-right">
      <span id="status" class="status-label">Idle</span>
      <button id="btn" class="btn">Force Resync</button>
    </div>
  </nav>

  <div class="content">
    <div class="card">
      <div class="card-scroll" id="scroll">
        <div class="card-header">
          <div class="card-title-row">
            <span class="dot" id="dot"></span>
            <h2>Activity</h2>
          </div>
        </div>
        <div class="card-body" id="log"></div>
      </div>
      <div class="fade-top" id="fade-top"></div>
      <div class="fade-bottom" id="fade-bottom"></div>
    </div>
  </div>

  <script>
    const logEl   = document.getElementById('log');
    const btn     = document.getElementById('btn');
    const dot     = document.getElementById('dot');
    const status  = document.getElementById('status');
    const scrollEl = document.getElementById('scroll');
    const fadeTop  = document.getElementById('fade-top');
    const fadeBot  = document.getElementById('fade-bottom');
    let syncing = false;

    function updateFade() {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      fadeTop.classList.toggle('visible', scrollTop > 4);
      fadeBot.classList.toggle('visible', scrollHeight > clientHeight && scrollTop + clientHeight < scrollHeight - 4);
    }
    scrollEl.addEventListener('scroll', updateFade);

    function setDot(color, pulse) {
      dot.style.background = color;
      dot.style.boxShadow = '0 0 6px 1px ' + color;
      dot.classList.toggle('pulsing', !!pulse);
    }

    function setIdle() {
      setDot('var(--green)', false);
      status.textContent = 'Idle';
      status.style.color = '';
      syncing = false;
      btn.disabled = false;
      btn.textContent = 'Force Resync';
    }

    function setSyncing() {
      setDot('var(--blue)', true);
      status.textContent = 'Syncing';
      status.style.color = 'var(--blue)';
    }

    function setDisconnected() {
      setDot('var(--red)', false);
      status.textContent = 'Disconnected';
      status.style.color = 'var(--red)';
    }

    // initialise to a dim dot until first event
    setDot('rgba(255,255,255,0.15)', false);

    function addLine(text) {
      const el = document.createElement('div');
      const isStart = /starting sync/i.test(text);
      el.className = 'log-line' + (isStart ? ' group-start' : '');
      const color =
        /failed|error/i.test(text)           ? 'var(--red)'    :
        isStart                              ? 'var(--blue)'   :
        /synced/i.test(text)                 ? 'var(--green)'  :
        /ai ocr|cleanup|enabled/i.test(text) ? 'var(--yellow)' :
        null;
      if (color) el.style.color = color;
      el.textContent = text;
      logEl.appendChild(el);
      scrollEl.scrollTop = scrollEl.scrollHeight;
      updateFade();
    }

    const es = new EventSource('/events');
    es.onopen = () => setIdle();
    es.onmessage = (e) => {
      const line = JSON.parse(e.data);
      addLine(line);
      if (/starting sync/i.test(line)) setSyncing();
      if (/synced/i.test(line)) setIdle();
    };
    es.onerror = () => setDisconnected();

    btn.addEventListener('click', async () => {
      if (syncing) return;
      syncing = true;
      btn.disabled = true;
      btn.textContent = 'Syncing...';
      setSyncing();
      const res = await fetch('/resync', { method: 'POST' });
      if (res.status === 409) setIdle();
    });
  </script>
</body>
</html>`;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function startServer(
  port: number,
  apiKey: string,
  onResync: () => void,
  onWrite: (path: string, content: string) => Promise<void>
): void {
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html());
    } else if (req.method === "GET" && req.url === "/favicon.svg") {
      res.writeHead(200, { "Content-Type": "image/svg+xml" });
      res.end(FAVICON_SVG);
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
    } else if (req.method === "POST" && req.url === "/write") {
      if (req.headers.authorization !== `Bearer ${apiKey}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }
      const { path, content } = body as Record<string, unknown>;
      if (typeof path !== "string" || !path || typeof content !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "path (string) and content (string) required" }));
        return;
      }
      try {
        await onWrite(path, content);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`UI running at http://localhost:${port}`);
  });
}
