import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createPlacesService } from './places.js'
import { createService } from './service.js'

const SERVER_DIR = dirname(fileURLToPath(import.meta.url))
export const PLACES_CACHE_PATH = resolve(SERVER_DIR, 'data', 'places-cache.json')

export function loadPlacesCache(path = PLACES_CACHE_PATH) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

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

export function createApiServer({ apiKey, kakaoKey, placesCache, fetchImpl } = {}) {
  const service = createService({ apiKey })
  const getPlaces = createPlacesService({ kakaoKey, cache: placesCache, fetchImpl })

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const pathname = url.pathname

    if (pathname === '/api/places') {
      if (request.method !== 'GET') {
        sendJson(response, 405, { ok: false, reason: 'error' })
        return
      }
      const result = await getPlaces({
        station: url.searchParams.get('station'),
        category: url.searchParams.get('category'),
      })
      sendJson(response, 200, result)
      return
    }

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

  const server = createApiServer({
    apiKey: process.env.ANTHROPIC_API_KEY,
    kakaoKey: process.env.KAKAO_REST_API_KEY,
    placesCache: loadPlacesCache(),
  })
  server.listen(port, host, () => {
    console.log(`API server listening on http://${host}:${port}`)
  })

  return server
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (entryPath === import.meta.url) {
  startApiServer()
}
