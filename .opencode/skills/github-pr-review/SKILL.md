---
name: review-pr
description: Review GitHub PRs for correctness, cleanliness, security, and best practices. Use when asked to review a PR, check a pull request, or provide code review feedback on GitHub. Triggers on requests like "review PR #123", "check this pull request", or "review https://github.com/org/repo/pull/123".
---

# PR Review Skill

Review GitHub pull requests systematically for correctness, cleanliness, security, and adherence to best practices. Provide specific, actionable feedback with file locations.

## Prerequisites

- For Python code: Load the `python-best-practices` skill for language-specific standards

## Review Workflow

### 1. Gather PR Context

```bash
# Get PR details and diff
gh pr view <PR_NUMBER> --json title,body,files,additions,deletions,author
gh pr diff <PR_NUMBER>

# View specific file changes
gh pr diff <PR_NUMBER> -- path/to/file.py

# Check PR status and reviews
gh pr checks <PR_NUMBER>
gh pr view <PR_NUMBER> --json reviews,reviewRequests
```

### 2. Understand the Change

Before reviewing code:
- Read PR title and description to understand intent
- If a linear issue number is linked in the PR, retrieve and understand the content of the issue and issue type, and how it motivates the PR, using the Linear MCP server linear2:get_issue to retreive the issue content
- Identify the type of change (feature, bugfix, refactor, etc.)
- Note any linked issues or acceptance criteria
- Review the scope of files changed

### 3. Execute Review Checklist

#### Code Correctness
- [ ] Logic implements stated requirements
- [ ] Edge cases handled appropriately
- [ ] Error handling is comprehensive
- [ ] No off-by-one errors or boundary issues
- [ ] Null/undefined values handled correctly

#### Code Cleanliness
- [ ] Single responsibility per function/class
- [ ] Clear, descriptive naming conventions
- [ ] No code duplication (DRY)
- [ ] Appropriate abstraction levels
- [ ] No dead code or commented-out blocks
- [ ] No extraneous code unused outside tests

#### Security Review
- [ ] Input validation on external data
- [ ] No injection vulnerabilities (SQL, command, XSS)
- [ ] Authentication/authorization checks present
- [ ] Sensitive data not logged or exposed
- [ ] No hardcoded secrets or credentials
- [ ] Dependencies free of known vulnerabilities

#### Performance
- [ ] Algorithm efficiency appropriate for scale
- [ ] No N+1 query patterns
- [ ] Resource cleanup (connections, handles, memory)
- [ ] Async patterns used correctly
- [ ] No unnecessary network/disk calls

#### Test Coverage
- [ ] Tests cover the changed functionality
- [ ] Edge cases have test coverage
- [ ] Tests are meaningful (not testing language features)
- [ ] Test isolation maintained
- [ ] No flaky test patterns

#### Architecture & Design
- [ ] Changes follow existing codebase patterns
- [ ] SOLID principles respected
- [ ] Dependencies injected, not hardcoded
- [ ] Public/private boundaries clear
- [ ] No unnecessary coupling introduced

### 4. Provide Feedback

Structure feedback by priority:

**Required Changes** (blocking):
- Security vulnerabilities
- Correctness bugs
- Breaking changes without migration
- Missing critical error handling

**Suggestions** (non-blocking):
- Code style improvements
- Performance optimizations
- Better naming choices
- Refactoring opportunities

### 5. Submit Review

```bash
# Approve PR
gh pr review <PR_NUMBER> --approve --body "LGTM! [optional comments]"

# Request changes
gh pr review <PR_NUMBER> --request-changes --body "$(cat <<'EOF'
## Required Changes

### Security Issue
**File:** `src/api/auth.py:45`
**Issue:** SQL injection vulnerability in user lookup
**Fix:** Use parameterized queries instead of string interpolation

### Bug
**File:** `src/utils/parser.py:123-130`
**Issue:** Off-by-one error in boundary check
**Fix:** Change `< len(items)` to `<= len(items)`

## Suggestions

- Consider extracting the validation logic in `handler.py:89` to a separate function
- The retry loop in `client.py:200` could use exponential backoff
EOF
)"

# Comment without approval decision
gh pr review <PR_NUMBER> --comment --body "Some questions about the approach..."
```

## Feedback Format

Always include:
1. **File path and line number**: `src/module/file.py:123`
2. **Clear issue description**: What's wrong and why
3. **Specific fix suggestion**: How to resolve it

Example:
```
**File:** `src/handlers/user.py:45-52`
**Issue:** Catching broad `Exception` swallows errors silently
**Fix:** Catch specific exceptions (`ValueError`, `KeyError`) and let others propagate
```

## Review Scope Discipline

**DO:**
- Review against PR description and linked issues
- Check code quality, security, and test coverage
- Distinguish required changes from suggestions
- Note good practices for team learning

**DO NOT:**
- Suggest features not in PR scope
- Request refactoring beyond the change
- Fail review for style preferences not in team standards
- Add "while you're at it" requests

Out-of-scope improvements should be noted as low-priority suggestions with recommendation to create follow-up issues.

## Language-Specific Reviews

For Python code, load the `python-best-practices` skill and verify:
- Type hints on public functions using built-in types
- Absolute imports at module top
- Dataclasses/Pydantic for structured data
- Google-style docstrings on public methods
- No `typing.List/Dict/Set` imports
- Exceptions bubble up (no silent catches)
