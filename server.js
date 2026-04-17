import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createReportService } from "./lib/report-service.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const service = createReportService();
const PORT = Number(process.env.PORT || 3000);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/search" && req.method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      const results = await service.search(q);
      return sendJson(res, 200, { results });
    }

    if (url.pathname.startsWith("/api/report/") && req.method === "GET") {
      const ticker = url.pathname.split("/").pop();
      const report = await service.getReport(ticker);
      if (!report) {
        return sendJson(res, 404, { error: "종목을 찾을 수 없습니다." });
      }
      return sendJson(res, 200, report);
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: "서버 오류가 발생했습니다.", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Stock report app listening on http://localhost:${PORT}`);
});

async function serveStatic(pathname, res) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  const file = await readFile(filePath);
  const type = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  res.end(file);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": CONTENT_TYPES[".json"] });
  res.end(JSON.stringify(payload));
}
