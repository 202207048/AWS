import { APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import * as z from 'zod'
import { STATIONS } from '../src/stations.js'
import { CLAUDE_MODEL } from './claude.js'

const MAX_TOKENS = 4000
const MAX_CHAT_CHARS = 4000
const MAX_PARTICIPANTS = 6
const STATION_NAMES = STATIONS.map((station) => station.name)
const PURPOSES = ['諛?, '移댄럹', '??, '怨듬?']

const ExtractSchema = z.object({
  participants: z.array(
    z.object({
      name: z.string().describe('??붿뿉 ?섏삩 ?щ엺 ?대쫫'),
      station: z.enum(STATION_NAMES).nullable().describe('?꾨낫??紐⑸줉 以??섎굹. ?대떦 ??씠 ?놁쑝硫?null'),
      hint: z.string().nullable().describe('station??null???? ??붿뿉 ?섏삩 異쒕컻吏 ?쒗쁽. ?꾨땲硫?null'),
    }),
  ),
  purpose: z.enum(PURPOSES).nullable().describe('?쎌냽 紐⑹쟻. ??붿뿉 ?놁쑝硫?null'),
})

const EXTRACT_SYSTEM = [
  '?덈뒗 ?⑦넚諛???붿뿉???쎌냽 李몄뿬?먯? 異쒕컻吏瑜??뺣━?섎뒗 ?꾩슦誘몃떎.',
  `?꾨낫??紐⑸줉: ${STATION_NAMES.join(', ')}`,
  '洹쒖튃:',
  '- ??붿뿉 異쒕컻吏媛 ?섏삩 ?щ엺留?李몄뿬?먮줈 ?ｋ뒗?? 泥섏쓬 ?깆옣???쒖꽌?濡? ???щ엺? ??踰덈쭔 ?ｋ뒗??',
  '- 媛숈? ?щ엺??異쒕컻吏瑜??щ윭 踰?留먰븯硫?留덉?留됱뿉 留먰븳 異쒕컻吏瑜??대떎.',
  '- station?먮뒗 ?꾨낫??紐⑸줉???덈뒗 ?대쫫留?洹몃?濡??대떎. ?뚯궗쨌吏묒씠 洹???씠?쇨퀬 遺꾨챸??留먰븳 寃쎌슦??洹???쑝濡??대떎.',
  '- 紐⑸줉???녿뒗 吏??씠???좊ℓ??怨녹씠硫?station? null, hint????????쒗쁽(?? "?쇱궛")???곷뒗?? 鍮꾩듂????쓣 異붿륫???ｌ? ?딅뒗??',
  '- purpose??諛?移댄럹/??怨듬? 以???붿뿉??遺꾨챸??寃??섎굹, ?놁쑝硫?null.',
].join('\n')

/** ??붿뿉??洹??щ엺??泥섏쓬 ?깆옣???꾩튂 ("?대쫫:" ?곗꽑, ?놁쑝硫??대쫫) */
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
 * ?⑦넚 ??붿뿉??李몄뿬?먃룹텧諛쒖뿭쨌紐⑹쟻??戮묐뒗?? ????먮Ц? 濡쒓렇???④린吏 ?딅뒗??
 * ??긽 PLAN.md 5-2 ?뺤떇??媛앹껜瑜??뚮젮二쇨퀬 ?덉쇅瑜??섏?吏 ?딅뒗??
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
    console.warn('[extract] Claude ?몄텧 ?ㅽ뙣:', error?.status ?? error?.name ?? 'unknown')
    return { ok: false, reason: 'error' }
  }

  if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal' }
  if (message.stop_reason !== 'end_turn' || !message.parsed_output) {
    return { ok: false, reason: 'parse_failed' }
  }

  return { ok: true, ...sanitize(message.parsed_output, chat) }
}
