```markdown
# openclaw-revenue-engine Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `openclaw-revenue-engine` TypeScript codebase. You'll learn how to structure files, write and organize code, follow commit conventions, and implement and run tests according to the project's standards.

## Coding Conventions

### File Naming
- Use **PascalCase** for filenames.
  - Example: `RevenueCalculator.ts`, `InvoiceService.ts`

### Import Style
- Use **relative imports** for referencing local modules.
  - Example:
    ```typescript
    import { calculateRevenue } from './RevenueCalculator';
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```typescript
    // RevenueCalculator.ts
    export function calculateRevenue(data: RevenueData): number {
      // implementation
    }
    ```

### Commit Messages
- Follow **Conventional Commits** format.
- Common prefixes: `docs`, `feat`
- Example:
  ```
  feat: add invoice calculation logic
  docs: update API usage in README
  ```

## Workflows

### Creating a New Feature
**Trigger:** When adding new functionality to the codebase  
**Command:** `/new-feature`

1. Create a new file using PascalCase (e.g., `NewFeature.ts`).
2. Implement the feature using TypeScript.
3. Use relative imports to include dependencies.
4. Export your functions or classes as named exports.
5. Write corresponding test files (e.g., `NewFeature.test.ts`).
6. Commit your changes using the `feat:` prefix.
   ```
   feat: implement new feature for revenue calculation
   ```

### Updating Documentation
**Trigger:** When updating or adding documentation  
**Command:** `/update-docs`

1. Edit or create documentation files as needed.
2. Use clear and concise language.
3. Commit your changes using the `docs:` prefix.
   ```
   docs: add usage examples to README
   ```

## Testing Patterns

- Test files follow the pattern: `*.test.*` (e.g., `RevenueCalculator.test.ts`).
- The testing framework is not specified; follow the existing test file structure.
- Place test files alongside the modules they test or in a dedicated test directory.
- Example test file structure:
  ```typescript
  // RevenueCalculator.test.ts
  import { calculateRevenue } from './RevenueCalculator';

  describe('calculateRevenue', () => {
    it('should return correct revenue for valid data', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command         | Purpose                                    |
|-----------------|--------------------------------------------|
| /new-feature    | Scaffold and implement a new feature       |
| /update-docs    | Update or add documentation                |
```
