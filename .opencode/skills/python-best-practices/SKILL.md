---
name: python-best-practices
description: Comprehensive Python coding standards for distributed systems and data processing. Enforces type hints, clean architecture, proper error handling, and modern Python idioms. Use when writing or reviewing Python code.
allowed-tools: Read, Write, StrReplace, Grep, Glob, ReadLints
---

# Python Best Practices Skill

This skill provides comprehensive Python coding standards and patterns for building high-quality, maintainable code in distributed systems and data processing applications.

## Expert Profile

This skill is optimized for:

- **Python specialists** focusing on distributed systems and cloud platforms (AWS)
- **Deep expertise** in data processing: PySpark, Polars, Ray, Pandas
- **Pragmatic software engineering**: DRY, SOLID, clean architecture principles

## Core Principles
This skill ensures Python code has:
1. **Type Safety** - All public interfaces use type hints with built-in types
2. **Clear Interfaces** - Public vs private boundaries are explicit
3. **Testability** - Dependency injection and single responsibility
4. **Modern Python** - Python 3.10+ features, no legacy typing imports
5. **Explicit over Implicit** - No magic, clear control flow
6. **Structured Data** - Dataclasses and Pydantic over dictionaries
7. **Fail Fast** - Exceptions bubble up, no silent failures

## Quick Reference Guide

When writing or reviewing python code, ensure the following:

### Architecture ✓
- Single responsibility per function/class
- Dependencies injected, not hardcoded
- Private methods prefixed with `_`
- Single return type per function
- Minimal return statements (prefer single exit point)

### Type Hints ✓
- All public functions have type hints
- Use `list`, `dict`, `set` (not `List`, `Dict`, `Set`)
- Never import from `typing.List`, `typing.Dict`, `typing.Set`, `typing.Tuple`
- Return types specified (use `None` not `Optional[T]` where possible)
- Complex types decomposed clearly

### Documentation ✓
- Google-style docstrings on public methods
- Docstrings explain "why" not "what"
- Complex logic has explanatory comments
- No obvious comments (self-documenting code preferred)

### Data Structures ✓
- Pydantic models for external interfaces (API requests/responses)
- Dataclasses for internal data transfer
- Enums or `Literal` for constrained string values
- Custom DTOs instead of dicts where keys are consistent

### Imports ✓
- All imports at top of module (no function-scoped imports)
- Absolute imports only (no relative imports)
- No imports in `__init__.py` unless explicitly needed
- Imports grouped: stdlib, third-party, local

### Code Quality ✓
- F-strings for string formatting (not `.format()` or `%`)
- Structured logging (structlog preferred)
- Main function entrypoint pattern
- No exceptions used as control flow
- Exceptions bubble up (no fallback in catch blocks)
- Avoid catching broad `Exception` types

For examples of what is and is not acceptable python code / patterns see `reference.md`

## Common Anti-Patterns to Avoid

See `reference.md` for detailed examples of these anti-patterns:

1. ❌ Using `typing.List`, `typing.Dict`, `typing.Set`, `typing.Tuple`
2. ❌ Function-scoped imports (except in specific edge cases)
3. ❌ Relative imports (`from .module import thing`)
4. ❌ Multiple return types from a function
5. ❌ Catching exceptions for control flow
6. ❌ Fallback logic in exception handlers
7. ❌ Broad exception catching without reason
8. ❌ Using dictionaries with consistent keys instead of dataclasses
9. ❌ String concatenation instead of f-strings
10. ❌ Missing type hints on public functions
11. ❌ Public methods without docstrings
12. ❌ Global state and hardcoded dependencies

## Modern python

Use python 3.10+ features:
- Built-in generic types (`list[str]`, `dict[str, int]`)
- Union types with `|` operator (`str | None` vs `Optional[str]`)
- Match statements (pattern matching)
- Structural pattern matching

## Validation and Review

When reviewing code:

1. **Check type hints**: Are they present and using built-in types?
2. **Review imports**: Top-level, absolute, no typing.List/Dict/Set?
3. **Assess structure**: Clear boundaries, single responsibility?
4. **Examine error handling**: Exceptions bubble up? No broad catches?
5. **Verify data structures**: Dataclasses/Pydantic where appropriate?
6. **Look for anti-patterns**: See reference.md for comprehensive list

## Quick Examples

### ✅ Good Type Hints
```python
def process_items(items: list[str]) -> dict[str, int]:
    """Process items and return counts."""
    return {item: len(item) for item in items}
```

### ❌ Bad Type Hints
```python
from typing import List, Dict

def process_items(items: List[str]) -> Dict[str, int]:
    return {item: len(item) for item in items}
```

### ✅ Good Dataclass Usage
```python
from dataclasses import dataclass

@dataclass
class UserData:
    user_id: str
    name: str
    email: str
```

### ❌ Bad Dictionary Usage
```python
def create_user(user_id: str, name: str, email: str) -> dict:
    return {
        "user_id": user_id,
        "name": name,
        "email": email
    }
```

## Reference Material

See `reference.md` for comprehensive examples including:
- Full code examples (good and bad)
- Architecture patterns
- Error handling strategies
- Data structure choices
- Modern Python idioms
- Real-world refactoring scenarios

Consult `reference.md` for detailed examples when applying these standards.
