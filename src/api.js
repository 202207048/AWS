import { createTemplateVerdict } from './verdict.js'

async function postJson(path, body) {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()

    if (!response.ok) {
      return { ok: false, reason: data?.reason ?? 'error' }
    }

    return data
  } catch {
    return { ok: false, reason: 'error' }
  }
}

function isVerdict(value) {
  return Boolean(
    value &&
    typeof value.order === 'string' &&
    typeof value.reason === 'string' &&
    typeof value.sentence === 'string',
  )
}

function templateResponse(purpose, ranked) {
  const winner = ranked?.[0]
  if (!winner) return { ok: false, reason: 'error' }

  return {
    ok: true,
    source: 'template',
    verdict: createTemplateVerdict(winner, purpose),
  }
}

export async function requestVerdict({ purpose, participants, ranked }) {
  const response = await postJson('/api/verdict', { purpose, participants, ranked })

  if (response.ok === true && response.source === 'claude' && isVerdict(response.verdict)) {
    return response
  }

  return templateResponse(purpose, ranked)
}

export function requestExtract({ chat }) {
  return postJson('/api/extract', { chat })
}
