import { createClaudeClient, generateVerdict } from './claude.js'

const NO_KEY_RESPONSE = Object.freeze({ ok: false, reason: 'no_key' })
const NOT_IMPLEMENTED_RESPONSE = Object.freeze({ ok: false, reason: 'error' })

function hasApiKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.trim().length > 0
}

/**
 * 환경변수에 직접 의존하지 않는 서비스 계층. 나중에 Lambda handler로 감쌀 수 있다.
 * 테스트에서는 client를 주입해 실제 네트워크 호출 없이 동작을 확인한다.
 */
export function createService({ apiKey, client } = {}) {
  const isClaudeConfigured = hasApiKey(apiKey)
  const claude = isClaudeConfigured ? (client ?? createClaudeClient(apiKey.trim())) : null

  return Object.freeze({
    async verdict(request) {
      if (!claude) return NO_KEY_RESPONSE
      return generateVerdict(claude, request)
    },

    async extract(_request) {
      return claude ? NOT_IMPLEMENTED_RESPONSE : NO_KEY_RESPONSE
    },
  })
}
