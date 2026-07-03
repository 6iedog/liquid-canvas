import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PORT = 3000
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
}

const server = http.createServer((req, res) => {
  const url = req.url === "/" ? "/e2e/index.html" : req.url
  let filePath = path.resolve(ROOT, url.slice(1))

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }

  const ext = path.extname(filePath)
  const contentType = MIME[ext] || "application/octet-stream"

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end("Not found")
      return
    }
    res.writeHead(200, { "Content-Type": contentType })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`)
})
