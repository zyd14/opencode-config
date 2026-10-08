# Context Handoff Skill - Validation Utilities

This directory contains the context-handoff skill with JSON schema validation.

## Files

- **`SKILL.md`** - Complete specification of file-based agent communication patterns
- **`reference.md`** - Quick reference guide for agents
- **`context_handoff.py`** - UV script with validation utilities
- **`schemas/`** - JSON schemas for all message types
- **`example.py`** - Working example demonstrating the full workflow
- **`test_validation.py`** - Validation error handling examples

## Quick Start

### 1. Create a Session

```bash
uv run context_handoff.py create-session my-workflow
```

This creates:
```
.agents/session-{timestamp}-my-workflow/
  ├── assignments/
  ├── results/
  ├── escalations/
  └── metadata.json
```

### 2. Write Validated Files

**The preferred way to create files - validates BEFORE writing to disk:**

```bash
# Write from a file (validates then writes)
uv run context_handoff.py write assignment my-assignment.json .agents/session-x/assignments/01.json

# Write from stdin (useful for programmatic generation)
cat my-assignment.json | uv run context_handoff.py write assignment - .agents/session-x/assignments/01.json

# Write result
uv run context_handoff.py write result my-result.json .agents/session-x/results/01.json

# Invalid files are rejected before writing
uv run context_handoff.py write assignment invalid.json .agents/session-x/assignments/bad.json
# ❌ Validation failed - file NOT written
```

### 3. Validate Existing Files

```bash
# Get help
uv run context_handoff.py --help
uv run context_handoff.py write --help
uv run context_handoff.py validate --help
uv run context_handoff.py create-session --help

# Validate an assignment file
uv run context_handoff.py validate assignment .agents/session-x/assignments/01.json

# Validate a result file
uv run context_handoff.py validate result .agents/session-x/results/01.json

# Validate a result reference
uv run context_handoff.py validate result_reference .agents/session-x/results/ref.json

# Create session with custom base directory
uv run context_handoff.py create-session my-workflow --base-dir /custom/path
```

### 4. Use in Python (Alternative to CLI)

**Note:** For most use cases, prefer the CLI `write` command which validates before writing. Use Python API when you need programmatic control.

```python
from context_handoff import (
    write_assignment,
    read_assignment,
    write_result,
    create_result_reference,
    generate_session_id,
    create_session_directory
)

# Create session
session_id = generate_session_id("implement-auth")
session_dir = create_session_directory(session_id)

# Write validated assignment
assignment = {
    "assignment_type": "implementation",
    "issue_id": "LIN-123",
    "task": {"summary": "Implement rate limiting on auth endpoint"},
    "acceptance_criteria": ["Rate limit applied", "Returns 429 on exceed"],
    "expected_output": {
        "result_path": f".agents/{session_id}/results/01.json",
        "format": "implementation_result",
        "required_fields": ["status", "summary"]
    }
}

write_assignment(f".agents/{session_id}/assignments/01.json", assignment)

# Agent reads and validates
assignment = read_assignment(f".agents/{session_id}/assignments/01.json")

# Agent writes result
result = {
    "result_type": "implementation",
    "issue_id": "LIN-123",
    "status": "complete",
    "summary": "Rate limiting implemented successfully",
    # ... more fields
}

write_result(f".agents/{session_id}/results/01.json", result)

# Agent returns lightweight reference
result_ref = create_result_reference(
    result_path=f".agents/{session_id}/results/01.json",
    result_type="implementation",
    status="complete",
    summary="Rate limiting implemented successfully",
    requires_attention=False
)
```

## CLI Commands

### `write` - Validate and Write (Recommended)

**Validates JSON before writing to disk.** Invalid files are rejected and NOT written.

```bash
# Write from file
uv run context_handoff.py write assignment input.json output.json

# Write from stdin
cat data.json | uv run context_handoff.py write result - .agents/session-x/results/01.json

# Don't create parent directories
uv run context_handoff.py write assignment input.json output.json --no-create-dirs
```

**Benefits:**
- ✅ Catches errors before files are created
- ✅ Prevents invalid data from entering the system
- ✅ Clear error messages when validation fails
- ✅ Works with stdin for programmatic use

### `validate` - Validate Existing Files

Check if existing files conform to schemas:

```bash
uv run context_handoff.py validate assignment .agents/session-x/assignments/01.json
```

### `create-session` - Initialize Session Directory

Create the directory structure for a new workflow:

```bash
uv run context_handoff.py create-session workflow-name
uv run context_handoff.py create-session workflow-name --base-dir /custom/path
```

## Examples

### Run the Complete Example

```bash
uv run example.py
```

This demonstrates:
1. Coordinator creating a session and assignment
2. Agent receiving, processing, and writing result
3. Coordinator receiving lightweight reference
4. Context savings calculation (94% reduction!)

### Test Validation

```bash
uv run test_validation.py
```

Shows how validation catches errors with clear messages.

## JSON Schemas

All schemas are in `schemas/`:

- **`assignment.json`** - Task assignments to agents
- **`result.json`** - Full results from agents
- **`result_reference.json`** - Lightweight result references
- **`assignment_reference.json`** - Lightweight assignment references

## Benefits

### 1. Schema Enforcement
- **Validation at write time** catches errors early
- Required fields enforced automatically
- Type checking for all fields
- Format validation (e.g., issue IDs, timestamps)

### 2. Context Reduction
- **94% reduction** in coordinator context usage
- Pass references (~100 tokens) instead of full content (~2500 tokens)
- For 10 agents: ~23K tokens saved!

### 3. Observability
- All communication persisted to files
- Complete audit trail
- Easy debugging and replay
- Can inspect workflow at any point

### 4. Type Safety
- Clear contracts between agents
- IDE autocomplete support
- Prevents common errors

## Integration with Agents

Agents should use these utilities in their implementation:

```python
# At the start of your agent
from context_handoff import read_assignment, write_result, create_result_reference

# Read assignment
assignment = read_assignment(assignment_path)

# Do work...

# Write result
write_result(result_path, result_data)

# Return reference
return create_result_reference(
    result_path=result_path,
    result_type="implementation",
    status="complete",
    summary="Brief outcome description",
    requires_attention=False
)
```

## Dependencies

The UV script automatically manages dependencies:
- `jsonschema>=4.20.0` - JSON schema validation

No manual installation needed - UV handles everything!

## See Also

- **SKILL.md** - Full specification with all patterns and formats
- **reference.md** - Quick reference for common operations
