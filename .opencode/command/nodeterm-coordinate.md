---
description: Coordinate the supplied goal or plan through nodeterm using the nodeterm-coordinator agent and its workflow skill.
agent: nodeterm-coordinator
---

Goal or plan to deliver: $ARGUMENTS

If the goal above is empty, ask the user for the goal before doing anything else.

Load the `nodeterm-coordinate` skill and follow it (its entry procedure points to the detailed workflow reference) to deliver the goal under the current user's scope and commit authorization.

Execute per that workflow: prepare the session workspace, delegate read-only preparation/verification to a `glm-setup` subagent with a scoped report path under `.agents/`, run canvas operations through the documented CLI verbs of the `manage-nodeterm-canvas` skill (this bundle ships no nodeterm tools), and gate stages with dependency waits rather than queued messages.

Finish with a concise, evidence-backed handoff/report: deliverables, verification outcomes, decisions, blockers, and remaining work.
