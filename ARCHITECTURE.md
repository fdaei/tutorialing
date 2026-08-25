# LingoSpeak Architecture

This document describes the workspace boundaries for the NestJS API and Next.js web application.

## 1. Workspace structure

- `apps/api/`: NestJS application.
- `apps/web/`: Next.js App Router application.
- `packages/contracts/`: Framework-independent schemas and types shared by both applications.
- `scripts/`: Repository setup and health-check tooling.
- `load/`: Load and concurrency scenarios; never imported by application code.

## 2. API structure

The API is located in `apps/api/src/`:

- `main.ts` and `app.module.ts`: composition root only.
- `config/`: validated environment input, defaults, and typed feature config factories.
- `infrastructure/`: external adapters such as Prisma and Redis. Business modules depend on these adapters, never the reverse.
- `common/`: framework-level decorators, guards, errors, middleware, and shared types. It must not contain feature business logic.
- `modules/`: independently composed business features such as `auth`, `bookings`, `commerce`, and `teachers`.

Each module follows a domain-driven layout:
- `controllers/`: HTTP routing and parameter validation using `class-validator` DTOs.
- `services/`: Business logic. Large services are split by responsibility (e.g. `payments.service.ts`, `wallet.service.ts`).
- `repositories/`: Encapsulation of complex or repeated Prisma queries.
- `dto/request/`: Classes defining incoming request shapes.
- `dto/response/`: Classes defining outbound API shapes.
- `mappers/`: Transforms Prisma entities into Response DTOs using `class-transformer`.

## 3. Web structure

The web application is located in `apps/web/src/`:

- `app/`: route composition, layouts, loading/error boundaries, and page entry points.
- `features/<feature>/components/`: feature-owned UI and behavior. Cross-feature imports should use the `@/` alias.
- `components/shared/`: genuinely reusable controls with no business-feature ownership.
- `components/layout/`: application chrome such as header and footer.
- `lib/`: framework-independent clients and utilities, not React feature components.
- `config/`: the only application location allowed to read environment variables.

Feature components must not be added back to a flat global `components/` directory.

## 4. Module Boundaries
- Modules define clear `imports`, `controllers`, `providers`, and `exports`.
- Services and repositories that are used across domains must be explicitly exported by their owning module.
- Dependencies avoid deep relative paths across domains where possible.

## 5. Responsibilities
**Controllers:** Strictly for HTTP concerns: routing, guards, parameter extraction, and returning service results. No Prisma queries, `process.env` access, or complex business logic.

**Services:** Implement business rules, coordinate operations, and handle transactions.

**Repositories:** Handle data access. Any complex joins, pagination, or aggregate queries live here to keep services clean.

**DTOs (Data Transfer Objects):**
- *Request DTOs* (`dto/request/`) use `class-validator` and `class-transformer` to validate inputs. They are never declared inline within controllers.
- *Response DTOs* (`dto/response/`) use `class-transformer`'s `@Expose()` to explicitly shape public API responses, ensuring internal/sensitive fields are not leaked.

## 6. Configuration
- Configuration is centralized in `src/config/`.
- Typed factories such as `authConfig`, `filesConfig`, and `paymentConfig` expose feature-specific settings.
- Environment variables are validated using Zod in `env.validation.ts` during application startup.
- Runtime code consumes typed feature config. Only config entry points may read `process.env`.

## 7. Logging

- `infrastructure/logging/` owns the Pino/NestJS adapter and HTTP logger configuration.
- Application code uses Nest's `Logger`; it never imports Pino directly. This keeps services independent from the logging backend.
- Logs are structured JSON outside local pretty mode and include request ID, HTTP method, path, status, service, and context.
- Authorization, cookies, tokens, passwords, and secrets are redacted. Request bodies are not logged.
- `x-request-id` is accepted only when it matches the safe request-ID format; otherwise the API generates one.
- Health-request access logs are disabled by default to avoid probe noise and can be enabled explicitly.

## 8. Authentication & Authorization
- Authentication is token-based (JWT).
- The auth infrastructure lives in `src/common/`:
  - `decorators/`: `@CurrentUser()`, `@Public()`, `@Roles()`, `@Permissions()`.
  - `guards/`: `AccessGuard`, `AuthorizationGuard`.
  - `types/`: Strongly typed `AuthUser`.

## 9. Global Validation & Error Handling
- A global `ValidationPipe` is registered in `main.ts` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Custom global exception filters translate Prisma and application errors into standardized API responses.
