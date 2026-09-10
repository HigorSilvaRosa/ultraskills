/**
 * Minimal static server for the storyplay smoke tests.
 *   node .smoke/serve.mjs [port]
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.argv[2] ?? 4173)
const root = join(fileURLToPath(new URL('.', import.meta.url)), 'site')
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' }

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  const file = join(root, relative === '' ? 'index.html' : relative)
  try {
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' })
    response.end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`smoke server: http://127.0.0.1:${port}`)
})
