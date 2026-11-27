# Stop Generation

The Shell and Agent views already POST to `chat/cancel`. Cancellation now keeps
controller ownership until turn cleanup, clears queued messages and denies pending
questions and permissions. The turn signal reaches CLI providers, nested agents,
and runtime tools through the internal async execution context. Provider fallback
must not restart an aborted turn.

CLI processes run in their own process group on POSIX. Stop sends SIGTERM then
SIGKILL after two seconds, including descendants still in that group. Codex also
receives `turn/interrupt`; both runtime-controlled and codex-native modes use this
path. Cancellation does not undo completed writes or external requests.

## Host tool integration

Runtime tools must observe `getRuntimeExecutionContext()?.signal`. For the Engineer
`run_shell` tool, replace its execFile call with `execCancellableShell` exported by
`llm/cancellable_shell.js`, preserving cwd, timeout, maxBuffer and existing output
fields, and pass that signal. Report AbortError as cancelled. This integration is
applied in the local ThinkIac workspace; Engineer is a separate package and is not
part of this repository.

Arbitrary non-cooperative tools, remote inference services and processes that leave
the process group cannot be guaranteed stopped by this mechanism. Windows currently
terminates the direct CLI process only. These limits require host/provider support.

## Verification

`node --test llm/cancellation.test.js` tests pre-abort, resistant CLI processes,
shell descendants, session isolation and both Codex execution modes with fixtures.
These are deterministic process/protocol tests, not live provider smoke tests.
