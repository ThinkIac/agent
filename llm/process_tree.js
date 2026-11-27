// CLI children own their process group so cancellation cannot affect the host.
export const processGroupOptions = { detached: process.platform !== 'win32' }

export function terminateProcessTree(child, graceMs = 2000) {
  if (!child?.pid) return Promise.resolve()
  const kill = signal => {
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, signal)
      else child.kill(signal)
    } catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  kill('SIGTERM')
  // Keep escalation even if the group leader exits before its children.
  return new Promise(resolve => setTimeout(() => { kill('SIGKILL'); resolve() }, graceMs))
}
