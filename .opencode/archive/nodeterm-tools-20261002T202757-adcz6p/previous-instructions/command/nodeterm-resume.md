---
description: Inspect saved .agents/ workflow state and recover the remaining work.
---

1. Delegate the read-only workspace inventory to a `glm-setup` subagent: all `.agents/` session workspaces (metadata.json, assignments/, results/, escalations/, newest first) and, for the most recent session (or the one named in $ARGUMENTS), a reconstruction of which assignments are complete, in flight, blocked, and which nodes were launched. Name its scoped report path under the session workspace (e.g. research/). If no `.agents/` state exists, say so and stop.
2. Read glm-setup's inventory report first; cross-check the canvas with `nodeterm_list` and read linked stations with `nodeterm_context` (summaries first) to learn the real state of launched nodes. Do not trust stale metadata over observed state, and do not treat `queued` as running.
3. Produce a short recovery plan: remaining tasks, their dependencies, blocked items needing the user, and which handoff documents carry them.
4. Recover: re-brief stations with `nodeterm_send` when they are alive and eligible; relaunch missing roles with `nodeterm_role_launch` using fresh request ids (never reuse an old request id from a previous run for a new open); release dependents only after their upstream results actually exist.
5. Update metadata.json (status, task_tracking, notes) as you go.

When the recovery work in this session ends, finish with an honest `nodeterm_report_outcome`.
