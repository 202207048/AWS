const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']
const PURPOSE_DETAIL = {
  밥: '모두의 메뉴 합의까지 평화롭게 이어질 식사 약속',
  카페: '대화와 디저트를 느긋하게 즐길 카페 약속',
  술: '귀갓길까지 고려해야 할 술자리',
  공부: '집중력과 이동 피로를 함께 따져야 할 공부 모임',
}

export function createTemplateVerdict(result, purpose) {
  const stationName = result.station.name
  const max = Math.round(result.maxTime)
  const spread = Math.round(result.spread)

  return [
    `주문: 이번 ${purpose} 약속 장소는 ${stationName}역으로 정한다.`,
    `판결 이유: 누구도 약 ${max}분을 넘기지 않고, 이동시간 차이도 약 ${spread}분에 그친다.`,
    '한 사람의 희생으로 세운 약속은 오래가지 못한다는 점도 참작했다.',
    `선고: 전원은 이 판결에 따라 ${stationName}역으로 모일 것.`,
  ].join('\n')
}

function normalizeVerdict(text) {
  return text
    .replace(/```(?:text)?|```/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join('\n')
}

export async function generateVerdict(result, purpose, participants, apiKey) {
  if (!apiKey) return { text: createTemplateVerdict(result, purpose), source: 'template' }

  const times = result.times
    .map(({ participantId, minutes }) => {
      const participant = participants.find(({ id }) => id === participantId)
      return `${participant?.station.name ?? '알 수 없음'} 출발 ${Math.round(minutes)}분`
    })
    .join(', ')

  const prompt = [
    '당신은 약속 장소를 정하는 재치 있는 대한민국 법정 판사다.',
    `목적은 ${PURPOSE_DETAIL[purpose]}이다.`,
    `1위 후보는 ${result.station.name}역이고 참여자 예상 이동시간은 ${times}이다.`,
    `최대 이동시간은 ${Math.round(result.maxTime)}분, 최대·최소 차이는 ${Math.round(result.spread)}분이다.`,
    '반드시 한국어로 주문, 판결 이유, 선고를 포함한 판결문만 작성하라.',
    '과장하거나 실제 교통 정보인 것처럼 단정하지 말고, 재치 있게 5줄 이내로 작성하라.',
  ].join('\n')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    let lastError

    for (const model of GEMINI_MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 220 },
          }),
        },
      )

      if (!response.ok) {
        lastError = new Error(`Gemini API 오류 (${model}): ${response.status}`)
        continue
      }

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('')
      if (!text) {
        lastError = new Error(`Gemini API 응답이 비어 있습니다 (${model}).`)
        continue
      }

      return { text: normalizeVerdict(text), source: 'gemini' }
    }

    throw lastError ?? new Error('사용 가능한 Gemini 모델이 없습니다.')
  } catch (error) {
    console.warn('Gemini 판결문 생성 실패. 템플릿을 사용합니다.', error)
    return { text: createTemplateVerdict(result, purpose), source: 'template' }
  } finally {
    clearTimeout(timeoutId)
  }
}
