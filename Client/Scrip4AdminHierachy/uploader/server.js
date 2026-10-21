import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { runUpload } from "./hierarchy-core.js";

// Local-only server: serves the uploader page and proxies Emojot API calls (avoids browser CORS).
// The token is only held in memory for the duration of a request and never logged.

const PORT = Number(process.env.PORT) || 4321;
const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const PAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "public", "index.html");

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

async function handleRun(req, res) {
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-store" });
  const send = event => res.write(`${JSON.stringify(event)}\n`);

  try {
    const body = await readJson(req);
    for await (const event of runUpload({ ...body, signal: controller.signal })) {
      if (controller.signal.aborted) break;
      send(event);
    }
  } catch (err) {
    if (!controller.signal.aborted) send({ type: "error", message: err.message });
  }
  res.end();
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    fs.createReadStream(PAGE).pipe(res);
  } else if (req.method === "POST" && req.url === "/api/run") {
    handleRun(req, res);
  } else {
    res.writeHead(404).end("Not found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Admin Hierarchy Uploader running at http://localhost:${PORT}`);
});
