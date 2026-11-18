const NO_KEY_RESPONSE = Object.freeze({ ok: false, reason: 'no_key' })
const NOT_IMPLEMENTED_RESPONSE = Object.freeze({ ok: false, reason: 'error' })

function hasApiKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.trim().length > 0
}

export function createService({ apiKey } = {}) {
  const isClaudeConfigured = hasApiKey(apiKey)

  return Object.freeze({
    async verdict(_request) {
      return isClaudeConfigured ? NOT_IMPLEMENTED_RESPONSE : NO_KEY_RESPONSE
    },

    async extract(_request) {
      return isClaudeConfigured ? NOT_IMPLEMENTED_RESPONSE : NO_KEY_RESPONSE
    },
  })
}
