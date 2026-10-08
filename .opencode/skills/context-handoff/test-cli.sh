#!/usr/bin/env bash
# Integration test for context_handoff.py CLI

set -e

echo "========================================="
echo "Context Handoff CLI Integration Test"
echo "========================================="
echo

# 1. Create session
echo "1. Creating session..."
uv run context_handoff.py create-session test-integration
echo

# 2. Create test assignment JSON
echo "2. Creating test assignment..."
cat > /tmp/test-assignment.json << 'EOF'
{
  "assignment_type": "implementation",
  "issue_id": "TEST-001",
  "task": {
    "summary": "Test assignment for integration testing",
    "description": "This validates the CLI workflow"
  },
  "acceptance_criteria": [
    "Assignment can be written via CLI",
    "Validation happens before writing",
    "Invalid files are rejected"
  ],
  "expected_output": {
    "result_path": ".agents/session-test-integration/results/01.json",
    "format": "implementation_result",
    "required_fields": ["status", "summary", "artifacts"]
  }
}
EOF
echo "✓ Created test assignment JSON"
echo

# 3. Write via CLI
echo "3. Writing validated assignment via CLI..."
uv run context_handoff.py write assignment /tmp/test-assignment.json .agents/session-test-integration/assignments/01.json
echo

# 4. Validate the written file
echo "4. Validating written file..."
uv run context_handoff.py validate assignment .agents/session-test-integration/assignments/01.json
echo

# 5. Test stdin write
echo "5. Testing stdin write..."
cat /tmp/test-assignment.json | uv run context_handoff.py write assignment - .agents/session-test-integration/assignments/02.json
echo

# 6. Test invalid JSON rejection
echo "6. Testing invalid JSON rejection..."
cat > /tmp/test-invalid.json << 'EOF'
{
  "assignment_type": "implementation",
  "issue_id": "TEST-002",
  "task": {
    "summary": "Too short"
  }
}
EOF

if uv run context_handoff.py write assignment /tmp/test-invalid.json .agents/session-test-integration/assignments/invalid.json 2>&1 | grep -q "Validation failed"; then
    echo "✓ Invalid file correctly rejected"
else
    echo "✗ Invalid file should have been rejected!"
    exit 1
fi

# Verify invalid file was NOT created
if [ ! -f .agents/session-test-integration/assignments/invalid.json ]; then
    echo "✓ Invalid file was NOT written to disk"
else
    echo "✗ Invalid file should NOT exist!"
    exit 1
fi
echo

# 7. Clean up
echo "7. Cleaning up..."
rm -rf .agents/session-test-integration /tmp/test-assignment.json /tmp/test-invalid.json
echo "✓ Cleanup complete"
echo

echo "========================================="
echo "✅ All tests passed!"
echo "========================================="
