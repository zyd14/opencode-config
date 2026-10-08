---
name: implementation-planning
description: Patterns for breaking down features into implementable tasks. Covers task decomposition, dependency mapping, acceptance criteria generation, and estimation - applicable with or without Linear integration. Use when developing a solution or implementation plan for a problem or issue.
allowed-tools: Bash, Edit, Write, NotebookEdit, Skill, SlashCommand, Glob, Grep, Read, WebFetch, TodoWrite, WebSearch, BashOutput, mcp__ide__getDiagnostics, mcp__context7__resolve-library-id, mcp__context7__get-library-docs, mcp__memory2__create_entities, mcp__memory2__create_relations, mcp__memory2__add_observations, mcp__memory2__read_graph, mcp__memory2__search_nodes, mcp__memory2__open_nodes
---

# Implementation Planning Skill

This skill provides patterns for decomposing features and projects into well-structured, implementable tasks. Good planning reduces implementation friction, prevents scope creep, and enables effective coordination.

## When to Use This Skill

- Breaking down a new feature into tasks
- Creating implementation plans from requirements
- Defining acceptance criteria for work items
- Mapping dependencies between tasks
- Estimating effort and identifying risks

## Core Principles

1. **Atomic tasks** - Each task is completable in one focused session
2. **Clear boundaries** - Explicit scope for each task
3. **Testable criteria** - Every task has verifiable "done" conditions
4. **Dependency awareness** - Understand what blocks what
5. **Right-sized** - Not too big (hard to track), not too small (overhead)

## Task Decomposition Process

### Step 1: Understand the Objective

Before decomposing, clearly articulate:

```markdown
## Objective Analysis

**What:** [One sentence describing the feature/change]
**Why:** [Business/technical reason this is needed]
**Who:** [Who benefits from this]
**Success looks like:** [How we know it's done and working]
```

### Step 2: Identify Components

Break the objective into logical components:

```markdown
## Component Breakdown

1. **Data Layer**
   - What data structures are needed?
   - What storage/persistence changes?
   - What migrations required?

2. **Business Logic**
   - What new functions/methods?
   - What existing code needs modification?
   - What validation rules?

3. **Interface/API**
   - What endpoints/commands?
   - What input/output formats?
   - What error responses?

4. **Integration**
   - What external systems involved?
   - What internal services affected?
   - What configuration needed?

5. **Testing**
   - What test types needed?
   - What edge cases to cover?
   - What test data required?

6. **Documentation**
   - What user-facing docs?
   - What technical docs?
   - What inline documentation?
```

### Step 3: Create Task Graph

Map components to tasks with dependencies:

```
┌─────────────┐
│ Data Models │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  DB Schema  │────▶│  Migration  │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│Business Logic│
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  API Layer  │────▶│   Tests     │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│ Integration │     │    Docs     │
└─────────────┘     └─────────────┘
```

## Task Sizing Guidelines

### Size Definitions

| Size | Time Estimate | Complexity | Example |
|------|---------------|------------|---------|
| **XS** | < 1 hour | Trivial change | Config update, typo fix |
| **S** | 1-4 hours | Single file, clear scope | Add validation, new util function |
| **M** | 4-8 hours | Multiple files, some decisions | New endpoint, service method |
| **L** | 1-2 days | Cross-cutting, design needed | New feature component |
| **XL** | 2+ days | **Should be decomposed further** | - |

### Decomposition Triggers

If a task has any of these, break it down:

- ❌ More than 5 acceptance criteria
- ❌ Touches more than 3 unrelated areas
- ❌ Has internal "phases" or "steps"
- ❌ Would take more than 2 days
- ❌ Has multiple distinct deliverables

## Acceptance Criteria Patterns

### Good Acceptance Criteria

Each criterion should be:
- **Specific** - No ambiguity about what's required
- **Testable** - Can verify pass/fail
- **Independent** - Doesn't depend on other criteria
- **Complete** - Together they define "done"

### Criteria Templates

**For API/Function tasks:**
```markdown
- [ ] Function `validate_user(user_id)` exists and is exported
- [ ] Returns `True` for valid user IDs matching pattern `^USR-\d{6}$`
- [ ] Returns `False` for invalid/malformed user IDs
- [ ] Raises `UserNotFoundError` for valid format but non-existent user
- [ ] Handles `None` input gracefully (returns `False`)
```

**For Data/Schema tasks:**
```markdown
- [ ] New `user_preferences` table created with columns: id, user_id, preference_key, preference_value, created_at, updated_at
- [ ] Foreign key constraint to `users` table on `user_id`
- [ ] Unique constraint on (`user_id`, `preference_key`)
- [ ] Migration is reversible
- [ ] Existing data is preserved (no destructive changes)
```

**For Integration tasks:**
```markdown
- [ ] Service authenticates with external API using configured credentials
- [ ] Retry logic handles transient failures (3 retries, exponential backoff)
- [ ] Circuit breaker opens after 5 consecutive failures
- [ ] Responses are cached for 5 minutes
- [ ] Errors are logged with correlation ID for debugging
```

**For UI/UX tasks:**
```markdown
- [ ] Component renders without errors in all supported browsers
- [ ] Loading state displayed while data fetches
- [ ] Error state displayed with retry option on failure
- [ ] Empty state displayed when no data available
- [ ] Responsive layout works at mobile/tablet/desktop breakpoints
```

## Dependency Mapping

### Dependency Types

| Type | Symbol | Meaning |
|------|--------|---------|
| **Blocks** | `→` | Must complete before |
| **Soft dependency** | `⇢` | Should complete before, but not required |
| **Parallel** | `‖` | Can be done simultaneously |
| **Related** | `~` | Affects same area, coordinate |

### Dependency Documentation

```markdown
## Task Dependencies

### LIN-101: Create data models
- Blocks: LIN-102, LIN-103
- Parallel with: LIN-104 (documentation)

### LIN-102: Implement business logic
- Blocked by: LIN-101
- Blocks: LIN-103
- Related: LIN-105 (same module)

### LIN-103: Build API endpoints
- Blocked by: LIN-101, LIN-102
- Parallel with: LIN-106 (tests can start with mocks)
```

### Critical Path Identification

The critical path is the longest chain of dependent tasks:

```markdown
## Critical Path Analysis

**Critical path:** LIN-101 → LIN-102 → LIN-103 → LIN-107
**Total estimated time:** 3 days
**Parallel work possible:** LIN-104, LIN-105, LIN-106

**Recommendation:** Start LIN-101 immediately, parallelize documentation and test scaffolding.
```

## Risk Assessment

### Risk Categories

| Category | Examples |
|----------|----------|
| **Technical** | Unknown API behavior, performance concerns, complex algorithms |
| **Integration** | External service reliability, version compatibility |
| **Scope** | Unclear requirements, potential feature creep |
| **Resource** | Skills gap, availability constraints |
| **Timeline** | Dependencies on other teams, hard deadlines |

### Risk Documentation Format

```markdown
## Risk: [Risk Name]

**Category:** Technical
**Likelihood:** Medium
**Impact:** High
**Description:** [What could go wrong]

**Indicators:** 
- [Early warning sign 1]
- [Early warning sign 2]

**Mitigation:**
- [Preventive action 1]
- [Preventive action 2]

**Contingency:**
- [If it happens, do this]
```

## Plan Output Format

### Complete Implementation Plan

```markdown
# Implementation Plan: [Feature Name]

## Overview
**Objective:** [What we're building]
**Approach:** [High-level implementation strategy]
**Estimated effort:** [Total estimate]
**Critical path:** [Longest dependency chain]

## Sub-tasks

### 1. [Task Title] (Size: M)
**Description:** [What this task accomplishes]
**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

**Dependencies:** None (starting point)
**Technical Notes:** [Implementation hints]

### 2. [Task Title] (Size: S)
**Description:** [What this task accomplishes]
**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

**Dependencies:** Task 1
**Technical Notes:** [Implementation hints]

[... additional tasks ...]

## Dependency Graph
[Visual or textual representation]

## Risks
1. [Risk 1 with mitigation]
2. [Risk 2 with mitigation]

## Open Questions
- [Question needing clarification before/during implementation]
```

## Best Practices

### Do

- ✅ Start with the objective, not the solution
- ✅ Make tasks independently verifiable
- ✅ Include "what" and "why" in task descriptions
- ✅ Size tasks for single-session completion
- ✅ Identify the critical path early
- ✅ Document assumptions and decisions

### Don't

- ❌ Create tasks without acceptance criteria
- ❌ Let tasks grow beyond "L" size
- ❌ Hide dependencies in task descriptions
- ❌ Assume implementation approach is obvious
- ❌ Skip risk assessment for "simple" features
- ❌ Plan too far ahead with uncertain requirements

## Integration Notes

This skill works well with:

- **linear-operations** - Creating issues from the plan
- **context-handoff** - Passing the plan to implementation agents
- **code-review-patterns** - Using acceptance criteria for review focus
