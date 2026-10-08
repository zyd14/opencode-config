# Task Sizing Reference Guide

## Size Definitions

| Size | Time | Complexity | Files | Criteria |
|------|------|------------|-------|----------|
| **XS** | < 1 hour | Trivial | 1 | 1-2 |
| **S** | 1-4 hours | Low | 1-2 | 2-3 |
| **M** | 4-8 hours | Medium | 2-4 | 3-4 |
| **L** | 1-2 days | High | 4-6 | 4-5 |
| **XL** | 2+ days | **Break it down** | - | - |

## Size Examples

### XS - Trivial Changes
- Update configuration value
- Fix typo in documentation
- Add missing import
- Update version number

### S - Small, Focused Changes
- Add input validation to existing function
- Create new utility function
- Add test cases for edge conditions
- Update error messages

### M - Medium, Multi-file Changes
- Implement new API endpoint
- Add new service method with tests
- Refactor function with dependencies
- Create new data model with migration

### L - Large, Cross-cutting Changes
- Implement new feature module
- Major refactoring effort
- Add new integration with external service
- Implement complex algorithm

### XL - Should Be Decomposed
- "Implement authentication system" → Multiple L/M tasks
- "Build admin dashboard" → Multiple features
- "Migrate to new framework" → Phased approach

## Decomposition Triggers

Break down a task if it has:

| Trigger | Why |
|---------|-----|
| > 5 acceptance criteria | Too many concerns in one task |
| > 3 unrelated areas | Loss of focus |
| Internal "phases" | Actually multiple tasks |
| > 2 days estimate | Hard to track progress |
| Multiple deliverables | Should be separate tasks |
| "and" in title | Two tasks masquerading as one |

## Right-sizing Questions

1. Can one person complete this in one sitting?
2. Is there a clear, single definition of "done"?
3. Can progress be meaningfully tracked?
4. Will the reviewer have clear focus?
5. Are all parts of this task related?

If any answer is "no", consider breaking it down.
