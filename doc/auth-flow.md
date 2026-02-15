# Authentication & Authorization — Flow Documentation

This document describes each authentication and authorization flow in the Student Marketplace API. For visual diagrams, open [`auth-flow.drawio`](./auth-flow.drawio) in draw.io.

---

## Table of Contents
1. [Registration](#1-registration)
2. [Email Verification](#2-email-verification)
3. [Login](#3-login)
4. [Token Refresh](#4-token-refresh)
5. [Logout](#5-logout)
6. [Forgot Password](#6-forgot-password)
7. [Verify Forgot Password OTP](#7-verify-forgot-password-otp)
8. [Reset Password](#8-reset-password)
9. [Authorization (Guards)](#9-authorization-guards)
10. [Get User Profile](#10-get-user-profile)

---

## 1. Registration

**Endpoint:** `POST /auth/register`
**Access:** Public

### Request Body
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@university.edu",
  "password": "SecureP@ss1",
  "confirmPassword": "SecureP@ss1"
}
```

### Flow
1. **Validate** — Validate request DTO fields (email format, password strength).
2. **Check duplicate** — Query `users` table for existing email. Throw `BadRequestException` if found.
3. **Hash password** — Use `bcrypt` to hash the password.
4. **Create user** — Insert new `User` record with `isEnabled = false`, `status = ACTIVE`, `roles = [USER]`.
5. **Create verification** — Generate a 6-digit OTP, hash it, and store a `Verification` record with `verificationType = ACCOUNT_VERIFICATION`.
6. **Send email** — Dispatch a verification email containing the OTP to the user's email address (via RabbitMQ → EmailService).

### Response
```json
{
  "status": 201,
  "message": "success",
  "data": "Confirm your account in the email sent"
}
```

---

## 2. Email Verification

**Endpoint:** `POST /auth/verify/register`
**Access:** Public

### Request Body
```json
{
  "email": "john@university.edu",
  "otp": "123456"
}
```

### Flow
1. **Find user** — Look up user by email.
2. **Find verification** — Retrieve the latest `ACCOUNT_VERIFICATION` record for this user.
3. **Validate OTP** — Compare the submitted OTP against the stored (hashed) token. Check expiration.
4. **Activate user** — Set `user.isEnabled = true` and `user.emailVerifiedAt = now()`.
5. **Mark verified** — Set `verification.verified = true`.
6. **Generate tokens** — Create a JWT access token and a refresh token (stored in `tokens` table).

### Response
```json
{
  "status": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "a1b2c3d4e5f6...",
    "user": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@university.edu",
      "roles": ["USER"],
      "status": "ACTIVE",
      "lastLogin": "2026-02-15T12:00:00Z",
      "emailVerifiedAt": "2026-02-15T12:00:00Z"
    }
  }
}
```

---

## 3. Login

**Endpoint:** `POST /auth/login`
**Access:** Public

### Request Body
```json
{
  "email": "john@university.edu",
  "password": "SecureP@ss1"
}
```

### Flow
1. **Find user** — Look up user by email. Throw `NotFoundException` if not found.
2. **Verify password** — Compare submitted password against stored `passwordHash` using bcrypt.
3. **Check status** — Verify user is not `SUSPENDED`.
4. **Update lastLogin** — Set `user.lastLogin = now()`.
5. **Generate tokens** — Create JWT access token (containing `userId` and `roles`) and a refresh token.

### Response
Same structure as Email Verification response above.

---

## 4. Token Refresh

**Endpoint:** `POST /auth/refresh/token`
**Access:** Public

### Request Body
```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

### Flow
1. **Find token** — Look up the refresh token in the `tokens` table.
2. **Validate** — Check the token is not revoked (`revokedAt IS NULL`) and not expired (`expireAt > now()`).
3. **Revoke old token** — Set `revokedAt = now()` on the existing token.
4. **Generate new tokens** — Issue a new JWT access token and a new refresh token.

### Key Security Detail
This implements **token rotation** — each refresh token can only be used once. If a stolen token is replayed after rotation, it will be detected as revoked.

---

## 5. Logout

**Endpoint:** `POST /auth/logout`
**Access:** Bearer Token Required

### Request Body
```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

### Flow
1. **Extract user** — Get `userId` from the JWT in the Authorization header.
2. **Find token** — Look up the refresh token for this user.
3. **Revoke** — Set `token.valid = false` (which sets `revokedAt = now()`).

---

## 6. Forgot Password

**Endpoint:** `POST /auth/forgot-password`
**Access:** Public

### Request Body
```json
{
  "email": "john@university.edu"
}
```

### Flow
1. **Find user** — Look up user by email.
2. **Create verification** — Generate a 6-digit OTP, store a `Verification` record with `verificationType = PASSWORD_RESET`.
3. **Send email** — Dispatch a password reset email with the OTP.

---

## 7. Verify Forgot Password OTP

**Endpoint:** `POST /auth/verify/forgot-password`
**Access:** Public

### Request Body
```json
{
  "email": "john@university.edu",
  "otp": "654321"
}
```

### Flow
1. **Find user** — Look up by email.
2. **Find verification** — Get latest `PASSWORD_RESET` verification for this user.
3. **Validate OTP** — Check token match and expiration.
4. **Mark verified** — Set `verification.verified = true`.

---

## 8. Reset Password

**Endpoint:** `POST /auth/reset-password`
**Access:** Public

### Request Body
```json
{
  "email": "john@university.edu",
  "newPassword": "NewSecureP@ss2",
  "confirmPassword": "NewSecureP@ss2"
}
```

### Flow
1. **Find user** — Look up by email.
2. **Check verification** — Ensure a verified `PASSWORD_RESET` verification exists.
3. **Validate passwords** — Confirm `newPassword === confirmPassword`.
4. **Hash & save** — Hash the new password with bcrypt and update the user record.

---

## 9. Authorization (Guards)

Every request to a protected endpoint passes through two layers of guards.

### Layer 1: AuthGuard

```
Request → Extract Bearer Token → Verify JWT → Attach {userId, roles} to request.user
```

- If the route has `@Public()`, the guard is **skipped**.
- If no valid token is found, a `401 Unauthorized` error is thrown.

### Layer 2: RoleGuard

```
request.user.roles → Compare with @Roles() metadata → Allow or Deny
```

- The `RbacService` implements a **role hierarchy**: `ADMIN > VENDOR > USER`.
- An `ADMIN` automatically satisfies any role requirement.
- If the user lacks the required role, a `403 Forbidden` error is thrown.

### Example: Protected Route

```typescript
@Roles(UserRole.VENDOR)  // Only VENDOR and ADMIN can access
@Get('my-listings')
async getMyListings(@Req() request: Request) {
  const userId = request.user.userId;
  // ... only vendors and admins reach here
}
```

---

## 10. Get User Profile

**Endpoint:** `GET /users/profile`
**Access:** Bearer Token Required

### Flow
1. **AuthGuard** — Validates JWT and extracts `userId` from the token.
2. **Controller** — Reads `request.user.userId`.
3. **UserService** — Fetches the full user record by ID and converts to `UserDto`.

### Response
```json
{
  "status": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@university.edu",
    "roles": ["USER"],
    "status": "ACTIVE",
    "lastLogin": "2026-02-15T12:00:00Z",
    "emailVerifiedAt": "2026-02-15T12:00:00Z"
  }
}
```
