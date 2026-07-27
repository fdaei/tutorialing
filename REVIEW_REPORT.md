# LingoSpeak Full Review and Improvement Report

## 1. Codebase & Architecture Review
- **Folder/Module Structure**: The backend is well-structured in domain-driven modules inside `apps/api/src/modules`. Controllers, Services, and Repositories are clearly separated, and business logic is kept outside controllers.
- **DTOs / Data Models**:
  - **Request DTOs**: Found extensive usage of `class-validator` for input validation in `dto/request/` across 47 DTO files.
  - **Response DTOs**: Only the `users` module has implemented `Response DTOs` using `class-transformer` `@Expose()` (in `apps/api/src/modules/users/dto/response/user-profile-response.dto.ts`).
  - **Issue**: Other modules currently lack Response DTOs. This means Prisma entities might be directly returned from controllers, which risks leaking internal or sensitive database fields to the frontend (over-fetching).
- **Refactor Plan (Proposed)**:
  - Create a `dto/response/` folder for every module.
  - Define `[Entity]ResponseDto` classes for public endpoints, strictly using `@Expose()` for fields that should be public.
  - Add `mappers/` or use `plainToInstance` in controllers to map database results to these DTOs.
  - Review input DTOs to ensure strict bounds (e.g. string lengths, specific enums).


## 2. Security & Bug Check
- **Dependency Vulnerabilities (npm audit)**:
  - `brace-expansion <= 5.0.7` (High) - DoS via unbounded expansion length.
  - `fast-uri 3.0.0 - 3.1.3` (High) - Host confusion via literal backslash.
  - `next < 14.x` (High) - Multiple vulnerabilities including DoS, SSRF, Cache Confusion, etc.
  - `postcss <= 8.5.17` (High) - XSS via Unescaped CSS Output.
  - `sharp < 0.35.0` (High) - Multiple vulnerabilities in libvips.
  - *Recommendation*: Upgrade dependencies via `npm audit fix`, but test carefully as Next.js upgrades can be breaking.
- **Dangerous Patterns**:
  - `eval()` Risk: Found in `apps/api/src/modules/bookings/redis.service.ts` line 2 where `this.client.eval(script, ...)` is called. While this executes a Lua script on the Redis server and the script itself is hardcoded (safe), it should be noted as a standard practice but theoretically an area to keep strict control over `ARGV` parameters.
- **Authentication Checks**:
  - Controllers like `SearchController`, `LanguagesController`, and `TeachersController` correctly define routes that are meant to be public, but verify that `@Public()` or correct auth guards are applied globally or locally. The app uses a global authentication model with explicit `@Public()` overrides.
- **Logic / General**:
  - Missing response DTOs as noted earlier are a primary over-fetching and data-leak bug. Fix prioritized.
