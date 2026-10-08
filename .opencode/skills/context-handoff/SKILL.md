---
name: context-handoff
description: Structured patterns for passing context between agents, phases, and workflows. Ensures clear communication with minimal overhead through file-based JSON storage and reference passing. Use when needing to manage communication between multiple agents.
allowed-tools: Read, Write, Edit, Glob, Grep
user-invocable: false
---

# Context Handoff Skill

This skill provides patterns for efficient context transfer between agents, workflow phases, and systems. Good context handoff is critical for multi-agent coordination - too little context causes errors, too much wastes tokens and confuses focus.

## Validation Utilities Available

**This skill includes JSON schema validation utilities!** 

Use `~/.claude/skills/context-handoff/scripts/context_handoff.py` for validated operations:

**CLI Commands:**
- `context_handoff.py write <schema> <source> <dest>` - Validate and write JSON (validates BEFORE writing to disk)
- `context_handoff.py validate <schema> <file>` - Validate existing JSON file against schema
- `context_handoff.py create-session <workflow-name>` - Create session directory structure

**Schema types:** `assignment`, `result`, `result_reference`, `assignment_reference`

**Examples:**
```bash
# Write validated assignment (rejects invalid files BEFORE writing)
context_handoff.py write assignment input.json .agents/session-x/assignments/01.json

# Validate existing file
context_handoff.py validate result .agents/session-x/results/01.json

# Create session
context_handoff.py create-session my-workflow
```

Run `context_handoff.py --help` for full documentation. Run `example.py` to see complete workflow.

**Key benefit:** Validation happens BEFORE writing - invalid files never touch disk.

## When to Use This Skill

- Assigning work to subagents
- Passing results between workflow phases
- Documenting work for future reference
- Summarizing outcomes for parent coordinators

## Core Principles

1. **Minimal sufficient context** - Include only what's needed for the task
2. **File-based communication** - Write assignments and results to files, pass paths
3. **Structured formats** - Use consistent JSON schemas
4. **Clear expectations** - Always specify expected outputs
5. **Single focus** - One task per handoff
6. **Explicit boundaries** - State what's in scope and out of scope
7. **Lazy loading** - Keep only summaries in context, load full details on demand

## Communication Architecture

### File-Based Pattern

**All agent communication uses file-based handoffs:**

1. **Coordinator creates assignment** → Writes to `.agents/session-{id}/assignments/{file}.json`
2. **Coordinator passes file path** → Agent receives path, not full JSON
3. **Agent reads assignment** → Loads file content when needed
4. **Agent writes result** → Writes to `.agents/session-{id}/results/{file}.json`
5. **Agent returns file path** → Coordinator receives path + summary
6. **Coordinator loads on demand** → Only reads full result when needed

### Directory Structure

```
.agents/
  session-{timestamp}-{workflow-name}/
    assignments/
      01-architect-planning-{issue-id}.json
      02-engineer-implementation-{issue-id}.json
      03-reviewer-review-{issue-id}.json
    results/
      01-architect-planning-{issue-id}.json
      02-engineer-implementation-{issue-id}.json
      03-reviewer-review-{issue-id}.json
    metadata.json  # Session info, workflow state, timeline
```

### Session Naming Convention

Format: `session-{YYYYMMDD-HHMMSS}-{workflow-name}`

Examples:
- `session-20241210-143022-implement-auth`
- `session-20241210-150145-linear-lin-123`

### File Naming Convention

**Assignments:** `{sequence}-{agent-role}-{assignment-type}-{issue-id}.json`
**Results:** `{sequence}-{agent-role}-{assignment-type}-{issue-id}.json`

Examples:
- `01-architect-planning-LIN-123.json`
- `02-engineer-implementation-LIN-123.json`
- `03-reviewer-review-LIN-123.json`

Sequence numbers ensure chronological ordering and easy navigation.

## Context Budget Guidelines

With file-based communication, coordinators maintain minimal context:

| Context Type | Target Budget | Contents |
|--------------|---------------|----------|
| Coordinator working set | <5K tokens | Workflow state, current phase, file references |
| File reference | <100 tokens | Path, summary, status, timestamp |
| Full file load | On-demand | Only when explicitly needed for decision |

**Traditional context growth:**
- 10 agent interactions = 30-40K tokens in coordinator context

**File-based context:**
- 10 agent interactions = 1-2K tokens (just references + summaries)

## File-Based Communication Workflow

### Step 1: Coordinator Creates Assignment

```bash
# 1. Coordinator creates assignment JSON (however you want - code, template, etc.)
cat > assignment.json << 'EOF'
{
  "assignment_type": "implementation",
  "issue_id": "LIN-123",
  "task": {
    "summary": "Implement user authentication middleware",
    "description": "Use JWT-based authentication"
  },
  "acceptance_criteria": [
    "Middleware validates JWT tokens",
    "Returns 401 for invalid tokens",
    "Extracts user from token"
  ],
  "expected_output": {
    "result_path": ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json",
    "format": "implementation_result",
    "required_fields": ["status", "summary", "artifacts"]
  }
}
EOF

# 2. Write validated assignment (validates BEFORE writing to disk)
context_handoff.py write assignment assignment.json \
  .agents/session-20241210-143022/assignments/02-engineer-implementation-LIN-123.json

# 3. Pass reference to agent (not full content)
# This is what agent receives - lightweight reference
{
  "assignment_path": ".agents/session-20241210-143022/assignments/02-engineer-implementation-LIN-123.json",
  "summary": "Implement user authentication middleware",
  "expected_result_path": ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json"
}
```

### Step 2: Agent Reads Assignment

```bash
# Agent receives reference, validates and loads full content
context_handoff.py validate assignment \
  .agents/session-20241210-143022/assignments/02-engineer-implementation-LIN-123.json

# Agent can read the file to work with it
# (or use jq, Python, whatever)
```

### Step 3: Agent Writes Result

```bash
# 1. Agent creates result JSON after doing work
cat > result.json << 'EOF'
{
  "result_type": "implementation",
  "issue_id": "LIN-123",
  "status": "complete",
  "summary": "Successfully implemented auth middleware with JWT validation",
  "details": {
    "approach": "Created middleware using jsonwebtoken library",
    "decisions": ["Used RS256 for security"]
  },
  "artifacts": {
    "files_modified": ["src/api/auth.py", "src/middleware/auth.py"],
    "files_created": ["tests/test_auth.py"]
  },
  "divergences": [],
  "blockers": []
}
EOF

# 2. Write validated result (validates BEFORE writing to disk)
context_handoff.py write result result.json \
  .agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json
```

### Step 4: Agent Returns Reference

```bash
# Agent returns only reference (not full result)
# This keeps coordinator context small
{
  "result_path": ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json",
  "result_type": "implementation",
  "status": "complete",
  "summary": "Successfully implemented auth middleware with JWT validation",
  "requires_attention": false,
  "timestamp": "2024-12-10T14:35:22Z"
}
```

### Step 5: Coordinator Receives Reference

```bash
# Coordinator stores reference in working state (not full result)
# Load full result ONLY if needed for decision
if [ "$status" = "blocked" ]; then
  context_handoff.py validate result \
    .agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json
  # Now read full result to understand blocker
fi
```

## Assignment Formats

All assignments are written to files and referenced by path. Agents receive the file path, not the full content.

### Standard Task Assignment

**File location:** `.agents/session-{id}/assignments/{seq}-{role}-implementation-{issue}.json`

```json
{
  "assignment_type": "implementation",
  "issue_id": "LIN-123",
  "task": {
    "summary": "One sentence describing what to implement",
    "description": "2-3 sentences of additional context if needed"
  },
  "acceptance_criteria": [
    "Specific, testable criterion 1",
    "Specific, testable criterion 2",
    "Specific, testable criterion 3"
  ],
  "constraints": [
    "Technical constraint or limitation",
    "Style/pattern to follow"
  ],
  "relevant_context": {
    "files": ["path/to/relevant/file.py"],
    "dependencies": ["LIN-122 must be complete"],
    "learnings": ["Relevant insight from past work"],
    "reference_files": [
      ".agents/session-xyz/results/01-architect-planning-LIN-120.json"
    ]
  },
  "expected_output": {
    "result_path": ".agents/session-{id}/results/{seq}-{role}-implementation-{issue}.json",
    "format": "implementation_result",
    "required_fields": ["status", "summary", "artifacts"],
    "status_values": ["complete", "blocked", "needs_clarification"]
  },
  "scope_boundaries": {
    "in_scope": ["What should be done"],
    "out_of_scope": ["What should NOT be done"]
  }
}
```

**What coordinator passes to agent:**

```json
{
  "assignment_path": ".agents/session-{id}/assignments/02-engineer-implementation-LIN-123.json",
  "summary": "Implement user authentication middleware",
  "expected_result_path": ".agents/session-{id}/results/02-engineer-implementation-LIN-123.json"
}
```

### Planning Assignment

**File location:** `.agents/session-{id}/assignments/{seq}-architect-planning-{issue}.json`

```json
{
  "assignment_type": "planning",
  "issue_id": "LIN-100",
  "objective": {
    "summary": "What needs to be planned",
    "success_criteria": ["How we know the plan is good"]
  },
  "context": {
    "background": "Why this work is needed",
    "constraints": ["Technical constraints", "Timeline constraints"],
    "existing_patterns": ["Patterns to follow or reference"],
    "reference_files": [
      ".agents/session-xyz/results/previous-feature-planning.json"
    ]
  },
  "expected_output": {
    "result_path": ".agents/session-{id}/results/{seq}-architect-planning-{issue}.json",
    "format": "implementation_plan",
    "required_fields": ["approach", "sub_tasks", "dependencies", "risks"],
    "sub_task_fields": ["task", "description", "acceptance_criteria", "estimate"]
  }
}
```

**What coordinator passes to agent:**

```json
{
  "assignment_path": ".agents/session-{id}/assignments/01-architect-planning-LIN-100.json",
  "summary": "Plan implementation approach for feature X",
  "expected_result_path": ".agents/session-{id}/results/01-architect-planning-LIN-100.json"
}
```

### Review Assignment

**File location:** `.agents/session-{id}/assignments/{seq}-reviewer-review-{issue}.json`

```json
{
  "assignment_type": "review",
  "issue_id": "LIN-123",
  "review_scope": {
    "summary": "What was implemented",
    "artifacts": ["path/to/changed/file.py"],
    "pr_link": "https://github.com/...",
    "implementation_result_path": ".agents/session-{id}/results/02-engineer-implementation-LIN-123.json"
  },
  "acceptance_criteria": [
    "Original criterion 1",
    "Original criterion 2"
  ],
  "review_focus": [
    "Specific concern to evaluate",
    "Pattern compliance to check"
  ],
  "expected_output": {
    "result_path": ".agents/session-{id}/results/{seq}-reviewer-review-{issue}.json",
    "format": "review_result",
    "required_fields": ["decision", "summary", "feedback"],
    "decision_values": ["approved", "approved_with_suggestions", "changes_required", "rejected"]
  }
}
```

**What coordinator passes to agent:**

```json
{
  "assignment_path": ".agents/session-{id}/assignments/03-reviewer-review-LIN-123.json",
  "summary": "Review implementation of auth middleware",
  "expected_result_path": ".agents/session-{id}/results/03-reviewer-review-LIN-123.json"
}
```

### Knowledge Synthesis Assignment

**File location:** `.agents/session-{id}/assignments/{seq}-synthesizer-synthesis-{issue}.json`

```json
{
  "assignment_type": "knowledge_synthesis",
  "parent_issue_id": "LIN-100",
  "project_summary": "Brief project description",
  "completion_status": "delivered",
  "data": {
    "sub_issues": ["LIN-101", "LIN-102", "LIN-103"],
    "result_files": [
      ".agents/session-{id}/results/02-engineer-implementation-LIN-101.json",
      ".agents/session-{id}/results/04-engineer-implementation-LIN-102.json",
      ".agents/session-{id}/results/06-engineer-implementation-LIN-103.json"
    ],
    "review_files": [
      ".agents/session-{id}/results/03-reviewer-review-LIN-101.json",
      ".agents/session-{id}/results/05-reviewer-review-LIN-102.json",
      ".agents/session-{id}/results/07-reviewer-review-LIN-103.json"
    ]
  },
  "metrics": {
    "sub_issues_total": 12,
    "sub_issues_first_pass": 7,
    "avg_review_iterations": 1.4,
    "divergences_tracked": 6,
    "blockers_encountered": 2
  },
  "notes": "Notable observations for learning extraction",
  "expected_output": {
    "result_path": ".agents/session-{id}/results/{seq}-synthesizer-synthesis-{issue}.json",
    "format": "knowledge_synthesis_result"
  }
}
```

**What coordinator passes to agent:**

```json
{
  "assignment_path": ".agents/session-{id}/assignments/10-synthesizer-synthesis-LIN-100.json",
  "summary": "Extract learnings from completed project LIN-100",
  "expected_result_path": ".agents/session-{id}/results/10-synthesizer-synthesis-LIN-100.json"
}
```

## Result Formats

All results are written to files. Agents return a lightweight reference, not the full content.

### Implementation Result

**File location:** `.agents/session-{id}/results/{seq}-{role}-implementation-{issue}.json`

Agents write this after completing implementation work:

```json
{
  "result_type": "implementation",
  "issue_id": "LIN-123",
  "status": "complete",
  "summary": "Brief description of what was done",
  "details": {
    "approach": "How the task was accomplished",
    "decisions": ["Key decision made and why"]
  },
  "artifacts": {
    "files_created": ["path/to/new/file.py"],
    "files_modified": ["path/to/changed/file.py"],
    "pr_link": "https://github.com/...",
    "commit": "abc123"
  },
  "divergences": [
    {
      "planned": "What was originally planned",
      "actual": "What was actually done",
      "rationale": "Why the change was made",
      "impact": "Effect on scope/timeline"
    }
  ],
  "blockers": [],
  "follow_up_needed": ["Any items requiring future attention"]
}
```

**What agent returns to coordinator:**

```json
{
  "result_path": ".agents/session-{id}/results/02-engineer-implementation-LIN-123.json",
  "result_type": "implementation",
  "status": "complete",
  "summary": "Successfully implemented auth middleware in 3 files",
  "requires_attention": false,
  "timestamp": "2024-12-10T14:35:22Z"
}
```

### Planning Result

**File location:** `.agents/session-{id}/results/{seq}-architect-planning-{issue}.json`

Architects write this after creating implementation plans:

```json
{
  "result_type": "planning",
  "issue_id": "LIN-100",
  "plan": {
    "approach": "High-level implementation strategy",
    "rationale": "Why this approach was chosen"
  },
  "sub_tasks": [
    {
      "task": "Task title",
      "description": "What this task accomplishes",
      "acceptance_criteria": ["Criterion 1", "Criterion 2"],
      "dependencies": ["Other task IDs"],
      "estimate": "S/M/L",
      "technical_notes": "Implementation hints"
    }
  ],
  "dependencies": {
    "external": ["External system dependencies"],
    "internal": ["Task dependency graph"]
  },
  "risks": [
    {
      "risk": "What could go wrong",
      "likelihood": "low/medium/high",
      "mitigation": "How to address it"
    }
  ],
  "open_questions": ["Questions needing clarification"]
}
```

**What agent returns to coordinator:**

```json
{
  "result_path": ".agents/session-{id}/results/01-architect-planning-LIN-100.json",
  "result_type": "planning",
  "status": "complete",
  "summary": "Planned microservices approach with 3 main components and 8 sub-tasks",
  "requires_attention": true,
  "attention_reason": "2 open questions need user input",
  "timestamp": "2024-12-10T14:25:15Z"
}
```

### Review Result

**File location:** `.agents/session-{id}/results/{seq}-reviewer-review-{issue}.json`

Reviewers write this after evaluating work:

```json
{
  "result_type": "review",
  "issue_id": "LIN-123",
  "decision": "approved_with_suggestions",
  "summary": "Overall assessment in 1-2 sentences",
  "criteria_assessment": [
    {
      "criterion": "Original acceptance criterion",
      "met": true,
      "notes": "How it was met or why not"
    }
  ],
  "feedback": [
    {
      "type": "required_change|suggestion|praise",
      "severity": "critical|major|minor|info",
      "location": "file:line or general",
      "description": "What the feedback is about",
      "suggestion": "How to address it"
    }
  ],
  "follow_up": {
    "requires_re_review": false,
    "items": ["Any follow-up items"]
  }
}
```

**What agent returns to coordinator:**

```json
{
  "result_path": ".agents/session-{id}/results/03-reviewer-review-LIN-123.json",
  "result_type": "review",
  "decision": "approved_with_suggestions",
  "summary": "Code meets all criteria with 3 minor suggestions for improvement",
  "requires_attention": false,
  "timestamp": "2024-12-10T14:45:30Z"
}
```

### Knowledge Synthesis Result

**File location:** `.agents/session-{id}/results/{seq}-synthesizer-synthesis-{issue}.json`

Knowledge synthesizer writes this after extracting learnings:

```json
{
  "result_type": "knowledge_synthesis",
  "parent_issue_id": "LIN-100",
  "learnings": [
    {
      "learning_id": "learning-auth-001",
      "category": "best-practice|gotcha|process-improvement|anti-pattern",
      "scope": "global|project-specific",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the learning",
      "source_issues": ["LIN-102", "LIN-105"],
      "applies_to": ["relevant-tags"],
      "confidence": "high|medium|low"
    }
  ],
  "patterns": {
    "divergence_themes": ["Common divergence patterns"],
    "review_feedback_themes": ["Common review issues"],
    "success_factors": ["What worked well"]
  },
  "recommendations": [
    "Suggestions for future projects"
  ]
}
```

**What agent returns to coordinator:**

```json
{
  "result_path": ".agents/session-{id}/results/10-synthesizer-synthesis-LIN-100.json",
  "result_type": "knowledge_synthesis",
  "status": "complete",
  "summary": "Extracted 5 learnings from project, identified 3 recurring patterns",
  "requires_attention": false,
  "timestamp": "2024-12-10T15:00:45Z"
}
```

## Phase Transition Patterns

Phase transitions use file references to maintain minimal context.

### Planning → Execution

**File location:** `.agents/session-{id}/metadata.json` (updated with transition info)

```json
{
  "transition": "planning_to_execution",
  "parent_issue": "LIN-100",
  "planning_result_path": ".agents/session-{id}/results/01-architect-planning-LIN-100.json",
  "planning_summary": {
    "approach": "Chosen implementation approach",
    "sub_tasks_count": 8,
    "dependency_order": ["task-1", "task-2", "task-3"],
    "key_decisions": ["Decision 1", "Decision 2"]
  },
  "execution_inputs": {
    "first_task": "task-1",
    "loaded_learnings_count": 3,
    "risk_mitigations": ["Mitigation to keep in mind"]
  }
}
```

### Execution → Completion

```json
{
  "transition": "execution_to_completion",
  "parent_issue": "LIN-100",
  "execution_summary": {
    "sub_tasks_completed": 8,
    "result_files": [
      ".agents/session-{id}/results/02-engineer-implementation-task-1.json",
      ".agents/session-{id}/results/04-engineer-implementation-task-2.json"
      // ... more files
    ],
    "total_divergences": 2,
    "avg_review_iterations": 1.3,
    "blockers_resolved": 1
  },
  "completion_inputs": {
    "artifacts_to_link": ["PR links", "Doc links"],
    "divergences_summary": "2 minor scope adjustments",
    "learnings_ready": true
  }
}
```

## Error Escalation Format

When agents encounter issues they can't resolve, they write an escalation file.

**File location:** `.agents/session-{id}/escalations/{seq}-{agent-role}-escalation-{issue}.json`

```json
{
  "escalation_type": "blocker|clarification|scope_change",
  "issue_id": "LIN-123",
  "assignment_path": ".agents/session-{id}/assignments/02-engineer-implementation-LIN-123.json",
  "context": {
    "task": "What was being attempted",
    "progress": "How far work got before the issue"
  },
  "issue": {
    "description": "What the problem is",
    "attempted_solutions": ["What was tried"],
    "root_cause": "Best understanding of why this is happening"
  },
  "request": {
    "type": "decision|information|reassignment",
    "options": ["Option 1", "Option 2"],
    "recommendation": "Suggested path forward"
  }
}
```

**What agent returns to coordinator:**

```json
{
  "status": "blocked",
  "escalation_path": ".agents/session-{id}/escalations/02-engineer-escalation-LIN-123.json",
  "escalation_type": "blocker",
  "summary": "Cannot proceed: missing database credentials",
  "requires_attention": true,
  "timestamp": "2024-12-10T14:40:00Z"
}
```

## Session Metadata

Every session maintains a metadata file for tracking workflow state.

**File location:** `.agents/session-{id}/metadata.json`

```json
{
  "session_id": "session-20241210-143022-implement-auth",
  "workflow_type": "implement|linear-orchestrator",
  "created_at": "2024-12-10T14:30:22Z",
  "updated_at": "2024-12-10T15:00:45Z",
  "status": "active|completed|failed|abandoned",
  "parent_issue": "LIN-100",
  "feature_name": "User authentication system",
  "phases": {
    "current_phase": "execution",
    "completed_phases": ["requirements", "design", "planning"],
    "phase_transitions": [
      {
        "from": "planning",
        "to": "execution",
        "timestamp": "2024-12-10T14:35:00Z"
      }
    ]
  },
  "agents": {
    "assignments_count": 8,
    "results_count": 7,
    "escalations_count": 0,
    "active_agent": "engineer"
  },
  "task_tracking": [
    {
      "sequence": 1,
      "agent_role": "architect",
      "assignment_type": "planning",
      "issue_id": "LIN-100",
      "assignment_path": ".agents/session-{id}/assignments/01-architect-planning-LIN-100.json",
      "result_path": ".agents/session-{id}/results/01-architect-planning-LIN-100.json",
      "status": "complete",
      "started_at": "2024-12-10T14:30:30Z",
      "completed_at": "2024-12-10T14:32:15Z"
    }
    // ... more tasks
  ],
  "metrics": {
    "total_tasks": 8,
    "completed_tasks": 7,
    "review_iterations": 1.2,
    "divergences_count": 2
  }
}
```

This file provides a complete audit trail and allows coordinators to quickly understand session state without loading all individual files.

## Validation

### Before Sending to Agent

- ✅ Assignment file written successfully
- ✅ Expected result path specified
- ✅ Issue ID valid (if using Linear)
- ✅ Acceptance criteria are testable
- ✅ Context is focused and relevant
- ✅ File reference passed to agent (not full content)

### After Receiving from Agent

- ✅ Result file exists at expected path
- ✅ Result reference includes required fields (path, status, summary)
- ✅ Status value is valid
- ✅ Timestamp present
- ✅ Only load full result when needed for decision-making

### When Validation Fails

1. Log the malformed response
2. Request clarification with specific issue
3. Provide format example
4. Track as communication round

## Error Handling

### When agent returns "blocked" or "needs_clarification"

1. Agent writes escalation file to `.agents/session-{id}/escalations/`
2. Agent returns reference with `status: "blocked"` and escalation path
3. Coordinator loads escalation file only when deciding how to proceed
4. Switch to Recovery Mode (if in orchestration)
5. Diagnose the blocker
6. Provide additional context or escalate to user
7. Track resolution for learning

### When format is incorrect

1. Don't proceed with invalid data
2. Ask agent to reformat with specific guidance
3. If repeated failures, reassess task assignment

### When file operations fail

1. Check file path correctness
2. Verify `.agents/` directory exists and is writable
3. Ensure session directory was created properly
4. Log error with full context for debugging

## Communication Efficiency

### Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Coordinator context size | <10K tokens | >20K tokens |
| File reference size | <100 tokens | >200 tokens |
| Communication rounds | 1-2 per issue | >3 rounds |
| Clarification rate | <10% | >20% |
| Format violations | 0% | Any |
| Full file loads | <30% of results | >60% of results |

### Red Flags to Watch

- >3 communication rounds for single issue
- Agents requesting information already in assignment files
- Frequent format violations
- Coordinator context consistently >20K tokens
- Repeated need for clarification
- Loading full results when summary or grep search would suffice

### Context Efficiency Benefits

**Traditional approach (stdout):**
- 10 agents × 3K tokens/result = 30K tokens in coordinator context

**File-based approach:**
- 10 agents × 100 tokens/reference = 1K tokens in coordinator context
- 29K token savings (97% reduction!)
- Load full files only when decisions require detailed information

## Best Practices

### Do

- ✅ Always write assignments to files before passing to agents
- ✅ Always write results to files before returning to coordinator
- ✅ Pass file paths and summaries, not full content
- ✅ Create session directories at workflow start
- ✅ Use consistent naming conventions for files
- ✅ Include timestamps in all result references
- ✅ Specify expected result paths in assignments
- ✅ Load full files only when needed for decisions
- ✅ Update metadata.json throughout workflow
- ✅ Be explicit about scope boundaries in assignments
- ✅ Provide 2-3 relevant learnings maximum in assignment files
- ✅ Include issue IDs for traceability
- ✅ Reference other result files when context is needed
- ✅ Keep result summaries concise (1-2 sentences)
- ✅ Set `requires_attention` flag when coordinator action needed

### Don't

- ❌ Pass full JSON in stdout/stdin (use file references)
- ❌ Load full result files unless decision requires details
- ❌ Include full file contents in assignments (use paths)
- ❌ Send entire project history
- ❌ Leave expected result paths unspecified
- ❌ Assign multiple unrelated tasks in one file
- ❌ Use inconsistent status values
- ❌ Omit acceptance criteria from assignments
- ❌ Proceed with invalid agent responses
- ❌ Store sensitive information in plain text files
- ❌ Forget to create `.agents/` directory structure
- ❌ Skip updating metadata.json

### File Loading Strategy

**Always load:**
- Current task assignment (agent needs full context)
- Escalations (coordinator must understand blockers)

**Load on demand:**
- Previous task results (only if current task depends on them)
- Review feedback (only if rework is needed)
- Planning details (only when making implementation decisions)

**Never load:**
- Completed task results from unrelated features
- Historical results unless specifically referenced
- Metadata files from other sessions

## Practical Implementation Examples

### Example 1: Coordinator Assigns Task to Engineer

```bash
# 1. Create session
context_handoff.py create-session implement-auth

# 2. Create assignment JSON
cat > assignment.json << 'EOF'
{
  "assignment_type": "implementation",
  "issue_id": "LIN-123",
  "task": {
    "summary": "Add rate limiting to authentication endpoint",
    "description": "Implement Redis-based rate limiting with 5 requests per minute"
  },
  "acceptance_criteria": [
    "Rate limiting applied to /auth/login endpoint",
    "Returns 429 status when limit exceeded",
    "Rate limit info included in response headers"
  ],
  "relevant_context": {
    "files": ["src/api/auth.py", "src/middleware/rate_limit.py"],
    "reference_files": [
      ".agents/session-20241210-140000/results/01-architect-planning-LIN-120.json"
    ]
  },
  "expected_output": {
    "result_path": ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json",
    "format": "implementation_result",
    "required_fields": ["status", "summary", "artifacts"]
  }
}
EOF

# 3. Write validated assignment
context_handoff.py write assignment assignment.json \
  .agents/session-20241210-143022/assignments/02-engineer-implementation-LIN-123.json

# 4. Pass reference to agent (lightweight - just path and summary)
echo '{
  "assignment_path": ".agents/session-20241210-143022/assignments/02-engineer-implementation-LIN-123.json",
  "summary": "Implement rate limiting on auth endpoint",
  "expected_result_path": ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json"
}' | spawn_agent data-infra-engineer
```

### Example 2: Agent Reads Assignment and Returns Result

```bash
# Agent receives reference
# {
#   "assignment_path": ".agents/.../assignments/02-engineer-implementation-LIN-123.json",
#   "summary": "Implement rate limiting on auth endpoint",
#   "expected_result_path": ".agents/.../results/02-engineer-implementation-LIN-123.json"
# }

# Agent validates and loads assignment
context_handoff.py validate assignment \
  .agents/session-20241210-143022/assignments/02-engineer-implementation-LIN-123.json

# Agent does work...
# ... implementation happens ...

# Agent creates result JSON
cat > result.json << 'EOF'
{
  "result_type": "implementation",
  "issue_id": "LIN-123",
  "status": "complete",
  "summary": "Rate limiting implemented using Redis with configurable thresholds",
  "details": {
    "approach": "Used Redis sorted sets for sliding window rate limiting",
    "decisions": ["Chose sliding window over fixed window for smoother limits"]
  },
  "artifacts": {
    "files_modified": ["src/api/auth.py", "src/middleware/rate_limit.py"],
    "files_created": ["tests/test_rate_limit.py"],
    "commit": "abc123def"
  },
  "divergences": [],
  "blockers": []
}
EOF

# Agent writes validated result
context_handoff.py write result result.json \
  .agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json

# Agent returns reference only (not full result)
echo '{
  "result_path": ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json",
  "result_type": "implementation",
  "status": "complete",
  "summary": "Rate limiting implemented using Redis with configurable thresholds",
  "requires_attention": false,
  "timestamp": "2024-12-10T14:35:22Z"
}'
```

### Example 3: Coordinator Maintains Minimal Context

```bash
# Coordinator working state (stays small!)
# Store only references, not full results

cat > workflow_state.json << 'EOF'
{
  "session_id": "session-20241210-143022-implement-auth",
  "current_phase": "implementation",
  "tasks": {
    "task_01": {
      "result_path": ".agents/session-20241210-143022/results/01-architect-planning-LIN-120.json",
      "summary": "Planned auth system with 5 sub-tasks",
      "status": "complete",
      "loaded": false
    },
    "task_02": {
      "result_path": ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json",
      "summary": "Rate limiting implemented using Redis",
      "status": "complete",
      "loaded": false
    }
  }
}
EOF

# Only load full result when needed for decision
if user_asks_about_task_02; then
  context_handoff.py validate result \
    .agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json
  # Now have full details for answering user question
fi
```

### Example 4: Agent References Previous Work

```bash
# Assignment includes reference to previous result
cat > assignment.json << 'EOF'
{
  "assignment_type": "implementation",
  "issue_id": "LIN-125",
  "task": {
    "summary": "Add rate limit monitoring dashboard"
  },
  "relevant_context": {
    "reference_files": [
      ".agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json"
    ],
    "learnings": ["Rate limiting uses Redis sorted sets, check implementation for key structure"]
  }
}
EOF

# Agent can load referenced result when needed
context_handoff.py validate result \
  .agents/session-20241210-143022/results/02-engineer-implementation-LIN-123.json
# Now can read previous work to understand rate limiting implementation
```

## Summary

**Key Takeaway:** File-based communication dramatically reduces coordinator context usage (from 30K+ tokens to <2K tokens for 10 agent interactions) while providing complete audit trails, debugging capability, and recovery resilience.

**Implementation checklist:**
1. ✅ Create `.agents/session-{id}/` directories at workflow start
2. ✅ Write all assignments to `assignments/` subdirectory
3. ✅ Write all results to `results/` subdirectory  
4. ✅ Pass file paths + summaries between agents, not full content
5. ✅ Load full files only when decisions require details
6. ✅ Maintain `metadata.json` for session tracking
7. ✅ Use consistent naming conventions
8. ✅ Add `.agents/` to `.gitignore` for ephemeral sessions
