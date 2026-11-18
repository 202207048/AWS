import { APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import * as z from 'zod'
import { STATIONS } from '../src/stations.js'
import { CLAUDE_MODEL } from './claude.js'

const MAX_TOKENS = 4000
const MAX_CHAT_CHARS = 4000
const MAX_PARTICIPANTS = 6
const STATION_NAMES = STATIONS.map((station) => station.name)
const PURPOSES = ['밥', '카페', '술', '공부']

const ExtractSchema = z.object({
  participants: z.array(
    z.object({
      name: z.string().describe('대화에 나온 사람 이름'),
      station: z.enum(STATION_NAMES).nullable().describe('후보역 목록 중 하나. 해당 역이 없으면 null'),
      hint: z.string().nullable().describe('station이 null일 때, 대화에 나온 출발지 표현. 아니면 null'),
    }),
  ),
  purpose: z.enum(PURPOSES).nullable().describe('약속 목적. 대화에 없으면 null'),
})

const EXTRACT_SYSTEM = [
  '너는 단톡방 대화에서 약속 참여자와 출발지를 정리하는 도우미다.',
  `후보역 목록: ${STATION_NAMES.join(', ')}`,
  '규칙:',
  '- 대화에 출발지가 나온 사람만 참여자로 넣는다. 처음 등장한 순서대로, 한 사람은 한 번만 넣는다.',
  '- 같은 사람이 출발지를 여러 번 말하면 마지막에 말한 출발지를 쓴다.',
  '- station에는 후보역 목록에 있는 이름만 그대로 쓴다. 회사·집이 그 역이라고 분명히 말한 경우도 그 역으로 쓴다.',
  '- 목록에 없는 지역이나 애매한 곳이면 station은 null, hint에 대화 속 표현(예: "일산")을 적는다. 비슷한 역을 추측해 넣지 않는다.',
  '- purpose는 밥/카페/술/공부 중 대화에서 분명한 것 하나, 없으면 null.',
].join('\n')

/** 대화에서 그 사람이 처음 등장한 위치 ("이름:" 우선, 없으면 이름) */
function firstAppearance(chat, name) {
  const speaker = chat.indexOf(`${name}:`)
  if (speaker >= 0) return speaker
  const mention = chat.indexOf(name)
  return mention >= 0 ? mention : Number.MAX_SAFE_INTEGER
}

function sanitize(parsed, chat) {
  const seen = new Set()
  const participants = []
  const ordered = [...(parsed.participants ?? [])].sort(
    (a, b) => firstAppearance(chat, String(a?.name ?? '').trim()) - firstAppearance(chat, String(b?.name ?? '').trim()),
  )
  for (const person of ordered) {
    const name = typeof person.name === 'string' ? person.name.trim() : ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    const station = STATION_NAMES.includes(person.station) ? person.station : null
    const entry = { name, station }
    if (!station) entry.hint = typeof person.hint === 'string' && person.hint.trim() ? person.hint.trim() : null
    participants.push(entry)
    if (participants.length >= MAX_PARTICIPANTS) break
  }
  const purpose = PURPOSES.includes(parsed.purpose) ? parsed.purpose : null
  return { participants, purpose }
}

/**
 * 단톡 대화에서 참여자·출발역·목적을 뽑는다. 대화 원문은 로그에 남기지 않는다.
 * 항상 PLAN.md 5-2 형식의 객체를 돌려주고 예외를 던지지 않는다.
 */
export async function extractFromChat(client, request) {
  const chat = typeof request?.chat === 'string' ? request.chat.trim() : ''
  if (!chat) return { ok: false, reason: 'error' }
  if (chat.length > MAX_CHAT_CHARS) return { ok: false, reason: 'too_long' }

  let message
  try {
    message = await client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: EXTRACT_SYSTEM,
      messages: [{ role: 'user', content: `<chat>\n${chat}\n</chat>` }],
      output_config: {
        effort: 'low',
        format: zodOutputFormat(ExtractSchema),
      },
    })
  } catch (error) {
    if (error instanceof APIConnectionTimeoutError) return { ok: false, reason: 'timeout' }
    console.warn('[extract] Claude 호출 실패:', error?.status ?? error?.name ?? 'unknown')
    return { ok: false, reason: 'error' }
  }

  if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal' }
  if (message.stop_reason !== 'end_turn' || !message.parsed_output) {
    return { ok: false, reason: 'parse_failed' }
  }

  return { ok: true, ...sanitize(message.parsed_output, chat) }
}
