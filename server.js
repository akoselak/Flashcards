// A tiny web server with no dependencies. It serves index.html, style.css, and app.js
// from the same folder. Run it with: node server.js

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = __dirname; // the folder this file lives in

// Tells the browser what kind of file it is receiving
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  // "/" means the home page, so serve index.html
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT, requested);

  // Safety check: never serve anything outside this folder
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not found: " + urlPath);
    }
    const type = TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });

  console.log(req.method, req.url);
});

server.listen(PORT, () => {
  console.log(`Flashcards running at http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});
