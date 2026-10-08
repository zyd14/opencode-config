# Python Best Practices Reference

This reference provides comprehensive examples of good and bad Python code patterns. Each section includes both positive examples to follow and anti-patterns to avoid.

## Table of Contents

1. [Type Hints](#type-hints)
2. [Architecture & Design](#architecture--design)
3. [Data Structures](#data-structures)
4. [Error Handling](#error-handling)
5. [Imports](#imports)
6. [Code Organization](#code-organization)
7. [String Formatting](#string-formatting)
8. [Logging](#logging)
9. [Function Design](#function-design)
10. [Python Idioms](#python-idioms)

---

## Type Hints

### ✅ Good: Built-in Types (Python 3.9+)

```python
def process_users(
    users: list[dict[str, str]],
    filters: set[str] | None = None
) -> dict[str, list[str]]:
    """Process users with optional filters.
    
    Args:
        users: List of user dictionaries
        filters: Optional set of filter criteria
        
    Returns:
        Dictionary mapping user IDs to their attributes
    """
    filters = filters or set()
    result: dict[str, list[str]] = {}
    
    for user in users:
        if not filters or any(f in user for f in filters):
            result[user["id"]] = [user["name"], user["email"]]
    
    return result


def fetch_data(url: str) -> bytes | None:
    """Fetch data from URL, return None if not found."""
    # Implementation...
    pass


def merge_configs(
    base: dict[str, str | int],
    override: dict[str, str | int]
) -> dict[str, str | int]:
    """Merge two configuration dictionaries."""
    return {**base, **override}
```

### ❌ Bad: Legacy typing Module Imports

```python
from typing import List, Dict, Set, Optional, Tuple

def process_users(
    users: List[Dict[str, str]],
    filters: Optional[Set[str]] = None
) -> Dict[str, List[str]]:
    """Don't import List, Dict, Set, Optional from typing!"""
    pass


def fetch_data(url: str) -> Optional[bytes]:
    """Use 'bytes | None' instead of Optional[bytes]"""
    pass


def get_coordinates() -> Tuple[int, int]:
    """Use 'tuple[int, int]' instead of Tuple"""
    pass
```

### ✅ Good: Complex Type Hints

```python
from collections.abc import Callable, Iterator
from typing import TypeVar, Protocol

T = TypeVar('T')

def map_items(items: list[T], func: Callable[[T], str]) -> list[str]:
    """Apply function to each item."""
    return [func(item) for item in items]


def iter_chunks(data: list[T], size: int) -> Iterator[list[T]]:
    """Yield chunks of data."""
    for i in range(0, len(data), size):
        yield data[i:i + size]


class HasName(Protocol):
    """Protocol for objects with a name attribute."""
    name: str


def get_names(items: list[HasName]) -> list[str]:
    """Extract names from items."""
    return [item.name for item in items]
```

### ❌ Bad: Missing or Inconsistent Type Hints

```python
def process_data(data):
    """Missing all type hints"""
    return [x * 2 for x in data]


def calculate_total(items: list[dict], tax_rate):
    """Inconsistent - items typed but tax_rate not"""
    return sum(item["price"] for item in items) * (1 + tax_rate)


def transform(data: list[str]):
    """Missing return type"""
    return {item: len(item) for item in data}
```

---

## Architecture & Design

### ✅ Good: Dependency Injection

```python
from dataclasses import dataclass
from collections.abc import Callable

@dataclass
class UserService:
    """Service for managing users with injected dependencies."""
    
    db_client: DatabaseClient
    cache: CacheClient
    logger: Logger
    
    def get_user(self, user_id: str) -> User | None:
        """Get user by ID, using cache when available.
        
        Args:
            user_id: The user identifier
            
        Returns:
            User if found, None otherwise
        """
        # Check cache first
        cached = self.cache.get(f"user:{user_id}")
        if cached:
            self.logger.info("cache_hit", user_id=user_id)
            return User.from_dict(cached)
        
        # Fetch from database
        user = self.db_client.fetch_user(user_id)
        if user:
            self.cache.set(f"user:{user_id}", user.to_dict())
            self.logger.info("user_fetched", user_id=user_id)
        
        return user


# Usage with DI
def main() -> None:
    """Application entry point."""
    db_client = DatabaseClient(connection_string=os.getenv("DB_URL"))
    cache = RedisCache(host=os.getenv("REDIS_HOST"))
    logger = get_logger(__name__)
    
    user_service = UserService(
        db_client=db_client,
        cache=cache,
        logger=logger
    )
    
    user = user_service.get_user("123")
```

### ❌ Bad: Hardcoded Dependencies

```python
class UserService:
    """Service with hardcoded dependencies - untestable!"""
    
    def __init__(self):
        # Hardcoded - can't inject mocks for testing
        self.db = DatabaseClient("prod-db-connection")
        self.cache = RedisCache("prod-redis:6379")
        self.logger = logging.getLogger(__name__)
    
    def get_user(self, user_id):
        # Now impossible to test without hitting real DB/cache
        return self.db.fetch_user(user_id)
```

### ✅ Good: Single Responsibility

```python
@dataclass
class UserValidator:
    """Validates user data only."""
    
    def validate_email(self, email: str) -> bool:
        """Validate email format."""
        return "@" in email and "." in email.split("@")[1]
    
    def validate_password(self, password: str) -> bool:
        """Validate password strength."""
        return len(password) >= 8 and any(c.isupper() for c in password)


@dataclass
class UserRepository:
    """Handles user data persistence only."""
    
    db_client: DatabaseClient
    
    def save_user(self, user: User) -> None:
        """Save user to database."""
        self.db_client.insert("users", user.to_dict())
    
    def find_by_email(self, email: str) -> User | None:
        """Find user by email."""
        data = self.db_client.query("users", {"email": email})
        return User.from_dict(data) if data else None


@dataclass
class UserRegistrationService:
    """Orchestrates user registration - single responsibility."""
    
    validator: UserValidator
    repository: UserRepository
    logger: Logger
    
    def register_user(self, email: str, password: str) -> User | None:
        """Register new user.
        
        Args:
            email: User email address
            password: User password
            
        Returns:
            Registered user if successful, None otherwise
        """
        # Validate
        if not self.validator.validate_email(email):
            self.logger.warning("invalid_email", email=email)
            return None
        
        if not self.validator.validate_password(password):
            self.logger.warning("weak_password", email=email)
            return None
        
        # Check existence
        existing = self.repository.find_by_email(email)
        if existing:
            self.logger.warning("user_exists", email=email)
            return None
        
        # Create and save
        user = User(email=email, password_hash=hash_password(password))
        self.repository.save_user(user)
        self.logger.info("user_registered", email=email)
        
        return user
```

### ❌ Bad: Multiple Responsibilities

```python
class UserManager:
    """Does everything - validation, persistence, business logic, notification!"""
    
    def register_user(self, email, password):
        # Validates (responsibility 1)
        if "@" not in email:
            return None
        if len(password) < 8:
            return None
        
        # Checks database (responsibility 2)
        existing = self.db.query("SELECT * FROM users WHERE email = ?", (email,))
        if existing:
            return None
        
        # Hashes password (responsibility 3)
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
        
        # Saves to database (responsibility 4)
        self.db.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash)
        )
        
        # Sends email (responsibility 5)
        self.smtp_client.send(
            to=email,
            subject="Welcome!",
            body="Thanks for signing up"
        )
        
        # Updates cache (responsibility 6)
        self.cache.set(f"user:{email}", {"email": email})
        
        # Logs (responsibility 7)
        self.logger.info(f"User {email} registered")
        
        return email
```

### ✅ Good: Public/Private Interface Boundaries

```python
class DataProcessor:
    """Process data with clear public/private boundaries."""
    
    def process(self, data: list[dict[str, str]]) -> list[dict[str, str]]:
        """Public method to process data.
        
        Args:
            data: Raw data to process
            
        Returns:
            Processed data
        """
        validated = self._validate_data(data)
        transformed = self._transform_data(validated)
        return self._enrich_data(transformed)
    
    def _validate_data(self, data: list[dict[str, str]]) -> list[dict[str, str]]:
        """Private: Validate data structure."""
        return [item for item in data if "id" in item and "value" in item]
    
    def _transform_data(self, data: list[dict[str, str]]) -> list[dict[str, str]]:
        """Private: Transform data values."""
        return [
            {**item, "value": item["value"].upper()}
            for item in data
        ]
    
    def _enrich_data(self, data: list[dict[str, str]]) -> list[dict[str, str]]:
        """Private: Add computed fields."""
        return [
            {**item, "processed": True}
            for item in data
        ]
```

### ❌ Bad: No Interface Boundaries

```python
class DataProcessor:
    """All methods public - unclear what's the API vs internals."""
    
    def process(self, data):
        validated = self.validate_data(data)
        transformed = self.transform_data(validated)
        return self.enrich_data(transformed)
    
    def validate_data(self, data):
        """Is this part of public API or internal helper?"""
        return [item for item in data if "id" in item]
    
    def transform_data(self, data):
        """Unclear if users should call this directly."""
        return [{**item, "value": item["value"].upper()} for item in data]
    
    def enrich_data(self, data):
        """Should this be exposed or is it internal?"""
        return [{**item, "processed": True} for item in data]
```

---

## Data Structures

### ✅ Good: Dataclasses for Internal Data

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class TaskResult:
    """Result of a task execution."""
    
    task_id: str
    status: str
    duration_ms: int
    completed_at: datetime
    errors: list[str] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)
    
    def is_successful(self) -> bool:
        """Check if task completed successfully."""
        return self.status == "success" and not self.errors


@dataclass
class ProcessingConfig:
    """Configuration for data processing."""
    
    batch_size: int
    max_retries: int
    timeout_seconds: int
    enable_cache: bool = True
    worker_count: int = 4


def process_batch(config: ProcessingConfig) -> list[TaskResult]:
    """Process batch with given configuration."""
    results: list[TaskResult] = []
    # Processing logic...
    return results
```

### ✅ Good: Pydantic for External Interfaces

```python
from pydantic import BaseModel, Field, field_validator

class StrictBaseModel(BaseModel):
    """ Base class for enforcing frozen / forbidden extras.
        Always forbid extra attributes unless parsing data where some keys are unknown or may change. Prefer using frozen instances where possible. 
    """
    model_config = ConfigDict(extra="forbid", frozen=True)

class UserCreateRequest(StrictBaseModel):
    """API request to create a user."""
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    name: str = Field(..., min_length=1, description="User display name")
    
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Ensure email contains @ symbol."""
        if "@" not in v:
            raise ValueError("Invalid email format")
        return v.lower()

class UserResponse(BaseModel):
    """API response containing user data."""
    model_config = ConfigDict(extra="forbid", frozen=True)  # 
    user_id: str
    email: str
    name: str
    created_at: str

def create_user_endpoint(request: UserCreateRequest) -> UserResponse:
    """API endpoint handler with validated request/response."""
    # Pydantic automatically validates request
    user = create_user(request.email, request.password, request.name)
    
    # Return validated response
    return UserResponse(
        user_id=user.id,
        email=user.email,
        name=user.name,
        created_at=user.created_at.isoformat()
    )
```

### ❌ Bad: Dictionaries with Consistent Keys

```python
def create_user(email: str, password: str, name: str) -> dict:
    """Returns dict - no type safety, no validation!"""
    return {
        "email": email,
        "password": password,
        "name": name,
        "created_at": datetime.now().isoformat()
    }

def process_user(user: dict) -> dict:
    """Dict parameters are opaque - what keys are expected?"""
    # Typo here would cause runtime error
    email = user["emial"]  # Oops!
    # Or missing keys
    age = user["age"]  # KeyError if not present!
    
    return {
        "processed": True,
        "user_email": email
    }

def get_config() -> dict:
    """Configuration as dict - no IDE support, no validation."""
    return {
        "batch_size": 100,
        "max_retries": 3,
        "timeout": 30
    }
```

### ✅ Good: Enums and Literals for Constrained Values

```python
from enum import Enum
from typing import Literal

class TaskStatus(Enum):
    """Task execution status."""
    
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Task:
    """Task with status enum."""
    
    task_id: str
    status: TaskStatus
    
    def mark_complete(self) -> None:
        """Mark task as complete."""
        self.status = TaskStatus.SUCCESS
    
    def is_terminal(self) -> bool:
        """Check if task is in terminal state."""
        return self.status in (
            TaskStatus.SUCCESS,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED
        )

# Literal for simple constrained strings
LogLevel = Literal["debug", "info", "warning", "error"]

def log_message(message: str, level: LogLevel = "info") -> None:
    """Log message with constrained level.
    
    Args:
        message: Message to log
        level: Log level (must be debug, info, warning, or error)
    """
    print(f"[{level.upper()}] {message}")

# Type checker catches invalid usage
log_message("Hello", level="info")  # ✅ OK
log_message("Hello", level="trace")  # ❌ Type error!
```

### ❌ Bad: String Constants Without Constraints

```python
# Status as plain strings - easy to make typos!
def update_task_status(task_id: str, status: str) -> None:
    """What are valid status values? Who knows!"""
    if status == "sucess":  # Oops, typo!
        notify_completion(task_id)


def log_message(message: str, level: str) -> None:
    """Level can be anything - no validation!"""
    print(f"[{level}] {message}")


# Caller can pass anything
log_message("Error occurred", level="CRITICAL")  # Is this valid?
log_message("Debug info", level="trace")  # Or this?
log_message("Info", level="iNfO")  # Or this?
```
---

## Error Handling

### ✅ Good: Exceptions Bubble Up

```python
class DataFetchError(Exception):
    """Raised when data fetching fails."""
    pass

class ValidationError(Exception):
    """Raised when validation fails."""
    pass

def fetch_user_data(user_id: str) -> dict[str, str]:
    """Fetch user data from API.
    
    Args:
        user_id: User identifier
        
    Returns:
        User data dictionary
        
    Raises:
        DataFetchError: If fetch fails
    """
    response = requests.get(f"/api/users/{user_id}")
    if response.status_code != 200:
        # Let exception bubble up - don't hide errors
        raise DataFetchError(f"Failed to fetch user {user_id}: {response.status_code}")
    
    return response.json()

def validate_user_data(data: dict[str, str]) -> None:
    """Validate user data structure.
    
    Args:
        data: User data to validate
        
    Raises:
        ValidationError: If validation fails
    """
    required_fields = ["user_id", "email", "name"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        # Let exception bubble up
        raise ValidationError(f"Missing required fields: {missing}")

def process_user(user_id: str) -> dict[str, str]:
    """Process user by ID.
    
    Args:
        user_id: User identifier
        
    Returns:
        Processed user data
        
    Raises:
        DataFetchError: If fetch fails
        ValidationError: If data invalid
    """
    # Don't catch exceptions here - let them bubble up
    data = fetch_user_data(user_id)
    validate_user_data(data)
    return data


def main() -> None:
    """Application entry point - handle errors at boundary."""
    try:
        # Only catch at application boundary
        user_data = process_user("123")
        print(f"Processed user: {user_data}")
    except DataFetchError as e:
        logger.error("Failed to fetch user", error=str(e))
        sys.exit(1)
    except ValidationError as e:
        logger.error("Invalid user data", error=str(e))
        sys.exit(1)
```

### ❌ Bad: Fallback Logic in Exception Handlers

```python

def get_config(path: str) -> dict:
    """Config with fallback - errors go unnoticed."""
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        # Bad: File missing but we hide it
        return {"default": True}
    except json.JSONDecodeError:
        # Bad: Malformed JSON but we ignore it
        return {}
    except Exception:
        # Bad: Silent fallback hides real problems
        return {}

def process_data(data: list[dict]) -> list[dict]:
    """Process with fallback - partial failures hidden."""
    results = []
    for item in data:
        try:
            processed = transform(item)
            results.append(processed)
        except Exception:
            # Bad: Silently skip failed items
            continue
    return results
```

### ✅ Good: Specific Exception Handling

```python
def parse_config_file(path: str) -> dict[str, str]:
    """Parse configuration file with specific error handling.
    
    Args:
        path: Path to config file
        
    Returns:
        Parsed configuration
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        json.JSONDecodeError: If config file is malformed
        ValueError: If config is invalid
    """
    # Let FileNotFoundError bubble up
    with open(path) as f:
        # Let JSONDecodeError bubble up
        config = json.load(f)
    
    # Only catch for validation, then re-raise as ValueError
    if "required_field" not in config:
        raise ValueError(f"Config missing required_field: {path}")
    
    return config

def fetch_with_retry(url: str, max_retries: int = 3) -> bytes:
    """Fetch URL with retries for transient errors.
    
    Args:
        url: URL to fetch
        max_retries: Maximum retry attempts
        
    Returns:
        Response body
        
    Raises:
        requests.RequestException: If all retries fail
    """
    last_error: Exception | None = None
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.content
        except requests.Timeout as e:
            # Catch specific transient error for retry
            last_error = e
            logger.warning("Request timeout, retrying", attempt=attempt, url=url)
            continue
        except requests.HTTPError as e:
            # Don't retry client errors (4xx)
            if 400 <= e.response.status_code < 500:
                raise
            # Retry server errors (5xx)
            last_error = e
            logger.warning("Server error, retrying", attempt=attempt, url=url)
            continue
    
    # All retries failed
    raise last_error or requests.RequestException(f"Failed after {max_retries} retries")
```

### ❌ Bad: Broad Exception Catching

```python
def process_item(item: dict) -> dict:
    """Catches everything - hides bugs!"""
    try:
        result = transform(item)
        validate(result)
        return result
    except Exception as e:
        # Bad: Catches ALL exceptions including bugs
        # This might hide TypeError, AttributeError, etc.
        logger.error(f"Processing failed: {e}")
        return {}

def run_task(task_id: str) -> None:
    """Catches everything including KeyboardInterrupt!"""
    try:
        task = load_task(task_id)
        execute_task(task)
    except Exception:
        # Bad: This even catches KeyboardInterrupt in Python 2
        # and might catch SystemExit!
        pass
```

### ❌ Bad: Exceptions as Control Flow

```python
def find_user_by_email(email: str) -> User | None:
    """Using exception for normal control flow - bad!"""
    try:
        # Exception used for "not found" - this is normal flow!
        user = db.query("SELECT * FROM users WHERE email = ?", (email,))
        return User.from_dict(user)
    except NotFoundException:
        # This is expected behavior, not an error!
        return None


def parse_value(value: str) -> int | float:
    """Exception-based type checking - anti-pattern."""
    try:
        return int(value)
    except ValueError:
        # Using exception for control flow
        try:
            return float(value)
        except ValueError:
            # Nested exception handling for control flow
            return 0

# Better approach:
def find_user_by_email(email: str) -> User | None:
    """Return None for not found - no exception needed."""
    user = db.query_one("SELECT * FROM users WHERE email = ?", (email,))
    return User.from_dict(user) if user else None

def parse_value(value: str) -> int | float:
    """Explicit type checking."""
    if value.isdigit():
        return int(value)
    
    try:
        return float(value)
    except ValueError:
        # Only use exception for actual errors
        raise ValueError(f"Cannot parse value: {value}")
```

## Imports

### ✅ Good: Absolute Imports, Top-Level

```python
"""User service module."""

# Standard library (grouped together)
import os
import sys
from datetime import datetime
from pathlib import Path

# Third-party packages (grouped together)
import requests
from pydantic import BaseModel
from structlog import get_logger

# Local application (grouped together, absolute paths)
from myapp.database.client import DatabaseClient
from myapp.models.user import User
from myapp.services.email import EmailService
from myapp.utils.validation import validate_email

logger = get_logger(__name__)


class UserService:
    """All imports at top - no function-scoped imports."""
    
    def __init__(self, db: DatabaseClient, email: EmailService):
        self.db = db
        self.email = email
    
    def create_user(self, email: str, name: str) -> User:
        """Create new user."""
        # All dependencies imported at top
        if not validate_email(email):
            raise ValueError("Invalid email")
        
        user = User(email=email, name=name, created_at=datetime.now())
        self.db.save(user)
        self.email.send_welcome(email)
        
        return user
```

### ❌ Bad: Relative Imports and Function-Scoped Imports

```python
"""User service - BAD import practices."""

# Relative imports - avoid these!
from .database import DatabaseClient  # ❌
from ..models.user import User  # ❌

class UserService:
    """Function-scoped imports - anti-pattern."""
    
    def create_user(self, email: str) -> dict:
        # Bad: Import inside function
        from datetime import datetime # Import at top instead!
        from myapp.services.email import EmailService
        ...
    
    def delete_user(self, user_id: str) -> None:
        # Bad: Importing same module multiple times in different functions
        from myapp.database import DatabaseClient
        ...
```

### ✅ Good: No `__init__.py` Imports (Unless Needed)

```python
# myapp/services/__init__.py

"""Services package.

Do not add imports here unless explicitly building a public API.
Users should import directly from modules:
    from myapp.services.user_service import UserService
    
NOT:
    from myapp.services import UserService
"""

# Keep __init__.py empty or with just docstring
# This prevents circular import issues and keeps imports explicit
```

### ❌ Bad: Imports in `__init__.py`

```python
# myapp/services/__init__.py

"""Services package."""

# Bad: Importing everything into __init__
from myapp.services.user_service import UserService
from myapp.services.email_service import EmailService
from myapp.services.auth_service import AuthService
from myapp.services.payment_service import PaymentService

# Problems:
# 1. Circular import risk
# 2. Importing the package loads all modules (slow)
# 3. Unclear what the actual module structure is
# 4. Harder to refactor

__all__ = [
    "UserService",
    "EmailService",
    "AuthService",
    "PaymentService",
]
```

---

## Code Organization

### ✅ Good: Google-Style Docstrings
Provide usage examples at architectural boundaries / entrypoints

```python
def process_users(
    users: list[User],
    filters: dict[str, str] | None = None,
    batch_size: int = 100
) -> list[ProcessedUser]:
    """Process users in batches with optional filtering.
    
    This function takes a list of users, applies optional filters,
    and processes them in batches for efficiency. Each user is
    transformed according to business rules and validated.
    
    Args:
        users: List of User objects to process
        filters: Optional dictionary of filter criteria. Keys are field
            names and values are the values to match against.
        batch_size: Number of users to process in each batch. Defaults
            to 100. Must be positive.
    
    Returns:
        List of ProcessedUser objects containing transformed and validated
        user data. Order is preserved from input list.
    
    Raises:
        ValueError: If batch_size is not positive
        ValidationError: If any user fails validation rules
    
    Example:
        >>> users = [User(id="1", name="Alice"), User(id="2", name="Bob")]
        >>> processed = process_users(users, filters={"status": "active"})
        >>> len(processed)
        2
    """
    if batch_size <= 0:
        raise ValueError(f"batch_size must be positive, got {batch_size}")
    
    # Filter users if filters provided
    filtered_users = users
    if filters:
        filtered_users = [u for u in users if _matches_filters(u, filters)]
    
    # Process in batches
    results: list[ProcessedUser] = []
    for batch in _chunk_list(filtered_users, batch_size):
        batch_results = _process_batch(batch)
        results.extend(batch_results)
    
    return results

def _matches_filters(user: User, filters: dict[str, str]) -> bool:
    """Check if user matches filter criteria.
    
    Private helper function - doesn't need full docstring but has one
    because the logic is non-trivial. Doesn't require usage examples.
    
    Args:
        user: User to check
        filters: Filter criteria
    
    Returns:
        True if user matches all filters, False otherwise
    """
    return all(
        getattr(user, field, None) == value
        for field, value in filters.items()
    )
```

### ❌ Bad: Missing or Poor Docstrings

```python
def process_users(users, filters=None, batch_size=100):
    # No docstring at all!
    if batch_size <= 0:
        raise ValueError(f"batch_size must be positive")
    
    filtered_users = users
    if filters:
        filtered_users = [u for u in users if matches(u, filters)]
    
    results = []
    for batch in chunks(filtered_users, batch_size):
        results.extend(process(batch))
    
    return results


def calculate_total(items):
    """Calculates total."""  # Obvious from name, no value added
    return sum(item.price for item in items)


def fetch_data(url, retries, timeout):
    """
    This function fetches data from a URL with retries and timeout
    
    url: the URL to fetch from
    retries: how many times to retry
    timeout: the timeout value
    
    Returns: the data
    """
    # Bad docstring style - doesn't follow Google format
    # Missing type information (should be in type hints)
    # Doesn't explain what happens on failure
    pass
```

### ✅ Good: Main Function Entrypoint Pattern

```python
"""User processing script.

This script processes users from a CSV file and outputs results to JSON.
Can be run as a module or script.
"""

import argparse
import sys
from pathlib import Path

from structlog import get_logger

from myapp.models.user import User
from myapp.services.user_processor import UserProcessor

logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.
    
    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(description="Process user data")
    parser.add_argument(
        "input_file",
        type=Path,
        help="Path to input CSV file"
    )
    parser.add_argument(
        "output_file",
        type=Path,
        help="Path to output JSON file"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Processing batch size (default: 100)"
    )
    
    return parser.parse_args()


def run(input_file: Path, output_file: Path, batch_size: int) -> int:
    """Run the user processing workflow.
    
    Args:
        input_file: Path to input CSV
        output_file: Path to output JSON
        batch_size: Processing batch size
    
    Returns:
        Exit code (0 for success, 1 for failure)
    """
    ...

def main() -> None:
    """Main entry point."""
    args = parse_args()
    exit_code = run(args.input_file, args.output_file, args.batch_size)
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
```

### ❌ Bad: Script Without Main Pattern

```python
"""User processing script - bad organization."""

import sys
import csv

# Global state - bad!
users = []
processed = []

# Script logic at module level - runs on import!
if len(sys.argv) < 3: # prefer argparse over sys.argv
    print("Usage: python script.py input.csv output.json")
    sys.exit(1)

input_file = sys.argv[1]
output_file = sys.argv[2]

# Side effects at module level - bad!
with open(input_file) as f:
    reader = csv.DictReader(f)
    for row in reader:
        users.append(row)

# Problems:
# 1. Can't import this module without running the script
# 2. Can't test individual functions
# 3. Global state makes testing hard
# 4. No clear entry point
# 5. No error handling
```

---

## String Formatting

### ✅ Good: F-Strings

```python
def format_user_info(user_id: str, name: str, age: int) -> str:
    """Format user information using f-strings.
    
    Args:
        user_id: User identifier
        name: User name
        age: User age
    
    Returns:
        Formatted user string
    """
    return f"User {user_id}: {name} (age {age})"


def build_query(table: str, conditions: dict[str, str]) -> str:
    """Build SQL query using f-strings.
    
    Args:
        table: Table name
        conditions: WHERE clause conditions
    
    Returns:
        SQL query string
    """
    where_clause = " AND ".join(f"{k} = ?" for k in conditions.keys())
    return f"SELECT * FROM {table} WHERE {where_clause}"


def log_processing_stats(
    processed: int,
    failed: int,
    duration_ms: float
) -> None:
    """Log processing statistics.
    
    Args:
        processed: Number of items processed
        failed: Number of items failed
        duration_ms: Processing duration in milliseconds
    """
    success_rate = (processed / (processed + failed)) * 100 if processed + failed > 0 else 0
    logger.info(
        f"Processing complete: {processed} succeeded, {failed} failed "
        f"({success_rate:.2f}% success rate) in {duration_ms:.0f}ms"
    )

### ❌ Bad: Old String Formatting Methods

```python
def format_user_info(user_id, name, age):
    """Using % operator - old style, avoid!"""
    return "User %s: %s (age %d)" % (user_id, name, age)


def build_query(table, conditions):
    """Using .format() - better than %, but f-strings are cleaner."""
    where_clause = " AND ".join("{} = ?".format(k) for k in conditions.keys())
    return "SELECT * FROM {} WHERE {}".format(table, where_clause)

def build_url(host, port, path):
    """Mixed concatenation - error-prone, hard to read."""
    return "http://" + host + ":" + str(port) + path
```
---
## Logging

### ✅ Good: Structured Logging with structlog

```python
import structlog
from structlog.types import FilteringBoundLogger

# Configure structlog at application startup
def configure_logging() -> None:
    """Configure structured logging."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

# Get logger for module
logger: FilteringBoundLogger = structlog.get_logger(__name__)

@dataclass
class UserService:
    """User service with structured logging."""
    
    db: DatabaseClient
    logger: FilteringBoundLogger = structlog.get_logger(__name__)
    
    def create_user(self, email: str, name: str) -> User:
        """Create new user with structured logging.
        
        Args:
            email: User email
            name: User name
        
        Returns:
            Created user
        """
        self.logger.info(
            "Creating user",
            email=email,
            name=name
        )
        
        try:
            user = User(email=email, name=name)
            self.db.save(user)
            self.logger.info(
                "User created successfully",
                user_id=user.id,
                email=email
            )
            return user
            
        except DatabaseError as e:
            self.logger.error(
                "Failed to create user",
                email=email,
                error=str(e),
                exc_info=True
            )
            raise

def process_batch(items: list[dict[str, str]], batch_id: str) -> list[dict[str, str]]:
    """Process batch with structured logging.
    
    Args:
        items: Items to process
        batch_id: Batch identifier
    
    Returns:
        Processed items
    """
    # Bind context for all subsequent log calls
    log = logger.bind(batch_id=batch_id, item_count=len(items))
    results: list[dict[str, str]] = []
    failed_count = 0
    
    for idx, item in enumerate(items):
        try:
            result = process_item(item)
            results.append(result)
        except ProcessingError as e:
            failed_count += 1
            log.warning(
                "Item processing failed",
                item_index=idx,
                item_id=item.get("id"),
                error=str(e)
            )
    
    log.info(
        "Batch processing complete",
        processed=len(results),
        failed=failed_count
    )
    
    return results
```

### ❌ Bad: Unstructured Logging

```python
import logging

# Basic logging without structure
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UserService:
    """User service with poor logging."""
    
    def create_user(self, email: str, name: str) -> User:
        """Create user with unstructured logs."""
        # Bad: String formatting in log message
        logger.info(f"Creating user {email} with name {name}")
        
        try:
            user = User(email=email, name=name)
            self.db.save(user)
            
            # Bad: Can't easily parse or query these logs
            logger.info(f"User created: {user.id}")
            
            return user
            
        except Exception as e:
            # Bad: Generic exception catching and poor error logging - include stack trace when logging errors
            logger.error(f"Error creating user: {e}")
            return None


def process_batch(items, batch_id):
    """Process with inconsistent logging."""
    # Bad: Mixing string formats
    logger.info("Starting batch %s" % batch_id)
    
    results = []
    for item in items:
        try:
            result = process_item(item)
            results.append(result)
            # Bad: No context about which item
            logger.info("Item processed successfully")
        except Exception as e:
            # Bad: No structured fields
            logger.error(f"Failed to process item: {e}")
    
    # Bad: Hard to extract metrics from these logs
    logger.info("Batch done. Processed: " + str(len(results)))
    
    return results
```

---

## Function Design

### ✅ Good: Single Return Type, Minimal Returns

```python
def find_user_by_email(email: str) -> User | None:
    """Find user by email.
    
    Single return type (User | None) with single return statement.
    
    Args:
        email: Email address to search
    
    Returns:
        User if found, None otherwise
    """
    result = db.query("SELECT * FROM users WHERE email = ?", (email,))
    
    # Single return statement
    return User.from_dict(result) if result else None


def validate_and_transform_data(data: dict[str, str]) -> dict[str, str]:
    """Validate and transform data.
    
    Single return type, single return point (at end).
    
    Args:
        data: Data to validate and transform
    
    Returns:
        Transformed data
    
    Raises:
        ValidationError: If validation fails
    """
    # Validate first (raise on error)
    if "id" not in data:
        raise ValidationError("Missing id field")
    
    if "value" not in data:
        raise ValidationError("Missing value field")
    
    # Transform
    transformed = {
        "id": data["id"],
        "value": data["value"].upper(),
        "processed": True
    }
    
    # Single return at end
    return transformed


def calculate_discount(price: float, user_tier: str) -> float:
    """Calculate discount based on user tier.
    
    Single return type, logic organized to minimize returns.
    
    Args:
        price: Original price
        user_tier: User tier (bronze, silver, gold)
    
    Returns:
        Discounted price
    """
    # Determine discount rate based on tier
    if user_tier == "gold":
        discount_rate = 0.20
    elif user_tier == "silver":
        discount_rate = 0.10
    elif user_tier == "bronze":
        discount_rate = 0.05
    else:
        discount_rate = 0.0
    
    # Single return with calculation
    return price * (1 - discount_rate)
```

### ❌ Bad: Multiple Return Types, Many Returns

```python
def find_user(identifier):
    """Find user - returns different types! Bad!"""
    if identifier.isdigit():
        user = db.query("SELECT * FROM users WHERE id = ?", (identifier,))
        if user:
            return User.from_dict(user)  # Returns User
        else:
            return None  # Returns None
    else:
        user = db.query("SELECT * FROM users WHERE email = ?", (identifier,))
        if user:
            return User.from_dict(user)  # Returns User
        else:
            return False  # Returns False - inconsistent with None!


def process_data(data):
    """Multiple return types - impossible to type hint properly!"""
    if not data:
        return None  # None type
    
    try:
        result = transform(data)
        return result  # dict type
    except ValueError:
        return False  # bool type
    except KeyError:
        return {"error": "missing_key"}  # dict type but different shape!


def calculate_discount(price, user_tier):
    """Too many return statements - hard to follow, control flow is complex."""
    if user_tier == "gold":
        return price * 0.8
    
    if user_tier == "silver":
        return price * 0.9
    
    if user_tier == "bronze":
        return price * 0.95
    
    if price > 100:
        return price * 0.98
    
    if price > 50:
        return price * 0.99
    
    return price
```

### ✅ Good: Split Functions for Single Return Type

```python
UserIdType = Literal["id", "email"]

def parse_user_identifier(identifier: str) -> UserIdType:
    """Parse identifier into type and value.
    
    Args:
        identifier: User identifier (ID or email)
    
    Returns:
        UserIdType
    """
    if identifier.isdigit():
        user_id = "id"
    else:
        user_id = "email"
    return user_id

def find_user_by_id(user_id: str) -> User | None:
    """Find user by ID.
    
    Args:
        user_id: User ID
    
    Returns:
        User if found, None otherwise
    """
    result = db.query("SELECT * FROM users WHERE id = ?", (user_id,))
    return User.from_dict(result) if result else None

def find_user_by_email(email: str) -> User | None:
    """Find user by email.
    
    Args:
        email: Email address
    
    Returns:
        User if found, None otherwise
    """
    result = db.query("SELECT * FROM users WHERE email = ?", (email,))
    return User.from_dict(result) if result else None

def find_user(identifier: str) -> User | None:
    """Find user by ID or email.
    
    Delegates to specific functions, maintains single return type.
    
    Args:
        identifier: User ID or email address
    
    Returns:
        User if found, None otherwise
    """
    id_type = parse_user_identifier(identifier)
    
    if id_type == "id":
        return find_user_by_id(identifier)
    else:
        return find_user_by_email(identifier)
```

---

## Python Idioms

### ✅ Good: Pythonic Patterns
- dict comprehensions
- list comprehensions
- generator expressions for memory efficiency when needed
- context managers
- any / all for boolean reductions
```python

# Generator expressions for memory efficiency
def process_large_dataset(items: list[dict[str, str]]) -> Iterator[dict[str, str]]:
    """Process large dataset lazily."""
    return (transform(item) for item in items if is_valid(item))

# Context managers for resource management
def read_config_file(path: Path) -> dict[str, str]:
    """Read config file with proper resource management."""
    with path.open() as f:
        return json.load(f)

# Dictionary get() with default
def get_config_value(config: dict[str, str], key: str) -> str:
    """Get config value with default."""
    return config.get(key, "default_value")

# Zip for parallel iteration
def merge_data(ids: list[str], names: list[str]) -> list[dict[str, str]]:
    """Merge parallel lists into dictionaries."""
    return [{"id": id_, "name": name} for id_, name in zip(ids, names)]

# Pathlib for file operations
def list_python_files(directory: Path) -> list[Path]:
    """List all Python files in directory."""
    return list(directory.glob("**/*.py"))

# Dataclass field() for mutable defaults
from dataclasses import dataclass, field

@dataclass
class Config:
    """Configuration with mutable defaults done right."""
    name: str
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)
```

### ❌ Bad: Unpythonic Patterns

```python
# Manual index iteration instead of enumerate
def find_first_match(items, pattern):
    """Using manual index - unpythonic."""
    for i in range(len(items)):  # Use enumerate instead!
        if pattern in items[i]:
            return i
    return -1

# Not using context managers
def read_file(path):
    """Manual file handling - error-prone."""
    f = open(path)  # What if an exception occurs before close()?
    data = f.read()
    f.close()
    return data

# Checking existence before accessing
def get_value(data):
    """Verbose existence checking."""
    if "key" in data:
        return data["key"]
    else:
        return None
    # Use: data.get("key") instead!

# Manual boolean reduction
def all_valid(users):
    """Manual boolean check - verbose."""
    for user in users:
        if not user.is_valid:
            return False
    return True
    # Use: all(user.is_valid for user in users)

# Mutable default arguments - DANGEROUS, never do this!
def add_item(item, items=[]):
    """Mutable default - BUG!"""
    items.append(item)  # items is shared across calls!
    return items

# Multiple calls share the same list:
add_item(1)  # [1]
add_item(2)  # [1, 2] - WAT?

# String concatenation in loops
def build_query(fields):
    """String concat in loop - inefficient."""
    query = "SELECT "
    for field in fields:
        query += field + ", "  # Creates new string each iteration!
    query += "FROM table"
    return query
    # Use: f"SELECT {', '.join(fields)} FROM table"
```

### ✅ Good: Modern Python 3.10+ Features

```python
# Union types with |
def parse_value(value: str) -> int | float | None:
    """Parse numeric value using modern union syntax."""
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return None

# Match statements for pattern matching
def handle_response(status_code: int, body: dict[str, str]) -> str:
    """Handle HTTP response with match statement."""
    match status_code:
        case 200:
            return f"Success: {body.get('message', 'OK')}"
        case 404:
            return "Resource not found"
        case 500 | 502 | 503:
            return f"Server error: {status_code}"
        case _:
            return f"Unexpected status: {status_code}"

# Structural pattern matching
def process_message(message: dict[str, str | int]) -> str:
    """Process message with structural pattern matching."""
    match message:
        case {"type": "user_created", "user_id": user_id}:
            return f"User created: {user_id}"
        case {"type": "user_deleted", "user_id": user_id}:
            return f"User deleted: {user_id}"
        case {"type": "error", "message": msg}:
            return f"Error: {msg}"
        case _:
            return "Unknown message type"

# Built-in generic types (no typing imports)
def group_by_key(
    items: list[dict[str, str]],
    key: str
) -> dict[str, list[dict[str, str]]]:
    """Group items by key value."""
    groups: dict[str, list[dict[str, str]]] = {}
    for item in items:
        group_key = item.get(key, "unknown")
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(item)
    return groups
```
---
## Summary

This reference provides comprehensive examples of Python best practices for distributed systems and data processing applications. Key principles:

1. **Type Safety**: Use built-in types (`list`, `dict`, `set`) in type hints, never import from `typing`
2. **Clean Architecture**: Dependency injection, single responsibility, clear boundaries
3. **Proper Data Structures**: Dataclasses for internal data, Pydantic for external interfaces
4. **Explicit Error Handling**: Let exceptions bubble up, catch specific exceptions only
5. **Modern Python**: Use Python 3.10+ features, f-strings, absolute imports
6. **Structured Logging**: Use structlog for queryable, parseable logs
7. **Clear Code Organization**: Google-style docstrings, main function pattern, top-level imports
8. **Pythonic Idioms**: Comprehensions, context managers, generator expressions

When in doubt, refer to the "Good" examples in this reference and avoid the patterns shown in "Bad" examples.
