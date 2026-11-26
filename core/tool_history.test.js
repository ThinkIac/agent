import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ToolHistory, TOOL_HISTORY_SCHEMAS } from './tool_history.js'
import { selectExecutionTools } from './execution_policy.js'

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'tool-history-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return { directory, store: new ToolHistory(directory) }
}
const call = (id, input = {}) => ({ id, name: 'run_bash', input })

test('survives store restart after a completed tool without a final model response', t => {
  const { directory, store } = fixture(t)
  const id = store.start('session', 'run-1', call('call-1', { command: 'echo hello', numericText: '123' }))
  store.finish('session', id, { ok: true, result: { stdout: 'hello' } })
  const reopened = new ToolHistory(directory)
  assert.equal(reopened.list('session').calls[0].id, id)
  const result = reopened.get('session', { ids: [id] }).calls[0]
  assert.equal(result.runId, 'run-1')
  assert.equal(result.status, 'success')
  assert.deepEqual(JSON.parse(result.input.content), { command: 'echo hello', numericText: '123' })
  assert.deepEqual(JSON.parse(result.result.content), { stdout: 'hello' })
})

test('keeps interrupted, failed and blocked attempts distinct across runs', t => {
  const { directory, store } = fixture(t)
  const pending = store.start('s', 'r1', call('same'))
  const failed = store.start('s', 'r2', call('same'))
  store.finish('s', failed, { ok: false, result: 'execution failed' })
  const blocked = store.start('s', 'r3', call('same'))
  store.finish('s', blocked, { ok: false, blocked: true, result: 'denied' })
  const calls = new ToolHistory(directory).get('s', { ids: [pending, failed, blocked] }).calls
  assert.deepEqual(calls.map(c => c.status), ['unknown', 'error', 'blocked'])
  assert.equal(calls[0].result, null)
  assert.equal(new ToolHistory(directory).list('s', { limit: 1 }).calls[0].id, blocked)
})

test('previews are bounded and long commands/results can be recovered completely', t => {
  const { store } = fixture(t)
  const command = 'x'.repeat(40000)
  const id = store.start('s', 'r', call('c', { command }))
  store.finish('s', id, { ok: true, result: { stdout: command } })
  const preview = store.list('s', { preview_chars: 40 }).calls[0]
  assert.equal(preview.inputPreview.length, 40)
  assert.equal(preview.resultPreview.length, 40)
  let offset = 0, input = '', output = ''
  do {
    const page = store.get('s', { ids: [id], offset, limit: 10000 }).calls[0]
    input += page.input.content; output += page.result.content
    offset = page.input.nextOffset
  } while (offset !== null)
  assert.equal(JSON.parse(input).command, command)
  assert.equal(JSON.parse(output).stdout, command)
})

test('isolates session ownership and rejects traversal and malformed requests', t => {
  const { store } = fixture(t)
  const id = store.start('owner', 'r', call('c'))
  assert.deepEqual(store.list('other').calls, [])
  assert.equal(store.get('other', { ids: [id] }).calls[0].status, 'missing')
  assert.equal(store.get('owner', { ids: ['../../other'] }).calls[0].status, 'missing')
  for (const input of [{}, { ids: [] }, { ids: [id], offset: -1 }, { ids: Array(21).fill(id) }]) assert.equal(store.get('owner', input).status, 'invalid')
  assert.throws(() => store.list(''), /SESSION_REQUIRED/)
})

test('sanitizes structured and serialized secrets before persistence', t => {
  const { store } = fixture(t)
  const id = store.start('s', 'r', call('c', { token: 'private-value', command: 'TOKEN=private-inline echo ok' }))
  store.finish('s', id, { ok: true, result: JSON.stringify({ password: 'private-password', nested: { authorization: 'private-auth' } }) })
  const serialized = JSON.stringify(store.read('s', id))
  for (const secret of ['private-value', 'private-inline', 'private-password', 'private-auth']) assert.equal(serialized.includes(secret), false)
})

test('history schemas survive classification while respecting explicit execution allowlists', () => {
  const selected = selectExecutionTools([...TOOL_HISTORY_SCHEMAS, { name: 'other' }], { classifiedNames: ['other'], always: t => t.reach === 'always' })
  assert.equal(selected.length, 3)
  assert.equal(selectExecutionTools(TOOL_HISTORY_SCHEMAS, { toolAllowlist: ['get_tool_history'] }).length, 1)
})

test('ReAct records start before invocation and completion before later model calls', () => {
  const source = readFileSync(new URL('./agent.js', import.meta.url), 'utf8')
  assert.ok(source.indexOf("recordToolHistory('start'") < source.indexOf('await dispatchBuiltin(tc.name'))
  assert.ok(source.indexOf("recordToolHistory('finish'") < source.indexOf('let response', source.indexOf('async function executeToolCall')))
  assert.match(source, /isToolHistory\(tc.name\)\s*\? queryToolHistory\(tc.name, sessionId, tc.input\)/)
  assert.match(source, /let tools = \[\.\.\.BUILTIN_SCHEMAS, \.\.\.TOOL_HISTORY_SCHEMAS/)
})

test('storage corruption fails visibly instead of appearing as empty history', t => {
  const { directory, store } = fixture(t)
  writeFileSync(join(directory, 'not-a-directory'), 'occupied')
  assert.throws(() => new ToolHistory(join(directory, 'not-a-directory')).start('s', 'r', call('c')))
  const id = store.start('s', 'r', call('c'))
  assert.equal(store.get('s', { ids: [id] }).calls[0].status, 'unknown')
  assert.throws(() => store.finish('s', 'absent', { ok: true, result: 'ok' }), /CALL_MISSING/)
})
