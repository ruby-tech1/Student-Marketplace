# Student Marketplace — From Scratch Tutorial

This guide walks you through building the Student Marketplace API from scratch. It is designed for learners to follow along stage by stage.

---

## Stage 1: Project Initialization

### 1.1. Create NestJS Project
Check you have Node.js (v18+) and Nest CLI installed.
```bash
npm i -g @nestjs/cli
nest new student-marketplace
cd student-marketplace
```

### 1.2. Install Core Dependencies
We need TypeORM for database, Config for env vars, and Swagger for docs.
```bash
npm install @nestjs/typeorm typeorm pg @nestjs/config joi
npm install @nestjs/swagger swagger-ui-express
```

### 1.3. Setup Directory Structure
Delete `app.controller.ts` and `app.service.ts` to start clean, or keep them for basic health check.
Create the following folders in `src/`:
- `common/`: Shared decorators, guards, filters.
- `config/`: Database and app configuration.
- `model/`: DTOs, Entities, Enums.
- `service/`: Business logic.
- `controller/`: API endpoints.
- `utility/`: Helper functions.

---

## Stage 2: Infrastructure & Configuration

### 2.1. Docker Compose
Create `docker-compose.yml` at the root to spin up PostgreSQL, RabbitMQ, and MailDev.
(See `docker-compose.yml` in the final project for reference).
```bash
docker compose up -d
```

### 2.2. Environment Variables
1. Create `.env` file.
2. Define `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.
3. Define `JWT_SECRET`, `RABBITMQ_URI`.

### 2.3. TypeORM Config
Create `src/config/typeorm.config.ts` to connect to Postgres using env variables.

---

## Stage 3: User Entity & Shared Utilities

### 3.1. Base Entity
Create `src/utility/autitable.entity.ts` with `id`, `createdAt`, `updatedAt`, `deletedAt` to avoid repetition.

### 3.2. User Entity
Create `src/model/entity/user.entity.ts`.
- properties: `firstName`, `lastName`, `email`, `passwordHash`, `roles`, `status`.

### 3.3. Utils
- **HashUtility**: `src/utility/hash-utility.ts` (using `bcrypt`).
- **ApiResponse**: `src/utility/api-response.ts` for consistent generic responses.

---

## Stage 4: Authentication Core

### 4.1. Auth Module
Generate auth module components:
```bash
nest g module auth
nest g controller controller/auth
nest g service service/auth
```

### 4.2. Registration
1. Create `RegisterRequestDto`.
2. Implement `registerUser` in `AuthService`.
   - Validate email.
   - Hash password.
   - Save user with `isEnabled = false`.
   - Create `Verification` entity (OTP).

### 4.3. Login & JWT
1. Install JWT and Passport dependencies:
   ```bash
   npm install @nestjs/jwt @nestjs/passport passport passport-jwt
   npm install -D @types/passport-jwt
   ```
2. Implement `CustomJwtService` to sign and verify tokens.
3. Implement `login` in `AuthService`.
   - Validate credentials.
   - Generate Access Token (short-lived) & Refresh Token (long-lived, stored in DB).

---

## Stage 5: Email & Async Events

### 5.1. RabbitMQ
Set up `RabbitMQService` to publish/subscribe to messages.

### 5.2. Email Service
Set up `EmailService` using `nodemailer` to send emails via MailDev (port 1025).

### 5.3. Event Flow
- On Registration: Publish `USER_REGISTERED` event to RabbitMQ.
- Email Consumer: Subscribe to event -> Send Verification Email with OTP.

---

## Stage 6: Authorization & Security

### 6.1. Auth Guard
Create `src/common/guards/auth.guard.ts`.
- Extract Bearer token.
- Verify JWT.
- Attach user to request object.

### 6.2. RBAC (Role-Based Access Control)
Create `src/common/guards/role.guard.ts`.
- Check if user has required permission (USER, ADMIN, VENDOR).
- Use `Reflector` to get `@Roles` metadata.

---

## Stage 7: User Profile & Finishing Touches

### 7.1. User Controller
Create `src/controller/user.controller.ts`.
- endpoint: `GET /users/profile`
- Use `@UseGuards(AuthGuard)` to protect it.

### 7.2. Swagger Documentation
Configure `DocumentBuilder` in `src/main.ts` to auto-generate API docs at `/docs`.

---

## Checklist for Learners

- [ ] Can you connect to the database?
- [ ] Can you register a user and receive an email in MailDev?
- [ ] Can you verify the account with the OTP?
- [ ] Can you login and get a JWT?
- [ ] Can you access the protected profile route with the JWT?

Start coding! 🚀
