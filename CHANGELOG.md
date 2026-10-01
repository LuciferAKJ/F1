# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-30

### Added
- Comprehensive test suites for frontend (Vitest, React Testing Library, Playwright E2E).
- Comprehensive test suites for backend (pytest, pytest-asyncio, FastAPI TestClient).
- ESLint flat configuration for Next.js 15 and ESLint 9.
- Prettier code formatting configuration (`.prettierrc`, `.prettierignore`).
- Git pre-commit hooks via `.husky/pre-commit`.
- Multi-stage production `Dockerfile` for frontend and backend.
- Docker Compose configuration for both production (`docker-compose.yml`) and development with hot reload (`docker-compose.dev.yml`).
- Next.js configuration (`next.config.ts`) with standalone build, security headers, and workspace root tracing.
- GitHub Actions CI/CD workflows for frontend CI, backend CI, and Playwright E2E tests.
- Open-source governance files (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`).

### Fixed
- Replaced raw anchor navigation in `ErrorFallback` with Next.js `Link`.
- Cleared Next.js workspace root lockfile ambiguity via `outputFileTracingRoot`.
