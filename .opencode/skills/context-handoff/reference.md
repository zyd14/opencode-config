# Context Handoff Quick Reference

## File-Based Communication Pattern

All agent communication uses file-based storage to minimize context usage and provide observability.

### Quick Start

**Preferred approach: Use CLI to write validated files**

1. **Create session directory** at workflow start:
   ```bash
   uv run context_handoff.py create-session my-workflow
   ```

2. **Write validated assignment** (validates BEFORE writing):
   ```bash
   uv run context_handoff.py write assignment input.json .agents/session-{id}/assignments/01.json
   ```

3. **Agent reads** assignment:
   ```bash
   uv run context_handoff.py validate assignment .agents/session-{id}/assignments/01.json
   ```

4. **Agent writes validated result** (validates BEFORE writing):
   ```bash
   uv run context_handoff.py write result result.json .agents/session-{id}/results/01.json
   ```

5. **Agent returns lightweight reference** (in stdout/return value):
   ```json
   {
     "result_path": ".agents/session-{id}/results/01.json",
     "status": "complete",
     "summary": "One sentence outcome",
     "requires_attention": false,
     "timestamp": "2024-12-10T14:35:22Z"
   }
   ```

6. **Coordinator loads full result** only when needed

## CLI Commands

### Write (Validates Before Writing)

**Recommended for all file creation:**

```bash
# Write from file
uv run context_handoff.py write assignment input.json output.json

# Write from stdin (for programmatic generation)
cat data.json | uv run context_handoff.py write result - output.json

# Invalid files are rejected BEFORE writing
# ❌ File NOT written if validation fails
```

### Validate (Check Existing Files)

```bash
uv run context_handoff.py validate assignment .agents/session-x/assignments/01.json
```

### Create Session

```bash
uv run context_handoff.py create-session workflow-name
uv run context_handoff.py create-session workflow-name --base-dir /custom/path
```

## Directory Structure

```
.agents/
  session-20241210-143022-implement-auth/
    metadata.json              # Session tracking
    assignments/
      01-architect-planning-LIN-100.json
      02-engineer-implementation-LIN-123.json
      03-reviewer-review-LIN-123.json
    results/
      01-architect-planning-LIN-100.json
      02-engineer-implementation-LIN-123.json
      03-reviewer-review-LIN-123.json
    escalations/
      02-engineer-escalation-LIN-124.json
```

## Context Savings

**Traditional (stdout):**
- 10 agents × 3K tokens = 30K tokens in coordinator context

**File-based:**
- 10 agents × 100 tokens = 1K tokens in coordinator context
- **97% reduction!**

## Key Rules

✅ **DO:**
- Write all assignments and results to files
- Pass paths and summaries, not full content
- Load full files only when decisions require details
- Update metadata.json throughout workflow

❌ **DON'T:**
- Pass full JSON in stdout/stdin
- Load results unless you need the details
- Skip creating session directory structure
- Forget to set `expected_result_path` in assignments

## Common File Paths

| File Type | Path Pattern |
|-----------|--------------|
| Assignment | `.agents/session-{id}/assignments/{seq}-{role}-{type}-{issue}.json` |
| Result | `.agents/session-{id}/results/{seq}-{role}-{type}-{issue}.json` |
| Escalation | `.agents/session-{id}/escalations/{seq}-{role}-escalation-{issue}.json` |
| Metadata | `.agents/session-{id}/metadata.json` |

## Example Agent Roles

- `architect` - Planning and design
- `engineer` - Implementation
- `reviewer` - Code review
- `synthesizer` - Knowledge extraction

## Example Assignment Types

- `planning` - Architectural planning
- `implementation` - Feature implementation
- `review` - Code review
- `synthesis` - Learning extraction

## Result Status Values

- `complete` - Task finished successfully
- `blocked` - Cannot proceed, needs intervention
- `needs_clarification` - Requires additional information
- `partial` - Partially complete, more work needed

## When to Load Full Files

**Always load:**
- Current task assignment (agent needs it)
- Escalations (coordinator must understand)

**Load on demand:**
- Previous results (only if current task depends on them)
- Review feedback (only if rework needed)
- Planning details (only for implementation decisions)

**Never load:**
- Unrelated completed tasks
- Historical results unless referenced
- Other session metadata

## See Also

- `SKILL.md` - Full specification with all schemas
- `.agents/` directory - Actual communication files (gitignored)
