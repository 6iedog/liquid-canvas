import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const port = parseInt(process.argv[2], 10) || 3000

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".map": "application/json",
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  let filePath = path.join(root, url.pathname === "/" ? "/test/index.html" : url.pathname)

  // Security: prevent directory traversal
  if (!filePath.startsWith(root)) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }

  const ext = path.extname(filePath)
  const contentType = MIME[ext] || "application/octet-stream"

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404)
        res.end("Not found")
      } else {
        res.writeHead(500)
        res.end("Server error")
      }
      return
    }
    res.writeHead(200, { "Content-Type": contentType })
    res.end(data)
  })
})

server.listen(port, () => {
  const url = `http://localhost:${port}/test/index.html`
  console.log(`\n  🧪 Liquid Canvas Test Page`)
  console.log(`  ─────────────────────────`)
  console.log(`  ${url}\n`)
  console.log(`  Press Ctrl+C to stop\n`)

  // Auto-open browser
  const platform = process.platform
  const cmd = platform === "win32" ? "start" : platform === "darwin" ? "open" : "xdg-open"
  import("child_process").then(({ execSync }) => {
    try { execSync(`${cmd} ${url}`) } catch { /* ignore */ }
  }).catch(() => { /* ignore */ })
})
