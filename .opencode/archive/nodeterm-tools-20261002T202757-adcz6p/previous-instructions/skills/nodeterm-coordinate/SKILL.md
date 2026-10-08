---
name: nodeterm-coordinate
description: Detailed nodeterm coordination workflow for substantial multi-stage work - proportional agent topology (in-process subagents versus managed planner, implementation-owner, and reviewer nodes), glm-setup read-only preparation with report reuse, durable context-handoff assignments and results, managed open-agent launches with dependency scheduling and station-reuse reset semantics, recovery, and acceptance gates. Load when coordinating work via nodeterm, or when the nodeterm-coordinator primary agent or /nodeterm-coordinate command needs the full procedure.
---

# Nodeterm coordination — entry procedure

1. Load `references/workflow.md` from this skill's base directory (the folder containing this SKILL.md) and follow it as the canonical detailed procedure: role ownership, session workspace, glm-setup preparation, proportional topology, role contracts, managed launches and scheduling, commit policy, acceptance, and starting procedure.
2. Establish the goal, scope, repository state, and applicable AGENTS.md instructions. Ask the user only for decisions that cannot reasonably be resolved from the requested goal and the repository.
3. Create the session workspace (reference §2) and delegate read-only preparation and verification to glm-setup (reference §3), naming a scoped report folder under `.agents/`.
4. Select a proportional topology (reference §4), then assign, schedule, recover, review, and accept per the reference (§5–§9).

Notes:

- Current assignments and per-session data belong in the session workspace or the live conversation — never in these skill files.
- Commits happen only when the current user assignment explicitly authorizes them (reference §7); this workflow carries no blanket commit authorization.
- Canvas operations run through the `nodeterm_*` tools where supported, with the `manage-nodeterm-canvas` and `get-linked-context` skills covering what the tools do not.
