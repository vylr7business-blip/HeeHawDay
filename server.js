// Tiny static server for Railway: serves the game, the guide, and a small config endpoint. No dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json" };
const ROUTES = { "/": "/index.html", "/docs": "/docs.html", "/guide": "/docs.html", "/brand": "/brand.html" };

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);

  // The coin's contract address comes from the COIN_CA variable in Railway, so it can change without a redeploy of code.
  if (p === "/api/config") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ ca: (process.env.COIN_CA || "").trim() }));
  }

  p = ROUTES[p] || p;
  if (!path.extname(p)) p = "/index.html";
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}.git`)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => console.log(`HeeHawDay running on port ${PORT}`));
