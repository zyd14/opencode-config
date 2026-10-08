#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "jsonschema>=4.20.0",
# ]
# ///

"""Test validation - this should fail with clear error messages."""

from context_handoff import write_assignment


# Missing required field (acceptance_criteria)
invalid_assignment = {
    "assignment_type": "implementation",
    "issue_id": "LIN-123",
    "task": {
        "summary": "Do something"
    },
    # Missing: acceptance_criteria
    "expected_output": {
        "result_path": ".agents/session-x/results/01.json",
        "format": "implementation_result",
        "required_fields": ["status"]
    }
}

try:
    write_assignment(".agents/test-invalid.json", invalid_assignment)
    print("❌ Should have failed validation!")
except Exception as e:
    print("✅ Validation caught error (as expected):")
    print(f"   {type(e).__name__}: {e}")
