import test from 'node:test'
import assert from 'node:assert/strict'
import { execCliProvider, execCliProviderStream } from './cli_exec.js'
import { execCancellableShell } from './cancellable_shell.js'
import { runCodexAppServer } from './codex_app_server.js'
import { withRuntimeExecutionContext, getRuntimeExecutionContext } from '../core/runtime_execution_context.js'

for (const execute of [execCliProvider, execCliProviderStream]) {
  test(`${execute.name}: cancellation before spawn`, async () => {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(execute({ bin: 'does-not-exist', signal: controller.signal, onEvent() {} }), { name: 'AbortError' })
  })
  test(`${execute.name}: stop process ignoring SIGTERM`, { timeout: 8000 }, async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 300)
    try {
      await assert.rejects(execute({ bin: process.execPath, args: ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], timeoutMs: 0, signal: controller.signal, onEvent() {} }), { name: 'AbortError', noRetry: true })
    } finally { clearTimeout(timer) }
  })
  test(`${execute.name}: normal execution`, async () => {
    const result = await execute({ bin: process.execPath, args: ['-e', "console.log('ok')"], onEvent() {} })
    assert.equal(result.stdout, 'ok')
  })
}

test('shell stop kills descendants and does not affect another session', { timeout: 8000 }, async () => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 300)
  const other = execCancellableShell('sleep 1; echo unaffected', { maxBuffer: 4096 })
  try {
    await assert.rejects(execCancellableShell("trap '' TERM; sleep 60 & wait", { signal: controller.signal, maxBuffer: 4096 }), { name: 'AbortError' })
    assert.equal((await other).stdout.trim(), 'unaffected')
  } finally { clearTimeout(timer) }
})

test('runtime signal is isolated across concurrent turns', async () => {
  const a = new AbortController(), b = new AbortController()
  await Promise.all([a, b].map(controller => withRuntimeExecutionContext({ signal: controller.signal }, async () => {
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(getRuntimeExecutionContext().signal, controller.signal)
  })))
})

for (const executionMode of ['runtime-controlled', 'codex-native']) {
  test(`Codex ${executionMode}: stop active action`, { timeout: 8000 }, async () => {
    const controller = new AbortController()
    const fixture = `
      const {createInterface}=require('node:readline');
      const send=m=>process.stdout.write(JSON.stringify(m)+'\\n');
      process.on('SIGTERM',()=>{});
      createInterface({input:process.stdin}).on('line',line=>{
        const m=JSON.parse(line);
        if(m.method==='initialize') send({id:m.id,result:{}});
        if(m.method==='thread/start') send({id:m.id,result:{thread:{id:'thread'}}});
        if(m.method==='turn/start') {
          send({id:m.id,result:{turn:{id:'turn'}}});
          send({method:'item/started',params:{threadId:'thread',item:{id:'action',type:'commandExecution',command:'sleep 60'}}});
        }
      });
      setInterval(()=>{},1000);
    `
    await assert.rejects(runCodexAppServer({ bin: process.execPath, args: ['-e', fixture], executionMode,
      signal: controller.signal, onProgress: event => { if (event.type === 'tool-step') controller.abort() },
    }), { name: 'AbortError', noRetry: true })
  })
}
