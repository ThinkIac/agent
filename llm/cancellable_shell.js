import { spawn } from 'node:child_process'
import { processGroupOptions, terminateProcessTree } from './process_tree.js'

// Wait for pipe closure as well as process exit before releasing the turn.
export function execCancellableShell(command, { cwd, timeout, maxBuffer, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(Object.assign(new Error('Turno cancelado.'), { name: 'AbortError' })); return }
    const child = spawn('/bin/bash', ['-c', command], { ...processGroupOptions, cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', bytes = 0, failure, stopping = false, termination
    const stop = error => {
      if (stopping) return
      stopping = true
      failure = error
      termination = terminateProcessTree(child)
    }
    const abort = () => stop(Object.assign(new Error('Turno cancelado.'), { name: 'AbortError' }))
    const timer = timeout ? setTimeout(() => stop(Object.assign(new Error('Shell timed out.'), { code: 'ETIMEDOUT' })), timeout) : null
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const collect = (chunk, kind) => {
      bytes += chunk.length
      if (bytes > maxBuffer) { stop(new Error('maxBuffer exceeded')); return }
      if (kind === 'stdout') stdout += chunk.toString()
      else stderr += chunk.toString()
    }
    child.stdout.on('data', chunk => collect(chunk, 'stdout'))
    child.stderr.on('data', chunk => collect(chunk, 'stderr'))
    child.on('error', error => { failure ||= error })
    child.on('close', async (code, killedBy) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      await termination
      if (failure || code !== 0) reject(Object.assign(failure || new Error(`Shell exited with code ${code} (${killedBy || ''})`), { stdout, stderr, ...(failure ? {} : { code }) }))
      else resolve({ stdout, stderr })
    })
  })
}
