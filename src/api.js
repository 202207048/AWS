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

export async function requestVerdict({ purpose, purposes, purposeNote, mode = 'fair', participants, ranked }) {
  const body = { purpose, mode, participants, ranked }
  if (Array.isArray(purposes) && purposes.length > 0) body.purposes = purposes.slice(0, 3)
  if (typeof purposeNote === 'string' && purposeNote.trim()) body.purposeNote = purposeNote.trim().slice(0, 80)
  const response = await postJson('/api/verdict', body)

  if (response.ok === true && response.source === 'claude' && isVerdict(response.verdict)) {
    return response
  }

  return templateResponse(purpose, ranked)
}

export function requestExtract({ chat }) {
  return postJson('/api/extract', { chat })
}

// 주소·장소 검색 (GET /api/geocode). 검색 버튼/Enter로만 부른다(입력할 때마다 부르지 않음). 예외를 던지지 않는다.
export async function requestGeocode(query) {
  const q = String(query ?? '').trim()
  if (!q) return { ok: false, reason: 'empty' }
  try {
    const response = await fetch(`/api/geocode?${new URLSearchParams({ q })}`)
    const data = await response.json()
    if (data?.ok === true && Array.isArray(data.results)) {
      return {
        ...data,
        results: data.results
          .filter((item) => item && typeof item.name === 'string' && Number.isFinite(item.lat) && Number.isFinite(item.lng))
          .slice(0, 8),
      }
    }
    return { ok: false, reason: typeof data?.reason === 'string' ? data.reason : 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

const EXTRACT_ERROR_MESSAGES = {
  too_long: '대화가 너무 길어요. 일부만 붙여넣어 주세요.',
  no_key: 'AI 키가 없어 직접 선택해 주세요.',
}

// /api/extract 실패 이유를 화면에 보여 줄 짧은 안내로 바꾼다.
export function extractErrorMessage(reason) {
  return EXTRACT_ERROR_MESSAGES[reason] ?? '대화를 정리하지 못했어요. 직접 선택해 주세요.'
}
