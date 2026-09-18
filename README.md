# MoneyMind 💰

> **A production-grade, full-stack personal finance application built with Python (FastAPI), PostgreSQL, and a responsive browser UI.**

---

## Architecture Overview

MoneyMind is structured as a clean, decoupled 5-tier architecture:

```
[ Browser / Client ]
        │
        ▼
[ UI Layer: HTML5 / CSS3 / Vanilla JS ]
  • Dynamic Bento Grid Dashboard
  • Chart.js Interactive Visualizations
  • Observer Pattern for Reactive UI Updates
  • Strategy / Adapter Pattern for Auth Providers
        │
        ▼  HTTP / REST API (Bearer Token Authorization)
[ REST API Gateway: FastAPI ]
  • Centralized Error Handlers (400, 401, 404, 422, 500)
  • Strict Pydantic v2 Request & Response Validation
  • CORS Middleware & Static Asset Serving
        │
        ▼
[ Application & Domain Layer: Python ]
  • PBKDF2-HMAC-SHA256 Password Cryptography
  • Multi-tenant Tenant Isolation & Dependency Injection
  • Claude AI Financial Coach & Algorithmic Insights
        │
        ▼  SQLAlchemy 2.0 ORM (psycopg v3 Driver)
[ Relational Database: PostgreSQL ]
  • Users, Expenses, and Savings Goals Tables
  • Cascading Foreign Keys & Indexed Timestamps
  • Automatic SQLite Fallback for Local Dev
```

---

## Key Features

- **Full CRUD REST API**: Comprehensive endpoints for expenses, category aggregates, and savings goals with progress tracking.
- **Strict Data Validation**: Pydantic v2 schemas enforce positive transaction amounts, valid categories, standard ISO dates, and sanitized user inputs.
- **Token-Based Authentication**: Secure signed session tokens with constant-time verification and PBKDF2 key derivation.
- **Multi-Tenant Data Isolation**: All expenses and savings goals are strictly scoped to the authenticated user ID.
- **Instant Demo Evaluation**: Pre-seeded demo account (`demo@moneymind.app` / `Demo123!`) for instant one-click review.
- **AI Budget Coaching**: Financial tips powered by Anthropic Claude (with built-in local algorithmic fallback).
- **Automated Test Suite**: 23 automated tests verifying CRUD, authorization boundaries, validation constraints, and edge cases.
- **Dockerized Deployment**: Production-ready `Dockerfile` and `docker-compose.yml` for instant local or cloud containerization.

---

## Directory Structure

```
MoneyMind/
├── backend/
│   ├── routers/
│   │   ├── auth.py          # /api/auth (register, login, me)
│   │   ├── expenses.py      # /api/expenses (CRUD, filters, summary)
│   │   ├── goals.py         # /api/goals (CRUD, savings progress)
│   │   └── ai.py            # /api/ai/suggestions (Claude & fallback)
│   ├── tests/
│   │   ├── conftest.py      # Isolated test fixtures & client
│   │   ├── test_auth.py     # Auth & token verification tests
│   │   ├── test_expenses.py # Expense CRUD & filter tests
│   │   ├── test_goals.py    # Goal CRUD & progress tests
│   │   └── test_ai.py       # AI suggestion tests
│   ├── config.py            # Pydantic Settings & environment config
│   ├── database.py          # SQLAlchemy 2.0 engine & session maker
│   ├── models.py            # Relational database models (User, Expense, Goal)
│   ├── schemas.py           # Pydantic validation schemas
│   ├── security.py          # PBKDF2 hashing, signed tokens, get_current_user
│   └── main.py              # FastAPI app, CORS, error handlers, static router
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions automated test workflow
├── index.html               # Responsive frontend dashboard
├── style.css                # Modern CSS design system
├── app.js                   # Application state, UI rendering, API client
├── auth.js                  # Authentication engine (RestApiAuthProvider)
├── requirements.txt         # Pinned Python dependencies
├── Dockerfile               # Lean container build
├── docker-compose.yml       # Multi-container orchestration (FastAPI + Postgres)
├── .env.example             # Environment variable template
└── README.md                # Documentation
```

---

## Quickstart Guide

### Option A: 1-Click with Docker Compose (Recommended)

Spin up both the PostgreSQL database and FastAPI backend with a single command:

```bash
docker compose up --build
```

- **Web Dashboard**: Open `http://localhost:8000` in your browser.
- **Interactive API Docs (Swagger)**: Visit `http://localhost:8000/docs`.

---

### Option B: Local Python Development

#### 1. Clone & Set Up Virtual Environment

```powershell
git clone https://github.com/Shubham-0128/Moneymind.git
cd Moneymind

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # On Windows (or: source .venv/bin/activate on Linux/Mac)

# Install dependencies
pip install -r requirements.txt
```

#### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

If PostgreSQL is not running locally, MoneyMind automatically falls back to a local SQLite database (`moneymind.db`) so you can develop immediately without configuring a database server.

#### 3. Start Server

```powershell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` to interact with the dashboard.

---

## Running Automated Tests

Run the full pytest suite:

```powershell
pytest backend/tests -v
```

All 23 unit and integration tests run against an isolated in-memory SQLite database.

---

## REST API Reference

All protected endpoints require an `Authorization: Bearer <token>` header obtained from `/api/auth/login`.

### Authentication
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Login and obtain signed session token | No |
| `GET` | `/api/auth/me` | Fetch currently authenticated user profile | **Yes** |

### Expenses & Transactions
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/expenses` | List expenses (supports `category`, `start_date`, `end_date`) | **Yes** |
| `POST` | `/api/expenses` | Create new expense | **Yes** |
| `GET` | `/api/expenses/{id}` | Get single expense by ID | **Yes** |
| `PUT` | `/api/expenses/{id}` | Update existing expense | **Yes** |
| `DELETE` | `/api/expenses/{id}` | Delete expense | **Yes** |
| `GET` | `/api/expenses/summary` | Aggregated spend & category breakdown | **Yes** |

### Savings Goals
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/goals` | List all user savings goals | **Yes** |
| `POST` | `/api/goals` | Create a new savings goal | **Yes** |
| `GET` | `/api/goals/{id}` | Get single goal by ID | **Yes** |
| `PUT` | `/api/goals/{id}` | Update goal details | **Yes** |
| `PATCH` | `/api/goals/{id}/savings` | Increment savings toward goal (capped at target) | **Yes** |
| `DELETE` | `/api/goals/{id}` | Delete savings goal | **Yes** |

### AI Budget Coaching & System
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/ai/suggestions` | Generate personalized financial tips | No |
| `GET` | `/api/health` | Health check & active DB dialect | No |
| `GET` | `/docs` | OpenAPI / Swagger interactive documentation | No |

---

## License
MIT License. Created for MoneyMind.
