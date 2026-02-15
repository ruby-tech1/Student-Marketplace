<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
  <h1 align="center">Student Marketplace API</h1>
</p>

<p align="center">
  A robust backend API for a university student marketplace, built with <strong>NestJS</strong>, <strong>PostgreSQL</strong>, and <strong>RabbitMQ</strong>.
</p>

---

## 📚 Documentation

Detailed documentation is available in the [`doc/`](./doc) directory:

- **[Project Description](./doc/project-description.md)**: Architecture, tech stack, entity details, and security design.
- **[Auth Flow Guide](./doc/auth-flow.md)**: Step-by-step guide to all authentication and authorization flows (Register, Login, Refresh, etc.).
- **[ERD Diagram](./doc/erd.drawio)**: Entity Relationship Diagram for the Auth module.
- **[Auth Flow Diagram](./doc/auth-flow.drawio)**: Visual workflows for registration, login, and token management.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose

### 1. Start Infrastructure
Start PostgreSQL, RabbitMQ, pgAdmin, and MailDev using Docker Compose:

```bash
docker compose up -d
```

| Service | Address | User/Pass |
|---|---|---|
| **API** | `http://localhost:3000` | - |
| **PostgreSQL** | `localhost:5432` | `student` / `student123` |
| **pgAdmin** | `http://localhost:5050` | `admin@admin.com` / `admin` |
| **RabbitMQ** | `http://localhost:15674` | `guest` / `guest` |
| **MailDev** | `http://localhost:1080` | - |

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Application
```bash
# Development mode
npm run start:dev
```

### 4. Explore API
Open the Swagger UI to interact with the API:
👉 **[http://localhost:3000/docs](http://localhost:3000/docs)**

---

## ✨ Key Features
- **Secure Authentication**: JWT-based auth with Access and Refresh tokens.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (ADMIN, VENDOR, USER).
- **Email Verification**: OTP-based account verification.
- **Password Management**: Secure password reset flow with OTPs.
- **Async Event Processing**: Email delivery offloaded to RabbitMQ.
- **Dockerized Structure**: Full local dev environment in seconds.

---

## 🧪 Running Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## 📄 License
This project is [MIT licensed](LICENSE).
