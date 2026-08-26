# Deep Semantic Architecture Audit

Date: 2026-08-26  
Scope: `apps/api/src`, `apps/api/test`, `apps/api/prisma`, and the existing `AUDIT` corpus.  
Mode: independent, read-only audit. No production source was changed.

## Executive conclusion

The repository is a coherent modular NestJS monolith, but its filesystem is **not yet an accurate semantic architecture**. Most product capabilities are recognizable and the import graph is acyclic, yet four important boundaries are wrong or missing:

1. `modules/queue` is not a product feature. It is a BullMQ runtime adapter that also owns booking-expiration, payment rollback, discount release, reminder persistence, notification rendering, and SMS orchestration. This is the most serious semantic boundary violation.
2. `modules/health` is an operational probe, not a business capability.
3. `modules/files` is a legitimate file-lifecycle capability, but its application policy and S3 adapter are fused in one service.
4. `common/core` is a global ownership dump: HTTP/security framework primitives are mixed with Auth token revocation and admin-managed business settings/audit persistence.

The architecture tests protect a few useful syntactic properties, but one test explicitly derives “feature modules” from the current `src/modules` directory. It therefore preserves the very classifications this audit disputes. The current tests prove neither dependency inversion nor correct semantic ownership.

There is no justification for imposing four Clean Architecture folders on every feature. The appropriate target is still a modular monolith: keep cohesive capabilities mostly flat, introduce narrow ports only at volatile/external boundaries, and separate operational runtime components from product capabilities.

## Method and classification rule

Classification was derived from behavior, model ownership, routes, injected dependencies, cross-module calls, and replacement tests:

- A component is a **Domain / Business Feature** when its concept survives replacement of NestJS, Prisma, Redis, BullMQ, S3, or an external provider.
- **Application** coordinates use cases/read models spanning one or more capabilities but is not itself necessarily a bounded context.
- **Infrastructure** implements technology/provider mechanisms.
- **System / Operational** exists to run, observe, or diagnose the deployed service.
- **Shared / Common** must be broadly reusable, ownership-neutral, and dependency-light.
- **Configuration / Bootstrap** validates configuration or composes the runtime.

Direct Prisma use is widespread. In a monolith of this size it is not automatically a defect: introducing a repository port for every CRUD service would be ceremony. It becomes a material violation where technology leaks into business contracts, where a volatile external provider is constructed inside a feature, or where an infrastructure worker calls domain internals.

## A. Architecture Classification Matrix

| Component | Current location | Actual responsibility | Classification | Correct location? | Recommended location | Severity |
|---|---|---|---|---|---|---|
| App composition | `src/app.module.ts` | Builds global framework, infrastructure, operational and feature graph | Configuration / Bootstrap | Partly | `src/app.module.ts`, but import aggregated platform/system modules | MEDIUM |
| Startup | `src/main.ts` | HTTP bootstrap, pipes, filters, Swagger, shutdown | Configuration / Bootstrap | Yes | Keep | INFO |
| Environment config | `src/config`, `src/env.ts` | Environment validation and typed configuration | Configuration / Bootstrap | Yes | Keep; make module semantics explicit | LOW |
| `ConfigModule` | `src/config/config.module.ts` | Empty Nest module; configuration is actually module-level functions | Configuration / Bootstrap | Misleading | Remove Nest wrapper or make it the real config boundary | LOW |
| Prisma | `src/infrastructure/database` | Database client lifecycle and transaction types | Infrastructure | Yes | Keep | INFO |
| Redis | `src/infrastructure/cache` | Redis client plus distributed lock and rate-consumption primitives | Infrastructure | Mostly | `infrastructure/redis` or split narrow cache/lock/rate-limit adapters if behavior grows | MEDIUM |
| Logging | `src/infrastructure/logging` | Pino/Nest logging adapter | Infrastructure | Yes | Keep and aggregate through platform infrastructure | LOW |
| SMS messaging | `src/infrastructure/messaging` | Provider-neutral SMS contract plus Kavenegar implementation | Infrastructure | Yes | Keep | INFO |
| `InfrastructureModule` | `src/infrastructure/infrastructure.module.ts` | Global aggregation of Prisma, Redis, messaging; excludes logging and BullMQ | Infrastructure composition | Incomplete | Aggregate all external mechanisms, or deliberately rename to `DataInfrastructureModule` | MEDIUM |
| Auth | `src/modules/auth` | OTP, sessions, JWT issuance/refresh/logout and OTP delivery coordination | Domain / Business Feature | Yes, with adapter leakage substantially removed | `modules/auth`; own token-revocation policy here | LOW |
| Users | `src/modules/users` | Profile, locale, favorites | Domain / Business Feature | Yes | Keep | INFO |
| Teachers | `src/modules/teachers` | Directory, application, verification, pricing, reviews | Domain / Business Feature (large capability cluster) | Mostly | Keep initially; expose explicit facade contracts, consider submodules only as change pressure grows | MEDIUM |
| Bookings + availability | `src/modules/bookings` | Scheduling, availability, booking lifecycle, cancellation/reschedule, completion | Domain / Business Feature | Mostly | Keep; own expiration use case and job contracts | HIGH |
| Commerce | `src/modules/commerce` | Packages, checkout/payment, wallet/refund/reconciliation, discounts, earnings/payouts | Domain / Business Feature (capability group) | Mostly | Keep group; replace raw exported service/function with use-case contracts | MEDIUM |
| Languages | `src/modules/languages` | Product language catalogue and proficiency metadata | Domain / Business Feature / reference-data capability | Yes | Keep | INFO |
| Learning | `src/modules/learning` | Evaluation, plans, assignments, submissions | Domain / Business Feature | Yes | Keep | INFO |
| Matching | `src/modules/matching` | Teacher matching sessions and recommendations | Domain / Business Feature | Yes; dependency surface is leaky | Keep, depend on a narrow availability query API | MEDIUM |
| Assessment (`TestsModule`) | `src/modules/tests` | Test definitions, attempts, scoring, examiner review, builder workflow | Domain / Business Feature | Semantically yes; name is ambiguous | `modules/assessment` | MEDIUM |
| Support | `src/modules/support` | Ticket workflow plus notification inbox, public CMS page and settings reads | Mixed business capabilities | No | `modules/support`; move inbox to `modules/notifications`; public content/settings to their owners | HIGH |
| Admin | `src/modules/admin` | Admin façade for users, roles, teachers, bookings, tickets, payments, CMS, settings, audit, dashboard | Application / Back-office composition plus several domain owners | Partly | `modules/backoffice` as application façade; move owned capabilities/policies to identity/content/settings/audit | HIGH |
| Search | `src/modules/search` | Permission-aware, staff-facing federated search read model using Prisma | Application / Product Feature, **not search-engine infrastructure** | Mostly | `application/search` or retain `modules/search` with an explicit cross-domain read-model status | MEDIUM |
| Files | `src/modules/files` | File metadata/lifecycle, ownership/access policy, upload completion and download | Domain capability + infrastructure adapter | Mixed | Keep `modules/files`; extract `ObjectStoragePort` and `infrastructure/storage/s3-object-storage.adapter.ts` | HIGH |
| Queue | `src/modules/queue` | Constructs BullMQ queue/worker and executes booking, commerce, notification and SMS workflows | Infrastructure + application workers + leaked domain policy | No | `infrastructure/jobs/bullmq`; domain handlers/contracts in owning features | HIGH |
| Health | `src/modules/health` | Postgres/Redis readiness probe | System / Operational | No | `system/health` | MEDIUM |
| `common/core` HTTP primitives | `src/common/core/{decorators,guards,filters,middleware,types}` | Cross-cutting HTTP/auth metadata and request pipeline | Shared framework/application kernel | Mostly | `common/http` and/or `system/security`; keep dependency-light | MEDIUM |
| Domain exceptions/assertions | `src/common/core/exceptions`, `src/common/utils/assertion.util.ts` | Shared error vocabulary and invariant helpers | Shared / Common | Yes | `common/errors`, `common/assertions` | LOW |
| `SettingsService` | `src/common/core/services` | Reads admin-controlled business rules from Prisma | Application/business configuration | No | `modules/settings` (or back-office settings capability) | HIGH |
| `AuditService` | `src/common/core/services` | Writes persistent actor/entity audit records | System/Application audit capability | No | `system/audit` with a narrow port if domain callers need it | MEDIUM |
| `TokenRevocationService` | `src/common/core/services` | Auth session invalidation via Redis | Auth application policy + infrastructure mechanism | No | `modules/auth`; depend on a revocation-store port implemented in infrastructure/redis | HIGH |
| Prisma schema/migrations | `apps/api/prisma` | Monolith persistence model and history | Infrastructure data definition | Yes | Keep; document logical model ownership | INFO |
| Unit specs colocated under `src` | beside source | Unit/architecture regression tests | Test support | Yes | Keep colocated | INFO |
| E2E tests | `apps/api/test` | Whole-app platform verification | Test support | Yes | Keep | INFO |
| Existing `AUDIT` | `AUDIT` | Historical technical assessments and decisions | Documentation | Yes | Keep, but mark superseded semantic claims | MEDIUM |

## B. Architectural Findings

### ARCH-001 — Queue is technology-named infrastructure containing domain workflows

- **Severity:** HIGH
- **Evidence:** `queue.service.ts:2,48-66` directly constructs BullMQ `Queue` and `Worker`; `:68-140` renders/persists notifications and sends SMS; `:160-207` changes Booking, Payment, WalletEntry, CreditEntry and Discount state; `:191` calls Commerce's `releaseDiscount`; `:209-233` creates Reminder records and schedules jobs.
- **Current structure:** `modules/bookings -> modules/queue -> modules/commerce`, while Queue also depends on Prisma, config and messaging infrastructure.
- **Why wrong:** BullMQ is replaceable infrastructure, yet its worker owns business decisions across Booking and Commerce. The dependency direction is inverted: an infrastructure runtime knows domain internals and exported domain functions. Queue lifecycle and domain use cases cannot evolve independently.
- **Recommended structure:** define narrow application contracts such as `BookingJobs.scheduleExpiration()` and `BookingJobs.scheduleReminders()` in Bookings; place BullMQ producer/consumer wiring in `infrastructure/jobs/bullmq`; have handlers call owning use cases such as `ExpireBooking` and `DeliverBookingReminder`. Do not create a generic job abstraction beyond currently needed jobs.
- **Migration risk:** HIGH. Job names, payload compatibility, idempotency, retry semantics, delayed jobs already stored in Redis, and transaction behavior must be preserved.

### ARCH-002 — Health is incorrectly represented as a feature module

- **Severity:** MEDIUM
- **Evidence:** `health.controller.ts:34-80` is explicitly a liveness/readiness probe and only executes `SELECT 1` and Redis `PING`; it owns no product model or business workflow.
- **Current structure:** `src/modules/health` and imported among feature modules in `AppModule`.
- **Why wrong:** Replacing the application product while retaining the deployment would retain this probe; replacing deployment dependencies changes it. That is the definition of an operational concern.
- **Recommended structure:** move unchanged to `src/system/health`; keep it composed at the root because probes are root runtime concerns.
- **Migration risk:** LOW and purely structural if route `/health` and DI remain unchanged.

### ARCH-003 — File capability and S3 adapter are fused

- **Severity:** HIGH
- **Evidence:** `files.service.ts:27-36` constructs `S3Client`; `:55-65`, `:74-83`, `:91-105`, and `:128-132` issue AWS commands/presigned URLs. The same class enforces MIME/size/checksum rules, ownership/reviewer access, and file status transitions.
- **Current structure:** all behavior is `modules/files/FilesService`.
- **Why wrong:** File lifecycle and authorization survive an S3/MinIO/local-storage replacement, but command construction does not. Tests of policy require mocking AWS behavior, and infrastructure details leak into the feature.
- **Recommended structure:** keep `FilesService` and `StoredFile` ownership in `modules/files`; introduce a narrow `ObjectStorage` contract matching only `put`, `head`, and signed get/put needs; implement it under `infrastructure/storage`.
- **Migration risk:** MEDIUM. Preserve URL TTL, metadata/checksum behavior, ContentLength/ContentType checks and MinIO path-style configuration.

### ARCH-004 — Common is globally available but not semantically common

- **Severity:** HIGH
- **Evidence:** `common/core/common.module.ts` globally exports `AuditService`, `SettingsService`, and `TokenRevocationService`. These directly import Prisma or Redis. `SettingsService` reads money and booking rules; token revocation is Auth behavior; audit writes persistent operational records.
- **Current structure:** ownership-specific stateful services are injectable everywhere without explicit module dependencies.
- **Why wrong:** “Used by many” is not the same as “ownership-neutral.” Global visibility hides dependencies and makes `common` a service locator. It also contradicts the comment in the architecture test that common is simply the shared layer every module may use.
- **Recommended structure:** retain only dependency-light errors/assertions and HTTP primitives in common. Move token revocation to Auth, settings to a Settings capability, and persistent audit to `system/audit`; import/export them explicitly or expose narrow tokens.
- **Migration risk:** MEDIUM. Nest provider visibility and global guards must be rewired carefully; behavior need not change.

### ARCH-005 — Infrastructure aggregation is incomplete and its global scope hides dependencies

- **Severity:** MEDIUM
- **Evidence:** `InfrastructureModule` aggregates Prisma, Redis and Messaging, but Logging is imported separately by `AppModule`, BullMQ lives in `modules/queue`, and S3 is constructed inside Files. The module is `@Global`, enabling dozens of direct Prisma/Redis injections without declared feature imports.
- **Current structure:** neither a complete infrastructure composition nor a narrowly named data module.
- **Why wrong:** its name promises a boundary it does not represent; global exports make the runtime graph look simpler than the source dependency graph.
- **Recommended structure:** after extracting jobs/storage, aggregate external adapters under a platform/infrastructure composition module. Keep a global Prisma client if pragmatic, but do not mistake global DI availability for dependency inversion. Prefer explicit module imports for non-ubiquitous adapters.
- **Migration risk:** MEDIUM, largely structural/DI-related.

### ARCH-006 — Search is a federated application read model, not an engine adapter

- **Severity:** MEDIUM
- **Evidence:** `SearchService` switches over nine business entity types and builds Prisma queries for Users, Teachers, Tests, Passages, Bookings, Payments, Languages, Support agents and Roles. It imports no Elasticsearch/OpenSearch SDK. `SearchAccessPolicy` maps entity categories to product permissions.
- **Current structure:** a top-level `modules/search` feature touching many bounded contexts through the shared database.
- **Why wrong:** calling it infrastructure would be false: it contains product-facing query semantics and authorization categories. However, treating it as an autonomous domain is also misleading; it is a staff application read model over other domains.
- **Recommended structure:** either place it at `application/search`, or document `modules/search` as a cross-domain query capability. If an engine is later introduced, define a query/index port owned by this application capability and place Elasticsearch/OpenSearch implementations in `infrastructure/search`.
- **Migration risk:** LOW for documentation/location; HIGH only if replacing Prisma queries or introducing indexing/eventual consistency.

### ARCH-007 — `TestsModule` is a real feature with a misleading name

- **Severity:** MEDIUM
- **Evidence:** its runtime controllers expose test definitions, attempts, section submission, scoring, examiner review and builder routes; `TestsService` is 866 lines and operates the assessment models from `TestDefinition` through `ExaminerReview`.
- **Current structure:** `src/modules/tests`, easily confused with `apps/api/test` or `*.spec.ts`.
- **Why wrong:** location under runtime modules is correct; the semantic name is not. The module would remain a language-assessment capability if Jest/Nest were replaced.
- **Recommended structure:** rename to `modules/assessment` (or `language-assessment`) and `AssessmentModule`; retain colocated unit specs and E2E tests in `apps/api/test`.
- **Migration risk:** LOW, purely structural except API/internal symbol imports; do not move production code into `apps/api/test`.

### ARCH-008 — Support owns unrelated notification inbox and public content/settings reads

- **Severity:** HIGH
- **Evidence:** `SupportService` implements ticket creation/list/detail/reply/status/assignment, but also `notifications()`, `read()`, `page()` and `settings()`. `NotificationsController` is registered by `SupportModule`; Prisma Notification models are produced by Auth, Bookings, Commerce, Queue, Support, Teachers and Tests.
- **Current structure:** Support appears to own cross-product notification reads and public CMS/settings solely because those endpoints needed a home.
- **Why wrong:** ticket workflow is a bounded business capability; user notification inbox and public CMS/settings are distinct responsibilities with different producers and evolution paths.
- **Recommended structure:** keep ticket workflow in Support; move inbox/read state to a narrow `modules/notifications` capability without centralizing every domain's wording/recipient decisions; move public CMS/settings queries to content/settings owners.
- **Migration risk:** MEDIUM. Controller route paths can remain stable, but transaction and notification ownership should not be changed in the same structural step.

### ARCH-009 — Admin is a back-office façade presented as a domain owner

- **Severity:** HIGH
- **Evidence:** `AdminService` lists/manages users and roles, exposes teacher applications, bookings, tickets, payment reports, settings, CMS and audit; `AdminRepository` queries models owned across most modules; `AdminController` directly injects `TeachersService`.
- **Current structure:** `modules/admin` owns miscellaneous operations selected by actor/UI rather than business cohesion.
- **Why wrong:** “admin” is a delivery persona/application surface, not one bounded context. Business transitions and authorization policy risk being duplicated between public and back-office services.
- **Recommended structure:** retain a thin `backoffice` application module/controller if convenient, but delegate commands/queries to owning capabilities. Move role/permission rules toward Auth/Identity; CMS to Content; Settings and Audit to their explicit owners. Avoid an all-purpose cross-domain repository.
- **Migration risk:** HIGH if use cases are moved; LOW if first only renamed/documented and dependencies made explicit.

### ARCH-010 — Feature-to-feature dependencies expose concrete services and functions

- **Severity:** MEDIUM
- **Evidence:** Matching injects `AvailabilityService`; Admin injects `TeachersService`; Bookings injects `EarningsService` and `QueueService`; Queue calls exported `releaseDiscount`. The commerce barrel is explicitly pinned to concrete symbols.
- **Current structure:** Nest service classes and internal transaction functions serve as public module APIs.
- **Why wrong:** the graph is acyclic but callers are coupled to broad implementations and internal transaction types. A public barrel fixes path stability, not semantic coupling.
- **Recommended structure:** create only the narrow facades already demanded by current edges: availability candidate query, earning accrual, booking job scheduling, teacher transition/query, and discount-release use case. Avoid repository interfaces for every service.
- **Migration risk:** MEDIUM; signatures and transaction boundaries must stay compatible.

### ARCH-011 — Business layers depend pervasively on concrete Prisma and Prisma-generated domain types

- **Severity:** MEDIUM
- **Evidence:** almost every service imports `PrismaService`; several feature contracts use `Prisma.TransactionClient` aliases (`Tx`, `DbClient`) and generated enums/types. DTOs also import Prisma enums.
- **Current structure:** persistence implementation types form part of service-to-service APIs, especially Commerce/Bookings/Teachers.
- **Why wrong:** this materially locks cross-feature contracts and business transaction orchestration to Prisma. It is less harmful for private CRUD methods, so a repository-per-model rewrite would be over-engineering.
- **Recommended structure:** remove Prisma types first from cross-module/public contracts and volatile business rules. Keep direct Prisma in simple, module-private application services until complexity or alternate persistence warrants repositories.
- **Migration risk:** MEDIUM to HIGH where transactions cross service boundaries.

### ARCH-012 — AppModule is a composition root, but knows too many concrete platform details

- **Severity:** MEDIUM
- **Evidence:** `AppModule` directly imports Config, Logging, Infrastructure, Core, `ScheduleModule.forRoot`, Health, Queue, Files, global `JwtModule.register`, every feature, global guards and request middleware.
- **Current structure:** root both composes capabilities and configures technology/framework primitives.
- **Why wrong:** a composition root is allowed to know top-level modules, so the number of feature imports alone is not a defect. The problem is duplicated JWT registration (global root plus Auth async registration), direct BullMQ/health classification leakage, and separate infrastructure wiring.
- **Recommended structure:** root should import `PlatformModule`/`InfrastructureModule`, `SystemModule`, and feature modules; keep global guard/middleware composition at root. JWT policy belongs to Auth unless another capability genuinely verifies/signs JWT independently. Scheduler configuration may remain root bootstrap while scheduled use cases remain owned by their features.
- **Migration risk:** MEDIUM due to Nest token resolution and global module behavior.

### ARCH-013 — Architecture tests preserve current layout rather than fully enforcing desired architecture

- **Severity:** HIGH
- **Evidence:** `architecture.spec.ts` computes `MODULES` by reading `src/modules`, then asserts that more than ten directories exist and Commerce is one of them. The test calls all of these “feature modules” without semantic definition. Its deep-import regex only examines sibling feature imports and only single-quoted `from` syntax.
- **Current structure:** four tests validate directory count, nested import depth, exact Commerce barrel symbols, and absence of `common -> modules` imports.
- **Why wrong:** Queue and Health pass as “features”; concrete `module -> infrastructure` dependencies, Queue's domain imports, S3/BullMQ SDK imports, globals, dynamic imports, aliases, `require`, and semantic ownership are invisible. Pinning two concrete Commerce exports institutionalizes current coupling.
- **Recommended structure:** define an explicit architecture manifest/classification, enforce allowed direction by category, prohibit technology SDKs in feature files except approved adapters, and assert explicit public API entrypoints. Use TypeScript resolution/AST rather than a partial regex where feasible.
- **Migration risk:** LOW to add tests after target boundaries are agreed; enabling them before moves will intentionally produce failures.

### ARCH-014 — Authorization test offers a false guarantee for self-scoped routes

- **Severity:** MEDIUM
- **Evidence:** `authorization.spec.ts` parses decorators with regex and accepts 42 hard-coded `SELF_SCOPED` method/path entries. Its own comment says these were manually verified; it does not verify service ownership filtering. It scans only controllers under `src/modules`, so moving Health/system or future controllers elsewhere silently changes coverage. It asserts only route count `>= 139`.
- **Current structure:** structural allowlist is treated as a route × authorization matrix.
- **Why wrong:** a matching string proves a reviewer once classified the route, not that current implementation applies owner filtering. Regex parsing can miss decorator/controller syntax variants and non-module controllers.
- **Recommended structure:** discover controllers across all `src`; keep the structural decision test, but pair every self-scoped route with behavioral authorization tests (negative other-user case and positive owner case). Generate or explicitly declare route policy metadata rather than relying on source regex long-term.
- **Migration risk:** LOW for tests; test fixture work is moderate.

### ARCH-015 — Operational scheduling is split between bootstrap, feature services and technology workers

- **Severity:** MEDIUM
- **Evidence:** root installs `ScheduleModule`; Commerce services use lifecycle hooks/cron reconciliation; Queue constructs its own worker on module initialization. Runtime start/stop ownership is distributed and Queue is imported both by AppModule and BookingsModule.
- **Current structure:** no explicit workers/system runtime boundary.
- **Why wrong:** horizontal scaling can accidentally run cron/worker processes in every API replica, and technology lifecycle is mixed into request-serving feature modules.
- **Recommended structure:** create a small `system/workers` or dedicated worker entrypoint when deployment topology requires it; until then document single-process execution and isolate worker registration from domain handlers.
- **Migration risk:** HIGH if deployment topology changes; LOW for isolation/documentation.

## C. Suspicious Modules

### QueueModule

**Decision: not a feature.** The queue name, connection, retries, concurrency and lifecycle are infrastructure. Booking expiration and reminder orchestration are application/domain workflows. Recommended split:

```text
modules/bookings/
  expire-booking.use-case.ts
  booking-jobs.port.ts
  booking-reminder.handler.ts
infrastructure/jobs/bullmq/
  bullmq-booking-jobs.adapter.ts
  bullmq-worker.module.ts
```

Keep job payloads version-compatible during migration.

### HealthModule

**Decision: operational/system.** Move to `system/health` without changing `/health`. It correctly knows concrete dependencies because a readiness probe must inspect the deployed adapters.

### TestsModule

**Decision: genuine product capability, misleading name.** It is language assessment, not test infrastructure. Rename; do not move it to `apps/api/test`.

### SearchModule

**Decision: cross-domain application read model.** Today it is not engine infrastructure. A future engine adapter should sit behind a Search-owned port, but adding that port now solely for hypothetical Elasticsearch would be premature.

### FilesModule

**Decision: split boundary, not wholesale relocation.** File metadata, lifecycle and access are product behavior; AWS commands are infrastructure. Preserve the feature and extract only object storage.

### AdminModule

**Decision: back-office application façade, not a bounded domain.** Its role-based UI grouping is useful, but it should not own business rules or a repository spanning unrelated contexts.

### SupportModule

**Decision: ticketing is a feature; notification inbox/CMS/settings are misplaced.** A narrow Notifications capability is justified for inbox/read state, while domain-local notification decisions should remain with their producers unless an outbox/event design is approved.

## D. Architecture Test Problems

| Test / assumption | Problem type | What it actually guarantees | Required correction |
|---|---|---|---|
| “every feature module as a directory under src/modules” | Wrong assumption / current-state preservation | More than 10 current folders exist and Commerce exists | Explicitly classify components; assert Health/Workers are outside features and Assessment is inside |
| Deep sibling import regex | Incomplete invariant | No path with two nested segments into another current module for matched syntax | Resolve imports with TS AST; enforce allowed category edges and public entrypoints |
| Exact Commerce barrel = two concrete exports | Current-state preservation | Two names remain exported | Assert a narrow semantic API; do not canonize concrete service/function coupling |
| `common` cannot import `modules` | Useful but incomplete | One direction/path pattern is absent | Also ban stateful/domain ownership in common and constrain common's dependencies |
| Concrete messaging-provider ban | Incomplete invariant | Feature imports do not name `kavenegar.provider` | Ban provider SDK/concrete adapter imports by boundary; allow provider-neutral tokens only |
| Controller scan only under `modules` | Wrong filesystem assumption | Routes in current feature directory are parsed | Scan all source controller metadata, including `system` routes |
| `SELF_SCOPED` allowlist | False architectural/security guarantee | Route string was manually classified | Add per-route behavioral ownership tests and policy metadata |
| Route-count floor | False completeness signal | At least 139 regex matches exist | Compare an explicit generated route manifest or Nest metadata, including method variants |

Recommended desired invariants:

```text
common            -> no feature, system, or concrete infrastructure
domain policy     -> no Nest/Prisma/Redis/BullMQ/S3/provider SDK
feature app       -> own domain + narrow ports; no concrete external adapter
infrastructure    -> may implement ports; must not own cross-domain business decisions
system            -> may inspect infrastructure; may invoke application use cases
bootstrap         -> may compose every category
```

Apply the “domain policy” rule selectively to extracted policies/use cases, not blindly to every existing Nest service.

## E. Recommended Target Tree

This tree reflects actual repository responsibilities and intentionally avoids four layers per module:

```text
apps/api/src/
├── app.module.ts
├── main.ts
├── config/
│   ├── env.validation.ts
│   └── *.config.ts
├── common/
│   ├── assertions/
│   ├── errors/
│   ├── http/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   └── middleware/
│   └── types/
├── infrastructure/
│   ├── database/
│   ├── redis/
│   ├── logging/
│   ├── messaging/
│   ├── storage/
│   │   └── s3-object-storage.adapter.ts
│   ├── jobs/
│   │   └── bullmq/
│   └── infrastructure.module.ts
├── system/
│   ├── health/
│   ├── audit/
│   └── workers/                 # registration/lifecycle, not business rules
├── application/
│   └── search/                  # federated staff read model
└── modules/
    ├── auth/
    ├── users/
    ├── teachers/
    ├── bookings/
    ├── commerce/
    ├── languages/
    ├── learning/
    ├── matching/
    ├── assessment/              # current modules/tests
    ├── files/                   # lifecycle/access + ObjectStorage port
    ├── notifications/           # inbox/read state only
    ├── support/                 # ticketing only
    ├── settings/
    ├── content/                 # current CMS pages
    └── backoffice/              # thin controllers/facades, no omnibus repository
```

Not every proposed directory must be created immediately. `application/search`, `content`, and `backoffice` can remain physically where they are until a behavior-preserving move is worthwhile; their semantic classification should be documented now.

## F. Migration Plan

### Phase 1 — Correct the map and guardrails

- **Risk:** LOW; structural/test/documentation only.
- Replace filesystem-derived feature discovery with an explicit component classification.
- Add architecture rules for system/infrastructure/features and SDK leakage.
- Expand controller discovery beyond `src/modules`.
- Record `TestsModule` as Assessment, Search as application read model, Health as System, Queue as mixed/temporary.
- Do not move runtime files yet.

### Phase 2 — Purely structural moves

- **Risk:** LOW.
- Move `modules/health` to `system/health`, preserving route and DI.
- Rename `modules/tests` to `modules/assessment` with mechanical import/class updates.
- Optionally move Search to `application/search`; this can be deferred if path churn provides little value.
- Verify typecheck, architecture tests and E2E route inventory.

### Phase 3 — Remove false Common ownership

- **Risk:** MEDIUM; DI structure changes, intended behavior unchanged.
- Move `TokenRevocationService` into Auth.
- Move `SettingsService` and `AuditService` to explicit owners.
- Split HTTP primitives from stateful providers and reduce `CoreModule` global exports.
- Preserve provider tokens and call signatures before deeper redesign.

### Phase 4 — Extract volatile external adapters

- **Risk:** MEDIUM; behavior-sensitive integration seams.
- Extract S3 `ObjectStorage` adapter from Files with contract tests for metadata, URLs and missing objects.
- Consolidate infrastructure composition (database, Redis, logging, messaging, storage, jobs).
- Keep direct Prisma inside simple private feature services; remove it first from public cross-module contracts.

### Phase 5 — Decompose Queue by ownership

- **Risk:** HIGH; can affect behavior.
- Freeze/version current BullMQ job names and payloads.
- Extract booking-expiration and reminder handlers into Bookings/application ownership.
- Move BullMQ producer/worker lifecycle into infrastructure/system workers.
- Replace `queue -> commerce releaseDiscount` with an owning Commerce use case invoked through an application workflow.
- Validate delayed existing jobs, retries, dedupe keys, payment/wallet/credit rollback, graceful shutdown and multi-replica behavior.

### Phase 6 — Thin cross-domain facades

- **Risk:** MEDIUM to HIGH depending on scope.
- Narrow Matching→Bookings and Admin→Teachers contracts.
- Split notification inbox from Support while leaving domain-local notification creation policies in their producers.
- Convert Admin to a thin back-office composition surface and remove its omnibus repository incrementally.
- Separate CMS/content and settings ownership without changing public routes.

### Phase 7 — Behavioral architecture assurance

- **Risk:** LOW production risk; moderate test effort.
- Pair every `SELF_SCOPED` route with owner/other-user behavioral tests.
- Add contract tests for job adapters, object storage and SMS provider.
- Decide worker/cron deployment topology and assert single-execution/idempotency behavior.
- Revisit an outbox only if reliable cross-domain notifications become a measured requirement; do not introduce it merely for architectural symmetry.

## Prior AUDIT contradictions and limitations

1. **`AUDIT/03-isolation.md` vs this audit:** it labels the Nest module graph a “clean DAG,” calls Queue a leaf feature and says all six cross-module edges are through public surfaces. The cycle/path facts are correct, but the semantic conclusion is not: `queue -> commerce` is infrastructure/application runtime depending on domain internals, and a barrel does not correct that direction.
2. **`AUDIT/03-isolation.md` internal contradiction:** its shared-state table describes `CommonModule` and `QueueModule` as `@Global`, but current `common/core/common.module.ts` and `modules/queue/queue.module.ts` are not decorated `@Global`. The historical report is stale or was inaccurate for this state.
3. **`AUDIT/00-inventory.md` vs `AUDIT/03-isolation.md`:** Inventory correctly says Search and Queue own no tables and are “cross-cutting, not domains”; Isolation nevertheless includes both among feature-module leaves and builds guardrails from that folder list. Neither report completes the semantic classification: Search and Queue are cross-cutting in different layers.
4. **`AUDIT/notification-architecture-review.md` vs current layout:** the notification review correctly chooses narrow messaging infrastructure and explicitly recognizes Queue as BullMQ infrastructure/application behavior, yet it also states broadly that feature modules live under `src/modules`. That convention leaves Queue and Health wrongly categorized. Its decision not to create a broad notification service remains sound.
5. **`AUDIT/00-inventory.md` ownership table vs implementation:** it assigns Notification/NotificationDelivery to Support, while the notification architecture review demonstrates producers in Auth, Bookings, Commerce, Queue, Support, Teachers and Tests. Support currently owns inbox reads by accident of placement, not the entire notification lifecycle.
6. **Architecture-green claims in performance reports:** statements such as “Architecture: 4/4 passed” in `performance-phase-3-batch-2-results.md` mean only the four current structural tests passed. They do not demonstrate correct layer classification, dependency inversion, SDK isolation, worker topology, or authorization behavior.
7. **Historic path evidence is stale:** older audit files refer to Redis under `common/core/services`; current code places it under `infrastructure/cache`. Historical findings remain useful, but line/path claims must not be treated as current architectural truth.

## Final assessment

The architecture should not be rewritten wholesale. The stable core is the set of real capabilities—Auth, Users, Teachers, Bookings, Commerce, Languages, Learning, Matching, Assessment, Files, and Support ticketing. The highest-value correction is to stop treating every directory under `modules` as a feature, then disentangle Queue and Common in carefully staged, behavior-preserving work. Health and the Tests→Assessment rename are cheap clarity wins; Queue decomposition is the consequential change and should follow ports, contract tests, and job-compatibility safeguards rather than a folder move alone.
