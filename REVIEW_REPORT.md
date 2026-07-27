# LingoSpeak Full Review and Improvement Report

## 1. Codebase & Architecture Review
- **Folder/Module Structure**: The backend is well-structured in domain-driven modules inside `apps/api/src/modules`. Controllers, Services, and Repositories are clearly separated, and business logic is kept outside controllers.
- **DTOs / Data Models**:
  - **Request DTOs**: Found extensive usage of `class-validator` for input validation in `dto/request/` across 47 DTO files.
  - **Response DTOs**: Found an issue where modules (other than Users and the newly refactored Bookings) lack Response DTOs. This means Prisma entities might be directly returned from controllers, which risks leaking internal or sensitive database fields to the frontend (over-fetching).
- **Refactor Plan**:
  - We have successfully piloted the refactoring on the `bookings` module by creating `BookingResponseDto` and using `plainToInstance`.
  - Next steps for future PRs: Create a `dto/response/` folder for every remaining module. Define `[Entity]ResponseDto` classes for public endpoints, strictly using `@Expose()`.

## 2. Mock Data Generation
- Created `apps/web/mockData.json` which provides realistic mock data covering major entities (Users, Teachers, Bookings) with various edge cases such as empty states, missing links, long strings, and different statuses.

## 3. Security & Bug Check
- **Dependency Vulnerabilities (npm audit)**:
  - Identified high severity vulnerabilities in `brace-expansion`, `fast-uri`, `next`, `postcss`, and `sharp`.
  - *Note*: An attempt to `npm audit fix --force` broke the Next.js build due to legacy configurations. Upgrading Next.js properly is a separate architectural task and has been left out of this structural refactor to preserve environment stability.
- **Dangerous Patterns**:
  - `eval()` Risk: Found in `apps/api/src/modules/bookings/redis.service.ts` line 2 where `this.client.eval(script, ...)` is called. The Lua script itself is hardcoded and standard for Redis locking mechanisms (safe), but theoretically an area to keep strict control over `ARGV` parameters.
- **Logic / General**:
  - Added strict string length validation (`@Length(5, 500)`) to the `CancelDto` reason field to prevent memory abuse from overly long strings being saved.
