```markdown
# openclaw-revenue-engine Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `openclaw-revenue-engine` repository. The codebase is primarily written in Python, with an Express framework structure, and emphasizes consistent file naming, import/export styles, and testing practices. Understanding these patterns will help you contribute effectively and maintain code quality.

## Coding Conventions

### File Naming
- Use **snake_case** for all file and module names.
  - Example: `revenue_calculator.py`, `user_service.py`

### Import Style
- Use **relative imports** within modules.
  - Example:
    ```python
    from .models import RevenueModel
    from .utils import calculate_total
    ```

### Export Style
- Use **named exports** (explicitly listing exported classes, functions, or variables).
  - Example:
    ```python
    __all__ = ['RevenueModel', 'calculate_total']
    ```

### Commit Messages
- Commit messages are **freeform** (no strict convention), but typically concise (average 49 characters).
  - Example: `fix revenue calculation for edge cases`

## Workflows

_No explicit workflows detected in the repository._

## Testing Patterns

- **Framework:** jest
- **Test File Pattern:** All test files use the `*.test.ts` naming convention.
  - Example: `revenue_engine.test.ts`
- **Test Example:**
  ```typescript
  import { calculateRevenue } from './revenue_engine';

  test('calculates revenue correctly', () => {
    expect(calculateRevenue([100, 200])).toBe(300);
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| /run-tests | Run all jest tests in the codebase |
| /lint     | Lint the codebase according to project standards |
| /build    | Build the project for deployment |
| /start    | Start the Express server for local development |
```