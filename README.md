# MoneyMind

MoneyMind is a full-stack personal finance application for tracking income and expenses, managing savings goals, and generating budgeting insights.

---

## Overview

Personal finance tracking is easy to neglect when spending data is scattered across manual notes or multiple accounts. It is hard to see monthly cash flow, category breakdowns, or whether you are on track with savings goals without doing manual spreadsheet math.

MoneyMind solves this with a full-stack setup: a browser interface on the frontend, a FastAPI REST backend, and database persistence through SQLAlchemy with PostgreSQL (plus an automatic SQLite fallback for local development). Authenticated user data—transactions, balances, and savings targets—is stored and calculated server-side, keeping financial state reliable and private.

---

## Features

- **User registration and login**: Account creation and login with PBKDF2 password hashing and signed Bearer tokens.
- **User-scoped financial data**: All database operations filter on the authenticated user ID so users cannot access each other's records.
- **Income and expense tracking**: Add, view, edit, and delete transactions with amounts, categories, dates, and notes.
- **Category-based spending summaries**: Aggregated metrics for total income, total expenses, net balance, savings rate, and category breakdowns.
- **Financial goals and progress tracking**: Target amounts, target dates, and incremental contributions capped at the goal target.
- **CSV transaction import and export**: Import past transactions from CSV files or export records directly from the browser.
- **Recurring transactions**: Define recurring rules (frequency and next date) to automate repeating bills or income.
- **AI-generated budgeting suggestions**: Backend endpoint sending spending summaries to the Anthropic API for concise budgeting advice.
- **Local fallback for AI**: Built-in heuristic suggestions if the Anthropic API key is missing or the external service fails.
- **PostgreSQL with SQLite development fallback**: Connects to PostgreSQL if available, otherwise falls back to a local SQLite database file so development works out of the box.
- **Automated backend tests**: 37 unit and integration tests covering auth, endpoints, validation, precision, and isolation.

---

## Architecture

```
Browser (HTML / CSS / JavaScript)
               │
               ▼  REST API (Signed Bearer Token)
        FastAPI Backend
         ├── Routers (/api/auth, /api/expenses, /api/goals, /api/ai)
         ├── Pydantic validation & PBKDF2 security
         └── SQLAlchemy 2.0 ORM
               │                         │
               ▼                         ▼
      PostgreSQL / SQLite         Anthropic API
      (moneymind.db fallback)    (External LLM service
                                  + local fallback)
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | HTML, CSS, JavaScript | Vanilla JS, responsive Bento Grid UI, Chart.js charts |
| **Backend** | Python, FastAPI | Asynchronous REST API, dependency injection, static file serving |
| **ORM** | SQLAlchemy | Declarative models, relationship cascades, SQL aggregation |
| **Database** | PostgreSQL / SQLite | PostgreSQL via `psycopg` (v3), automatic SQLite fallback for local dev |
| **Validation** | Pydantic | Pydantic v2 schemas and Decimal field validation |
| **Authentication** | PBKDF2 + signed tokens | PBKDF2-HMAC-SHA256 password hashing and HMAC-SHA256 Bearer tokens |
| **AI** | Anthropic API + fallback | Claude API (`claude-sonnet-4-6`) with local rule-based fallback |
| **Testing** | pytest | Automated test suite with HTTPX TestClient |
| **Containerization** | Docker / Docker Compose | Container setup for FastAPI backend and PostgreSQL database |

---

## Engineering Highlights

### Authentication & Authorization
- Passwords are encrypted using PBKDF2-HMAC-SHA256 with 100,000 iterations and a unique 16-byte random salt per user (`secrets.token_hex(16)`). Plaintext passwords never touch the database.
- Authenticated requests use URL-safe base64 tokens signed with HMAC-SHA256 and verified using `secrets.compare_digest` to prevent timing attacks.
- Protected endpoints require a valid token via FastAPI's `Depends(get_current_user)`.
- Database queries explicitly filter on `user_id == current_user.id`. User A cannot read, modify, or delete records belonging to User B, enforcing authorization at the query level.

### Financial Data Precision
Monetary values use SQL `NUMERIC(12,2)` and Python `Decimal` instead of floating-point storage, avoiding binary floating-point errors in financial calculations. Both the database columns and Pydantic schemas enforce exact two-decimal precision.

### Database Aggregation
The expense summary endpoint (`/api/expenses/summary`) computes totals, net balance, and category-level breakdowns directly in SQL using aggregate functions (`SUM`, `COUNT`, `CASE`, and `GROUP BY`). Instead of pulling thousands of raw rows into Python memory and looping over them, the database engine returns the computed numbers directly.

### AI Integration
- The frontend client never has access to the AI service credentials. All requests pass through the authenticated `/api/ai/suggestions` backend route.
- The backend compiles the user's spending summary (monthly total and spending by category) and submits that summary data to Claude, requesting 2–3 concrete tips.
- If the Anthropic API key is not configured or the external request fails, a local fallback evaluates top spending categories and monthly thresholds to return instant heuristic suggestions without failing the request.

### Testing
MoneyMind currently has 37 backend tests covering authentication, authorization boundaries, expenses, goals, validation, and AI fallback behavior. Tests run against an isolated in-memory SQLite database via pytest fixtures.

---

## API Overview

| Route | Purpose | Auth Required |
|---|---|:---:|
| `/api/auth/register` | Create user account | No |
| `/api/auth/login` | Authenticate and obtain signed Bearer token | No |
| `/api/auth/me` | Fetch authenticated user profile | Yes |
| `/api/expenses` | List, create, update, and delete expenses/income | Yes |
| `/api/expenses/summary` | SQL-aggregated financial summary and category totals | Yes |
| `/api/goals` | List, create, update, and delete savings goals | Yes |
| `/api/goals/{id}/savings` | Add savings toward a goal (capped at target amount) | Yes |
| `/api/ai/suggestions` | Budgeting suggestions (Anthropic Claude or local fallback) | Yes |
| `/api/health` | Health check endpoint returning active database dialect | No |

---

## Testing

Run the full backend test suite:

```bash
python -m pytest backend/tests -v
```

**Current result: 37 passed**

The tests verify:
- Registration, password hashing, and duplicate account rejection
- Login, session token generation, and token expiration checks
- Environment config validation and production secret enforcement
- Expense and income CRUD operations and category normalization
- SQL-based financial summary calculations and month/year filters
- Savings goals progress and savings cap logic
- Authorization boundaries and cross-user data isolation
- AI suggestion route authentication and local fallback output

---

## Getting Started

### Prerequisites
- Python 3.10+
- Git
- (Optional) PostgreSQL (if not installed, MoneyMind automatically falls back to SQLite)
- (Optional) Docker / Docker Compose

---

### Local Setup

#### 1. Clone the repository
```bash
git clone https://github.com/Shubham-0128/Moneymind.git
cd Moneymind
```

#### 2. Create and activate a virtual environment

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

#### 3. Install dependencies
```bash
pip install -r requirements.txt
```

#### 4. Configure environment variables
Copy the sample configuration file:

```bash
# Windows
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Key environment settings in `.env`:
- `ENVIRONMENT`: `development`, `test`, or `production`.
- `DATABASE_URL`: PostgreSQL connection string (`postgresql+psycopg://postgres:postgres@localhost:5432/moneymind`).
- `FALLBACK_TO_SQLITE`: Defaults to `True`. If PostgreSQL is unreachable, the server automatically connects to a local `moneymind.db` file.
- `SECRET_KEY`: Used for signing session tokens. A development default is used locally; production requires an explicit secret.
- `ALLOWED_ORIGINS`: Permitted CORS origins (defaults to local development hosts).
- `ENABLE_DEMO_USER`: When set to `True` in development, seeds a demo account for local testing.
- `ANTHROPIC_API_KEY`: (Optional) Anthropic API key for Claude suggestions. If not set, the local fallback is used.

#### 5. Start the backend server
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

#### 6. Open the application
- Web interface: `http://127.0.0.1:8000`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

---

### Docker Setup (Alternative)

To run the application alongside a PostgreSQL database using Docker Compose:

```bash
docker compose up --build
```

The web dashboard and API will be available at `http://localhost:8000`.

---

## Project Structure

```text
MoneyMind/
├── backend/
│   ├── routers/
│   │   ├── ai.py          # AI coaching and local fallback logic
│   │   ├── auth.py        # Registration, login, and user profile
│   │   ├── expenses.py    # Transactions and SQL aggregation summary
│   │   └── goals.py       # Savings goals and contributions
│   ├── tests/
│   │   ├── conftest.py    # Test fixtures and in-memory database
│   │   ├── test_ai.py
│   │   ├── test_auth.py
│   │   ├── test_expenses.py
│   │   └── test_goals.py
│   ├── config.py          # Pydantic Settings and env validation
│   ├── database.py        # SQLAlchemy engine, session maker, SQLite fallback
│   ├── models.py          # Relational models (User, Expense, Goal, Budget, RecurringRule)
│   ├── schemas.py         # Pydantic v2 schemas and validation
│   ├── security.py        # PBKDF2 hashing, signed Bearer tokens, get_current_user
│   └── main.py            # FastAPI app, CORS, error handlers, static asset serving
├── app.js                 # Frontend state management, charts, and API client
├── auth.js                # Frontend authentication and token handling
├── index.html             # Dashboard markup
├── style.css              # Dashboard styles
├── requirements.txt       # Python dependencies
├── Dockerfile             # Container definition
├── docker-compose.yml     # Multi-container setup (FastAPI + PostgreSQL)
└── README.md
```

---

## Security Notes

- **Password hashing**: Passwords are hashed with PBKDF2-HMAC-SHA256 (100,000 iterations) with a unique per-user salt.
- **Signed authentication tokens**: Session tokens are signed using HMAC-SHA256 and validated with constant-time comparison (`secrets.compare_digest`).
- **Protected endpoints**: Sensitive routes enforce authentication via FastAPI's `Depends(get_current_user)`.
- **User-scoped queries**: All database queries explicitly scope to `user_id == current_user.id` to prevent cross-account access.
- **Environment secrets**: Secrets and connection strings are managed via `.env` and validated with `pydantic-settings`.
- **Configured CORS**: CORS middleware is restricted to specific development origins instead of open wildcards.

---

## Future Improvements

- **Token revocation and refresh tokens**: Current tokens rely on timestamp expiration (`exp`). Adding server-side revocation or refresh-token rotation would allow tokens to be invalidated immediately on logout.
- **Database migrations with Alembic**: Tables are currently created at startup with SQLAlchemy `metadata.create_all()`. Integrating Alembic would allow tracked schema versioning.
- **Background task processing**: Recurring transactions are currently evaluated on request. Moving recurring rule generation to a background worker would decouple it from HTTP request cycles.
- **Expanded test coverage**: Add end-to-end tests for CSV import parsing and recurring transaction edge cases.

---

## Author

- GitHub: [Shubham-0128](https://github.com/Shubham-0128)
