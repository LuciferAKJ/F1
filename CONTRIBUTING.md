# Contributing to F1 Race Replay

Thank you for your interest in contributing to F1 Race Replay! This project is a modern web application and telemetry engine designed to replay Formula 1 races with synchronized car positioning, live timing, and broadcast-style telemetry.

---

## Getting Started

### Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **Python**: 3.11 or higher
- **Docker** *(optional, for containerized run)*

### Repository Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/f1-race-replay-web.git
   cd f1-race-replay-web
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate

   pip install -r requirements.txt
   pip install pytest pytest-asyncio pytest-cov httpx ruff
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   ```

---

## Development Workflow

### Running Locally

- **Backend**:
  ```bash
  cd backend
  uvicorn main:app --reload --port 8000
  ```

- **Frontend**:
  ```bash
  cd frontend
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Development

You can run both services simultaneously using Docker Compose:
```bash
docker compose -f docker-compose.dev.yml up --build
```

---

## Quality & Testing Guidelines

Before opening a pull request, ensure all tests and quality checks pass:

### Frontend Checks
```bash
cd frontend

# TypeScript type check
npx tsc --noEmit

# ESLint
npm run lint

# Vitest Unit and Component tests
npm run test

# Playwright E2E tests
npm run e2e
```

### Backend Checks
```bash
cd backend

# Ruff lint
ruff check .

# Pytest test suite with coverage
pytest
```

---

## Pull Request Guidelines

1. Create a feature branch: `git checkout -b feature/your-feature-name`.
2. Commit changes with clear, descriptive commit messages.
3. Ensure CI passes cleanly.
4. Open a pull request against the `main` branch.
