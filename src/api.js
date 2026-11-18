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

export async function requestVerdict({ purpose, mode = 'fair', participants, ranked }) {
  const response = await postJson('/api/verdict', { purpose, mode, participants, ranked })

  if (response.ok === true && response.source === 'claude' && isVerdict(response.verdict)) {
    return response
  }

  return templateResponse(purpose, ranked)
}

export function requestExtract({ chat }) {
  return postJson('/api/extract', { chat })
}

const EXTRACT_ERROR_MESSAGES = {
  too_long: '대화가 너무 길어요. 일부만 붙여넣어 주세요.',
  no_key: 'AI 키가 없어 직접 선택해 주세요.',
}

// /api/extract 실패 이유를 화면에 보여 줄 짧은 안내로 바꾼다.
export function extractErrorMessage(reason) {
  return EXTRACT_ERROR_MESSAGES[reason] ?? '대화를 정리하지 못했어요. 직접 선택해 주세요.'
}
