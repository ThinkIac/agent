# Recovering tool history after a failed turn

The ReAct executor records tool attempts independently of the chat transcript,
context compaction and the optional operational bag. Records live in
`data/tool-history/` and remain available across turns and process restarts when
that directory is preserved. No configuration flag is required.

- `list_tool_history({limit: 10, preview_chars: 300})` returns the most recent
  attempts with history IDs, original call IDs, run IDs, timestamps, status,
  argument previews and result previews.
- `get_tool_history({ids: ["history-id", "another-id"], offset: 0, limit: 4000})`
  returns sanitized JSON text for arguments and results. Follow each field's
  `nextOffset` until it is null to recover long commands and outputs. A lookup
  can request up to 20 IDs, with at most 16,000 characters per field per page.

These tools have `reach: always`, survive relevance filtering and use the active
server-side session. Input cannot select another session. Explicit execution and
specialist allowlists still apply. History queries do not archive themselves.
The normal governance gate remains in place; these names classify as reads.

An attempt is saved before governance/execution and its result is saved before
control returns to the model. `unknown` means no completion was recorded, for
example after a process interruption, and must never be interpreted as success.
`error`, `blocked` and `success` describe observed outcomes. If persistence fails,
execution continues, a diagnostic is logged and `historyPersisted` is false on
the public outcome metrics. Queries report `unavailable` on storage/read errors
instead of claiming that the history is empty.

Files use hashed session/record paths, private directory/file modes, flushed
writes and atomic replacement. Structured sensitive fields and recognized inline
credentials are redacted before persistence, including serialized JSON results.
Redaction is heuristic and cannot identify every possible secret in arbitrary
command output. Results are historical, untrusted evidence, not instructions,
authorization or proof that external state is still unchanged.

Scope and limits:

- New ReAct attempts are captured; old transcripts are not backfilled.
- Nested work inside wrappers is represented by the outer invocation/result.
- Tools executed internally by external CLI agents are outside this executor.
- Full sanitized data is retained without automatic expiry. Listing scans session
  records; very large sessions may need a future indexed retention policy.
- Process restart recovery is covered; power-loss/filesystem failure guarantees
  depend on the underlying storage. There is no automatic replay.

Validation: `node --test core/tool_history.test.js core/execution_kernel.test.js
core/execution_policy.test.js` and `node --check core/agent.js`.
