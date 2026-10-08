---
description: Prepare a durable planning assignment and launch the planner role.
---

Planning goal: $ARGUMENTS

If the goal above is empty, ask the user for the planning goal before doing anything.

1. Create or refresh the session workspace under `.agents/` using context-handoff patterns: a session directory containing metadata.json, assignments/, results/, and research/.
2. Delegate read-only preparation and verification for the goal to a `glm-setup` subagent: environment verification, codebase pointers relevant to the goal, and the repository's development tooling and best practices. Name its scoped report path under the session's research/ folder (with context-handoff, the report is included in or referenced from the handoff doc). Fold its findings into the planning assignment's relevant context and reference the report path there.
3. Write a durable planning assignment file (context-handoff planning-assignment shape) containing the goal, scope, constraints, relevant codebase pointers, and the expected result path (a planning result written under the session's results/).
4. Launch the planner with `nodeterm_role_launch`: role `planner`, with the assignment file path carried in the task text, and cwd set to this project. Run it once with `dryRun: true` first, then launch for real with the same semantics.
5. After launch, report the node id, the requested model (`anthropic/claude-opus-5-5`, noting that nodeterm's `--model` forwarding is unverified for the opencode launcher, so the session may not actually run it), the assignment path, and the node's actual observed state (created vs queued). Never claim the planner is running without evidence.
6. Optionally link additional nodes with `nodeterm_link` so they can read the planner's work on demand.

Tell the user the planner will finish with `nodeterm_report_outcome` when done, and that its results land in the assignment-named result path.
