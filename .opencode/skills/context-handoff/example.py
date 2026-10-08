#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "jsonschema>=4.20.0",
# ]
# ///

"""
Example usage of context_handoff validation utilities.

This demonstrates how coordinators and agents would use the validated
read/write functions in practice.
"""

from pathlib import Path
from context_handoff import (
    write_assignment,
    read_assignment,
    write_result,
    create_result_reference,
    generate_session_id,
    create_session_directory
)


def coordinator_example():
    """Example: Coordinator creates assignment and spawns agent."""
    
    # 1. Create session directory
    session_id = generate_session_id("implement-auth")
    session_dir = create_session_directory(session_id)
    print(f"✅ Created session: {session_id}\n")
    
    # 2. Create assignment
    assignment = {
        "assignment_type": "implementation",
        "issue_id": "LIN-123",
        "task": {
            "summary": "Implement rate limiting on authentication endpoint",
            "description": "Use Redis-based rate limiting with 5 requests per minute threshold"
        },
        "acceptance_criteria": [
            "Rate limiting applied to /auth/login endpoint",
            "Returns 429 status when limit exceeded",
            "Rate limit info included in response headers"
        ],
        "constraints": [
            "Use existing Redis connection pool",
            "Follow middleware pattern in src/middleware/"
        ],
        "relevant_context": {
            "files": ["src/api/auth.py", "src/middleware/rate_limit.py"],
            "learnings": [
                "Redis sorted sets work well for sliding window rate limits",
                "Always include rate limit info in headers for client visibility"
            ]
        },
        "expected_output": {
            "result_path": f".agents/{session_id}/results/01-engineer-implementation-LIN-123.json",
            "format": "implementation_result",
            "required_fields": ["status", "summary", "artifacts"]
        },
        "scope_boundaries": {
            "in_scope": ["Rate limiting for login endpoint", "Error handling for rate limit exceeded"],
            "out_of_scope": ["Rate limiting for other endpoints", "Admin bypass logic"]
        }
    }
    
    # 3. Write validated assignment
    assignment_path = f".agents/{session_id}/assignments/01-engineer-implementation-LIN-123.json"
    write_assignment(assignment_path, assignment)
    print(f"✅ Wrote validated assignment: {assignment_path}")
    
    # 4. Create reference to pass to agent (lightweight)
    assignment_reference = {
        "assignment_path": assignment_path,
        "summary": "Implement rate limiting on auth endpoint",
        "expected_result_path": f".agents/{session_id}/results/01-engineer-implementation-LIN-123.json"
    }
    
    print(f"✅ Pass to agent: {assignment_reference}\n")
    
    return session_id, assignment_path


def agent_example(session_id: str, assignment_path: str):
    """Example: Agent receives assignment, does work, returns result."""
    
    # 1. Agent receives reference (not full assignment)
    print("Agent receives reference (lightweight):")
    print(f"  assignment_path: {assignment_path}")
    print(f"  summary: Implement rate limiting on auth endpoint\n")
    
    # 2. Agent loads full assignment
    assignment = read_assignment(assignment_path)
    print(f"✅ Agent loaded assignment: {assignment['issue_id']}")
    print(f"   Task: {assignment['task']['summary']}")
    print(f"   Criteria: {len(assignment['acceptance_criteria'])} acceptance criteria\n")
    
    # 3. Agent does work (simulated)
    print("🔨 Agent implementing...")
    print("   - Modified src/api/auth.py")
    print("   - Modified src/middleware/rate_limit.py")
    print("   - Created tests/test_rate_limit.py\n")
    
    # 4. Agent writes full result
    result = {
        "result_type": "implementation",
        "issue_id": "LIN-123",
        "status": "complete",
        "summary": "Rate limiting implemented using Redis with configurable thresholds",
        "details": {
            "approach": "Used Redis sorted sets for sliding window rate limiting",
            "decisions": [
                "Chose sliding window over fixed window for smoother rate limiting",
                "Added configurable threshold via environment variable"
            ]
        },
        "artifacts": {
            "files_modified": [
                "src/api/auth.py",
                "src/middleware/rate_limit.py"
            ],
            "files_created": [
                "tests/test_rate_limit.py"
            ],
            "commit": "abc123def456"
        },
        "divergences": [],
        "blockers": [],
        "follow_up_needed": []
    }
    
    result_path = assignment["expected_output"]["result_path"]
    write_result(result_path, result)
    print(f"✅ Agent wrote result: {result_path}\n")
    
    # 5. Agent returns lightweight reference (not full result)
    result_reference = create_result_reference(
        result_path=result_path,
        result_type="implementation",
        status="complete",
        summary="Rate limiting implemented using Redis with configurable thresholds",
        requires_attention=False
    )
    
    print("✅ Agent returns reference (lightweight):")
    print(f"   result_path: {result_reference['result_path']}")
    print(f"   status: {result_reference['status']}")
    print(f"   summary: {result_reference['summary']}")
    print(f"   timestamp: {result_reference['timestamp']}\n")
    
    return result_reference


def coordinator_processes_result(result_reference: dict):
    """Example: Coordinator receives result reference."""
    
    print("Coordinator receives result reference:")
    print(f"  Status: {result_reference['status']}")
    print(f"  Summary: {result_reference['summary']}")
    print(f"  Requires attention: {result_reference['requires_attention']}\n")
    
    # Coordinator only loads full result if needed
    if result_reference['status'] == 'blocked' or result_reference['requires_attention']:
        print("⚠️ Loading full result (blocked or needs attention)")
        full_result = read_result(result_reference['result_path'])
        # ... handle blockers
    else:
        print("✅ No action needed - storing reference in workflow state")
        print("   Full result NOT loaded into context (token savings!)\n")


if __name__ == "__main__":
    print("=" * 70)
    print("CONTEXT HANDOFF VALIDATION EXAMPLE")
    print("=" * 70)
    print()
    
    # Coordinator creates and assigns
    session_id, assignment_path = coordinator_example()
    
    print("-" * 70)
    print()
    
    # Agent receives, works, and returns
    result_reference = agent_example(session_id, assignment_path)
    
    print("-" * 70)
    print()
    
    # Coordinator processes result
    coordinator_processes_result(result_reference)
    
    print("=" * 70)
    print("CONTEXT SAVINGS")
    print("=" * 70)
    print()
    print("Without file-based approach:")
    print("  Coordinator context: ~2500 tokens (full result in context)")
    print()
    print("With file-based approach:")
    print("  Coordinator context: ~150 tokens (only reference in context)")
    print()
    print("  Savings: ~2350 tokens (94% reduction) per agent interaction")
    print("  For 10 agents: ~23K tokens saved!")
    print()
