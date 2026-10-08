# Nodeterm coordinator — compatibility pointer

The nodeterm coordinator instructions moved into the bundle's installed artifacts:

- Primary agent (compact stable role policy): `.opencode/agent/nodeterm-coordinator.md`
- Workflow skill (canonical detailed procedure): `.opencode/skills/nodeterm-coordinate/SKILL.md`, which loads `references/workflow.md` from its own base directory
- Entry command: `/nodeterm-coordinate` (`src/command/nodeterm-coordinate.md`), whose frontmatter targets the `nodeterm-coordinator` agent

Read `SKILL.md` first; it states when to load the full workflow reference. This file is only a pointer so existing callers keep resolving to the current workflow; it is not a second copy of it. The former role registry and the eight `nodeterm_*` tools were archived (moved, never deleted) under `archive/nodeterm-tools/` in the bundle; they are no longer an active entrypoint, and this file carries none of their behavior.

History: this file previously held a portable copy of the original external coordinator document. That external document is historical migration input only — the agent/skill/reference above supersede it, and they are not byte-identical copies of it (the migration removed its blanket commit authorization and absolute model-certainty claims and relocated its procedures into the skill's workflow reference).
