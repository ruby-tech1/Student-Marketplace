<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# Student Marketplace

Student Marketplace is a backend API built with **NestJS** (TypeScript) that provides a secure platform for students to list, discover, and transact goods and services within their university ecosystem. This document focuses on the **Authentication & Authorization** module — the foundation layer that every other feature depends on.

---

## Technical Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js ≥ 18 | JavaScript runtime |
| **Framework** | NestJS 10 | Enterprise-grade Node.js framework |
| **Language** | TypeScript 5 | Static typing and decorator support |
| **Database** | PostgreSQL 17 | Primary relational data store |
| **ORM** | TypeORM | Entity mapping, migrations, query builder |
| **Auth Tokens** | JWT (JSON Web Tokens) | Stateless access tokens |
| **Hashing** | bcrypt | Password hashing |
| **Email** | Nodemailer | Transactional email delivery |
| **Queue** | RabbitMQ 4 | Async event processing (email dispatch) |
| **API Docs** | Swagger / OpenAPI | Auto-generated API documentation |
| **Dev Tools** | Docker Compose | Local infrastructure orchestration |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Client (Frontend)                     │
└─────────────────────────────┬────────────────────────────────┘
                              │ HTTP / REST
┌─────────────────────────────▼────────────────────────────────┐
│                      NestJS Application                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Auth     │  │ Auth     │  │ Role     │  │ Exception   │  │
│  │ Guard    │  │ Guard    │  │ Guard    │  │ Filter      │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │              │              │               │         │
│  ┌────▼──────────────▼──────────────▼───────────────▼──────┐  │
│  │                    Controllers                          │  │
│  │  AuthController  ·  UserController                      │  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────▼───────────────────────────────┐  │
│  │                      Services                           │  │
│  │  AuthService · UserService · TokenService               │  │
│  │  VerificationService · EmailService · RabbitMQService   │  │
│  │  CustomJwtService · RbacService                         │  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────▼───────────────────────────────┐  │
│  │                    TypeORM Repositories                  │  │
│  │  User · Token · Verification                            │  │
│  └─────────────────────────┬───────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────────┐
       │PostgreSQL│  │ RabbitMQ │  │  MailDev /    │
       │    17    │  │    4     │  │  SMTP Server  │
       └──────────┘  └──────────┘  └──────────────┘
```

---

## Entity Relationship Diagram

> **File:** [`doc/erd.drawio`](./doc/erd.drawio)
>
> Open with [draw.io](https://app.diagrams.net) or the VS Code draw.io extension.

### Summary

| Entity | Table | Description |
|---|---|---|
| **User** | `users` | Core user profile, credentials, roles, and status |
| **Token** | `tokens` | Refresh tokens issued per login session |
| **Verification** | `verifications` | OTP/token records for email verification & password reset |

All entities inherit from the **`Auditable`** base class, which provides:
- `id` — UUID primary key (auto-generated)
- `createdAt` — Auto-set creation timestamp
- `updatedAt` — Auto-updated modification timestamp
- `deletedAt` — Soft delete timestamp

### Relationships

```
  User (1) ──────< (N) Token
  User (1) ──────< (N) Verification
```

- A **User** can have **many Tokens** (one per login session).
- A **User** can have **many Verifications** (account verification, password resets).
- Both relations use `CASCADE` delete — deleting a user removes all their tokens and verifications.

---

## Enums

### UserRole
| Value | Description |
|---|---|
| `ADMIN` | Full system access |
| `USER` | Default role for students |
| `VENDOR` | Sellers / service providers |

### UserStatus
| Value | Description |
|---|---|
| `ACTIVE` | Normal operating state |
| `SUSPENDED` | Account disabled by admin |

### VerificationType
| Value | Description |
|---|---|
| `ACCOUNT_VERIFICATION` | Initial account activation after registration |
| `EMAIL_VERIFICATION` | Email change verification |
| `PASSWORD_RESET` | Forgot password OTP |

---

## API Endpoints

### Authentication (`/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user |
| `POST` | `/auth/verify/register` | Public | Verify registration OTP |
| `POST` | `/auth/login` | Public | Login with credentials |
| `POST` | `/auth/logout` | Bearer | Logout (revoke refresh token) |
| `POST` | `/auth/refresh/token` | Public | Refresh access token |
| `POST` | `/auth/forgot-password` | Public | Request password reset OTP |
| `POST` | `/auth/verify/forgot-password` | Public | Verify password reset OTP |
| `POST` | `/auth/reset-password` | Public | Set new password |

### User (`/users`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/users/profile` | Bearer | Get authenticated user profile |

---

## Security Design

### Password Security
- Passwords are hashed using **bcrypt** before storage.
- Raw passwords are **never** stored or logged.
- Password validation regex enforces complexity (`AppConstants.PASSWORD_REGEX`).

### JWT Token Strategy
- **Access Token**: Short-lived JWT containing `userId` and `roles`. Used in the `Authorization: Bearer <token>` header.
- **Refresh Token**: Long-lived opaque token stored in the `tokens` table. Used to obtain new access tokens without re-authentication.
- Token rotation: on refresh, the old refresh token is **revoked** and a new one is issued.

### Role-Based Access Control (RBAC)
- **AuthGuard**: Validates JWT on every protected route. Extracts `userId` and `roles` into `request.user`.
- **RoleGuard**: Checks the `@Roles()` decorator against the user's roles. Uses `RbacService` for hierarchy-aware authorization.
- **@Public()** decorator: Bypasses authentication for public routes.

### Role Hierarchy
```
ADMIN > VENDOR > USER
```
An `ADMIN` can access any route that requires `VENDOR` or `USER` roles.

---

## Infrastructure (Docker Compose)

The project uses Docker Compose for local development. See [`docker-compose.yml`](./docker-compose.yml).

| Service | Image | Ports | Purpose |
|---|---|---|---|
| **postgres** | `postgres:17-alpine` | `5432` | Primary database |
| **pgadmin** | `dpage/pgadmin4` | `5050` | Database management UI |
| **rabbitmq** | `rabbitmq:4-management` | `5674` / `15674` | Message broker + management UI |
| **maildev** | `maildev/maildev` | `1026` / `1080` | Development SMTP server + inbox UI |

### Quick Start
```bash
# Start infrastructure
docker compose up -d

# Start application
npm run start:dev

# Open Swagger docs
open http://localhost:3000/docs
```

---

## Directory Structure

```
src/
├── all-exception.filter.ts        # Global exception handler
├── app.module.ts                  # Root module
├── main.ts                        # Bootstrap / entry point
├── common/
│   ├── decorator/
│   │   ├── public.decorator.ts    # @Public() — skip auth
│   │   ├── roles.decorator.ts     # @Roles() — define required roles
│   │   └── swagger.decorator.ts   # Swagger response decorators
│   └── guards/
│       ├── auth.guard.ts          # JWT validation guard
│       └── role.guard.ts          # RBAC enforcement guard
├── config/
│   └── typeorm.config.ts          # TypeORM data source config
├── config-module/
│   └── configuration.ts           # Joi-validated env config
├── controller/
│   ├── auth.controller.ts         # Auth API endpoints
│   └── user.controller.ts         # User API endpoints
├── model/
│   ├── dto/
│   │   └── user.dto.ts            # User response DTO
│   ├── entity/
│   │   ├── user.entity.ts         # User table
│   │   ├── token.entity.ts        # Refresh token table
│   │   └── verification.entity.ts # Verification table
│   ├── enum/
│   │   ├── role.enum.ts           # UserRole enum
│   │   └── verification-type.ts   # VerificationType enum
│   ├── request/                   # Request DTOs
│   └── response/                  # Response DTOs
├── service/
│   ├── auth/auth.service.ts       # Core auth logic
│   ├── email/                     # Email + event service
│   ├── logger/                    # Custom logger
│   ├── rabbitmq/                  # RabbitMQ service
│   ├── rbac/                      # RBAC service
│   ├── token/                     # Token + JWT services
│   ├── user/                      # User service
│   └── verification/              # Verification service
└── utility/
    ├── api-response.ts            # Standardized API response wrapper
    ├── app-constants.ts           # Application constants
    ├── autitable.entity.ts        # Auditable base entity
    ├── date.dto.ts                # Date DTO base
    ├── hash-utility.ts            # bcrypt hashing utilities
    └── pagination-and-sorting.ts  # Pagination helpers
```
