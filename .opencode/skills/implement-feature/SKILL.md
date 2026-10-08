---
name: implement-feature
description: Implement a feature through a structured workflow with requirements gathering, solution design, planning, implementation in a worktree, and code review. No Linear integration required.
disable-model-invocation: true
---

Coordinate feature implementation from requirements through review. Keep agent handoffs in a session-specific `.agents/` directory and perform all code changes in an isolated git worktree.

## Your Role

**Identity:** Implementation workflow coordinator
**Subagents to spawn:** implementation-planner, glm-implementer (or implementation subagent requested by user), code-review, glm-5-3-flash-implementer (for worktree setup), explore-glm-flash (for research)
**Isolation:** All implementation work happens in a git worktree

## Skills to Reference

Load these skills for detailed patterns:
- `context-handoff` - Agent assignment, result, and file-reference formats. Always use it for subagent communication. **ALWAYS CALL THE SCRIPTS PROVIDED BY context-handoff USING UV**; use `uv run --script` to execute the script in its own isolated venv.


## Planner Research Loop

Use this loop whenever an implementation-planner creates or validates a design or implementation plan. The planner owns synthesis and decisions; explore agents gather evidence.

1. **Start the planner.** Provide the objective, constraints, user decisions, relevant artifact paths, and required output for the current phase.
2. **Request one research batch.** Before planning, the planner writes and returns a reference to its unresolved questions, then stops without drafting the plan. Include only questions that materially affect the output. Each question must state what must be learned, why it matters, where to look when known, and what evidence the answer should include.
3. **Route each question correctly.**
   - Send repository and technical fact-finding to parallel `explore-glm-flash` agents.
   - Ask the user about product choices, scope, and preferences; do not delegate these decisions to explore agents.
   - Answer from existing artifacts when the information is already available.
4. **Consolidate results.** Write one research brief under `.agents/session-{id}/results/`. For each question, record the answer, supporting file paths or sources, confidence, and unresolved points.
5. **Resume the same planner.** Pass only the research brief path and a short summary. Do not replace the planner during an active research loop.
6. **Repeat only when necessary.** Allow at most two research dispatch rounds per planning phase. Follow-up questions must arise from new evidence and must not repeat answered questions.
7. **Finish or escalate.**
   - If evidence is sufficient, produce the requested design or plan.
   - If remaining uncertainty is low-risk, proceed with explicit assumptions.
   - If uncertainty could materially change scope, architecture, or acceptance criteria, stop and ask the user. Do not invent a decision to satisfy the round limit.

Use a fresh implementation-planner for Phase 3. Give it the approved design and existing research brief so it requests only missing implementation-level evidence.

## Workflow Phases

### Phase 1: Requirements Gathering

Extract requirements already present in the request, then ask only for material gaps:
- feature or change;
- problem, users, and use cases;
- success criteria;
- technical constraints;
- explicit exclusions.

Summarize the requirements, assumptions, and open questions. Obtain confirmation before design.

### Phase 2: Solution Design

If the user supplied a sufficient design or implementation plan, treat its design decisions as the candidate design and resolve only material gaps. Otherwise, spawn an implementation-planner for a high-level design:
- Use `assignment_type: planning` format from `context-handoff` skill
- Follow the Planner Research Loop.
- Request the approach, components, interfaces, key decisions, tradeoffs, risks, and assumptions.
- Keep task-level implementation details out of this phase.
- Write the proposal under the session-specific `.agents/` directory.

Present the proposal and iterate until the user approves it. Do not begin detailed planning without approval.

### Phase 3: Implementation Planning

Start worktree setup and detailed planning concurrently after design approval.

**Worktree setup:** Ask `glm-5-3-flash-implementer` to:
- create a feature branch and worktree under the repository's `.worktrees/` directory;
- run repository-defined setup commands, preferring the top-level `.justfile`;
- run baseline tests, lint, and static checks appropriate to the repository;
- report the worktree path, branch, and any pre-existing failures.

**Detailed plan:** If the user supplied a comprehensive implementation plan, validate it against the approved requirements and design and fill only material gaps. Otherwise, spawn a fresh implementation-planner:
- Use planning assignment format from `context-handoff` skill
- Include the approved design and previous research brief paths.
- Follow the Planner Research Loop.
- Request ordered, single-session tasks with dependencies, affected files, testable acceptance criteria, validation commands, and risks.
- Write the plan under the session-specific `.agents/` directory.

Present the plan and obtain user approval before implementation.

### Phase 4: Implementation

Wait for worktree setup and baseline validation to finish. Use the user's requested implementer, or `deepseek-implementer` by default.

**Spawn implementer subagent** for each task (or batch related tasks):
- Use `assignment_type: implementation` format from `context-handoff` skill
- Include: task details, acceptance criteria, working directory
- Require the implementer to update its session result or progress file with status, files changed, validation results, blockers, and plan deviations.
- Run tasks in dependency order. Do not let multiple agents edit the same worktree concurrently.

For blockers, provide missing evidence, return architectural issues to the planner, or ask the user for a scope/product decision. Record every approved deviation.

### Phase 5: Code Review

**Spawn code-review:**
- Use `assignment_type: review` format from `context-handoff` skill
- Include: what was implemented, acceptance criteria, deviations, working directory
- Allow at most two review rounds.

**Process outcome:**
- **approved / approved_with_suggestions:** Proceed to completion; report optional suggestions.
- **changes_required:** Assign required fixes to the selected implementer, then re-review.
- **rejected, or changes still required after round two:** Escalate to the user with unresolved findings.

### Phase 6: Completion & Merge

**Present summary to user:**
- what was built and validated;
- files changed;
- deviations and unresolved issues;
- significant review findings and resolutions;
- branch/worktree location and merge instructions.

## Critical Rules

**User interaction:**
- ✅ Get approval before design → planning transition
- ✅ Get approval before starting implementation
- ✅ Present deviations transparently
- ❌ Don't proceed past design without sign-off

**Worktree discipline:**
- ✅ All implementation in worktree
- ✅ User controls when to merge
- ❌ Don't auto-merge

**Subagent boundaries:**
- ✅ Architect designs/plans, Engineer implements, Reviewer reviews
- ❌ Don't blur responsibilities

**Context and memory:**
- ✅ Always use the context-handoff skill when communicating with agents
- ✅ Pass artifact paths and concise summaries instead of embedding full results
- ✅ Keep all workflow artifacts in one session-specific `.agents/` directory

## Working State
Maintain a working state file in the session-specific `.agents/` directory:

```json
{
  "feature_name": "Feature name",
  "current_phase": "requirements|design|planning|setup|implementation|review|completion",
  "requirements_path": "",
  "design_path": "",
  "plan_path": "",
  "research_paths": [],
  "worktree": {"path": "", "branch": "", "original_branch": ""},
  "tasks": [{"name": "", "status": "pending|in_progress|complete", "deviations": []}],
  "review_iterations": 0,
  "deviations": [],
  "blockers": []
}
```

Unless the request already contains enough detail, begin by asking what the user wants to implement and what success looks like.
