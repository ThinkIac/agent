import { randomUUID } from 'node:crypto'
import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The launcher calls this optional extension before loading Agent handlers.
export function configureRuntime({ package: { dir }, environment = process.env }) {
  const configFile = join(dir, 'agent.config.json')
  if (existsSync(configFile)) return

  const config = JSON.parse(readFileSync(new URL('./agent.config.default.json', import.meta.url), 'utf8'))
  const token = environment.THINKIAC_API_KEY || environment.LLM_PROXY_TOKEN
  const gateway = (environment.GATEWAY_URL || 'https://thinkiac.cloud').replace(/\/$/, '')
  config.llm.pools = config.llm.pools.flatMap(pool => {
    if (!pool.api_keys?.includes('__LLM_PROXY_TOKEN__')) return [pool]
    if (!token) return []
    return [{ ...pool, api_keys: [token], base_url: gateway + '/thinkiac-provider/v1' }]
  })

  const temporary = `${configFile}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
    // Publish a complete file without replacing another initializer's result.
    try {
      linkSync(temporary, configFile)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
  } finally {
    try {
      unlinkSync(temporary)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}
