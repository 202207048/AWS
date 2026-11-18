import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { pathToFileURL } from 'node:url'
import { createService } from './service.js'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8787
const MAX_BODY_BYTES = 1_000_000

const ROUTES = Object.freeze({
  '/api/verdict': 'verdict',
  '/api/extract': 'extract',
})

function sendJson(response, statusCode, body) {
  const json = JSON.stringify(body)

  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  })
  response.end(json)
}

async function readJson(request) {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of request) {
    totalBytes += chunk.length
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large')
      error.code = 'BODY_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks).toString('utf8')
  return body ? JSON.parse(body) : {}
}

export function createApiServer({ apiKey } = {}) {
  const service = createService({ apiKey })

  return createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    const serviceMethod = ROUTES[pathname]

    if (!serviceMethod) {
      sendJson(response, 404, { ok: false, reason: 'error' })
      return
    }

    if (request.method !== 'POST') {
      sendJson(response, 405, { ok: false, reason: 'error' })
      return
    }

    try {
      const payload = await readJson(request)
      const result = await service[serviceMethod](payload)
      sendJson(response, 200, result)
    } catch {
      sendJson(response, 400, { ok: false, reason: 'error' })
    }
  })
}

export function loadLocalEnv(envPath = resolve(process.cwd(), '.env')) {
  try {
    loadEnvFile(envPath)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export function startApiServer({
  host = DEFAULT_HOST,
  port = Number(process.env.PORT) || DEFAULT_PORT,
} = {}) {
  loadLocalEnv()

  const server = createApiServer({ apiKey: process.env.ANTHROPIC_API_KEY })
  server.listen(port, host, () => {
    console.log(`API server listening on http://${host}:${port}`)
  })

  return server
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (entryPath === import.meta.url) {
  startApiServer()
}
