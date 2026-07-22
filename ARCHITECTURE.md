# LingoSpeak Backend Architecture

This document describes the refactored architecture of the NestJS backend.

## 1. Folder Structure
The backend is located in `apps/api/src/`. Key directories:
- `main.ts` & `app.module.ts`: Entry points.
- `config/`: Centralized environment configurations using `@nestjs/config`.
- `database/`: Database connectivity, mainly the `PrismaService`.
- `common/`: Shared code across modules, including `decorators`, `guards`, `types`, `constants`, `exceptions`, and utilities.
- `modules/`: Feature-based business modules (e.g., `auth`, `bookings`, `commerce`, `users`, `teachers`).

Each module follows a domain-driven layout:
- `controllers/`: HTTP routing and parameter validation using `class-validator` DTOs.
- `services/`: Business logic. Large services are split by responsibility (e.g. `payments.service.ts`, `wallet.service.ts`).
- `repositories/`: Encapsulation of complex or repeated Prisma queries.
- `dto/request/`: Classes defining incoming request shapes.
- `dto/response/`: Classes defining outbound API shapes.
- `mappers/`: Transforms Prisma entities into Response DTOs using `class-transformer`.

## 2. Module Boundaries
- Modules define clear `imports`, `controllers`, `providers`, and `exports`.
- Services and repositories that are used across domains must be explicitly exported by their owning module.
- Dependencies avoid deep relative paths across domains where possible.

## 3. Responsibilities
**Controllers:** Strictly for HTTP concerns: routing, guards, parameter extraction, and returning service results. No Prisma queries, `process.env` access, or complex business logic.

**Services:** Implement business rules, coordinate operations, and handle transactions.

**Repositories:** Handle data access. Any complex joins, pagination, or aggregate queries live here to keep services clean.

**DTOs (Data Transfer Objects):**
- *Request DTOs* (`dto/request/`) use `class-validator` and `class-transformer` to validate inputs. They are never declared inline within controllers.
- *Response DTOs* (`dto/response/`) use `class-transformer`'s `@Expose()` to explicitly shape public API responses, ensuring internal/sensitive fields are not leaked.

## 4. Configuration
- Configuration is centralized in `src/config/`.
- Namespaces (e.g., `appConfig`, `authConfig`, `redisConfig`) are registered via `@nestjs/config`.
- Environment variables are validated using Zod in `env.validation.ts` during application startup.
- Services inject `ConfigService` rather than accessing `process.env` or untyped global helpers directly.

## 5. Authentication & Authorization
- Authentication is token-based (JWT).
- The auth infrastructure lives in `src/common/`:
  - `decorators/`: `@CurrentUser()`, `@Public()`, `@Roles()`, `@Permissions()`.
  - `guards/`: `AccessGuard`, `AuthorizationGuard`.
  - `types/`: Strongly typed `AuthUser`.

## 6. Global Validation & Error Handling
- A global `ValidationPipe` is registered in `main.ts` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Custom global exception filters translate Prisma and application errors into standardized API responses.
