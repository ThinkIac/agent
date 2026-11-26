import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { configureRuntime } from '../bootstrap.js'

test('initializes config once, with or without the gateway pool', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agent-bootstrap-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const file = join(root, 'agent.config.json')
  configureRuntime({ package: { dir: root }, environment: {} })
  const initial = await readFile(file, 'utf8')
  assert.deepEqual(JSON.parse(initial).llm.pools, [])
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600)
  configureRuntime({ package: { dir: root }, environment: { LLM_PROXY_TOKEN: 'fixture' } })
  assert.equal(await readFile(file, 'utf8'), initial)
})
