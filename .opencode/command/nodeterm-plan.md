---
description: Prepare a durable planning assignment and launch the planner role.
---

Planning goal: $ARGUMENTS

If the goal above is empty, ask the user for the planning goal before doing anything else.

1. Create or refresh the session workspace under `.agents/` using context-handoff patterns: a session directory containing metadata.json, assignments/, results/, and research/.
2. Delegate read-only preparation and verification for the goal to a `glm-setup` subagent: environment verification, codebase pointers relevant to the goal, and the repository's development tooling and best practices. Name its scoped report path under the session's research/ folder (with context-handoff, the report is included in or referenced from the handoff doc). Fold its findings into the planning assignment's relevant context and reference the report path there.
3. Write a durable planning assignment file (context-handoff planning-assignment shape) containing the goal, scope, constraints, relevant codebase pointers, and the expected result path (a planning result written under the session's results/).
4. Launch the planner as a managed node with the canvas-control CLI `open-agent` verb exactly as the `manage-nodeterm-canvas` skill documents it (this bundle ships no launch tool): `--agent opencode`, `--cwd` this project, `--prompt-file <assignment file path>`, and the requested model `anthropic/claude-opus-5-5` via `--model` (nodeterm forwards it, but its honoring by the opencode launcher is unverified — the session may not actually run it). Validate with a `--dry-run` first, then launch for real with a fresh unique `--request-id`; reuse that same id only to recover a lost reply, never for a new launch.
5. After launch, report the node id, the requested model (with the unverified-forwarding caveat), the assignment path, and the node's actual observed state (created vs queued). Never claim the planner is running without evidence.
6. Optionally link additional nodes with the CLI `link` verb so they can read the planner's work on demand.

Tell the user the planner will finish with the CLI `report-outcome` verb when done, and that its results land in the assignment-named result path.
