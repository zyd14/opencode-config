---
description: Launch an independent review of a supplied implementation or commit range.
---

Review target (implementation description or commit range): $ARGUMENTS

If the target above is empty, determine the review scope by delegating the read-only repository inspection (recent commits and working tree changes) to a `glm-setup` subagent with a scoped report path under the session workspace, then confirm the scope with the user before launching.

1. Delegate verification of the exact base and head commits (or working-tree state) to review to the same `glm-setup` pass; record what it verified in the review assignment.
2. Create or reuse the session workspace under `.agents/` and write a durable review assignment file (context-handoff review-assignment shape) containing the review scope, artifacts and commits, the implementation result path if one exists, acceptance criteria, review focus, and the expected result path.
3. Launch the reviewer with `nodeterm_role_launch`: role `reviewer`, with the requested model `openai/gpt-6.1-sol` (nodeterm's `--model` forwarding is unverified for the opencode launcher, so the session may not actually run it), and the review assignment path carried in the task text. A dry-run first is recommended.
4. The reviewer does not modify application code; it uses explore subagents and writes findings with severity, evidence, and remediation.

When launched, report the node id, the assignment path, and the node's observed state. A successful review means the review was completed and delivered: read its verdict before treating the implementation as approved.
