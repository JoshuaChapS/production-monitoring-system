# Production Monitoring System

An end-to-end production monitoring simulation inspired by enterprise CIB (Corporate & Investment Bank) environments, built to demonstrate real-world Production Management workflows.

## Architecture

~~~
C++ Log Generator → trading_app.log → Splunk (SPL alert) → Webhook → C++ Backend → SQLite → React Dashboard
~~~

## Tech Stack

| Component | Technology |
|---|---|
| Log Generator | C++ |
| Monitoring & Alerting | Splunk Free |
| Backend API | C++ + httplib + OpenSSL + libsodium |
| Database | SQLite |
| Authentication | JWT (HMAC-SHA256) |
| Frontend | React + TypeScript + Tailwind CSS v4 |
| Build Tool | Vite + pnpm |
| Deployment | Docker Compose |

## Project Structure

~~~
production-monitoring-system/
├── logger/          C++ trading app log simulator
├── backend/         C++ HTTP server — REST API + SQLite + JWT
├── frontend/        React dashboard
├── splunk/          Splunk configuration and SPL queries
├── logs/            Log output directory
├── docker-compose.yml
├── start.sh         Local development launcher
└── .env             Environment variables
~~~

## How it Works

1. The C++ logger simulates a trading application generating logs with realistic incident patterns — every ~2 minutes an incident spike occurs where 80% of transactions fail.
2. Splunk monitors the log file in real time and detects when the error rate exceeds 25%.
3. Splunk fires a webhook to the C++ backend, which creates an incident ticket in SQLite.
4. The React dashboard polls the backend every 5 seconds and displays active and resolved tickets.
5. Managers can assign tickets to teams and create developer accounts.
6. Developers see only tickets assigned to their team and can resolve them with resolution notes.

## Authentication & Roles

| Role | Capabilities |
|---|---|
| Manager | View all tickets, assign to teams, create developers, resolve tickets |
| Developer | View tickets assigned to their team, resolve with notes |

Managers are seeded at startup. Developers are created from the dashboard.

## Setup

### Prerequisites
- WSL (Ubuntu)
- g++ with C++17 support
- libsqlite3-dev (`sudo apt-get install -y libsqlite3-dev`)
- libssl-dev (`sudo apt-get install -y libssl-dev`)
- libsodium-dev (`sudo apt-get install -y libsodium-dev`)
- Splunk Free
- Node.js 20+ (via nvm)
- pnpm

### Environment Variables

Copy `.env.example` to `.env`:

~~~bash
cp .env.example .env
~~~

~~~env
LOG_PATH=/mnt/c/Users/youruser/path/to/logs/trading_app.log
LOG_INTERVAL_MS=500
JWT_SECRET=your_secret_key_here
SEED_ADMIN_USER=your_admin_user
SEED_ADMIN_PASSWORD=your_admin_password
~~~

The backend refuses to start unless `JWT_SECRET`, `SEED_ADMIN_USER`, and `SEED_ADMIN_PASSWORD` are set.

## Running the Project

### Mode 1 — Local development with Splunk (recommended)

Runs logger, backend, and frontend together. Splunk on Windows reads the log file and fires alerts.

~~~bash
./start.sh
~~~

Then open Splunk at `http://localhost:8000` and ensure the File Monitor is active.

Dashboard: `http://localhost:5173`

### Mode 2 — Docker Compose (no Splunk)

~~~bash
docker compose up --build
~~~

> **Note (WSL2):** Docker ports are not automatically exposed to Windows. Run this in PowerShell as administrator after `docker compose up`:
>
> ~~~powershell
> netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=<WSL_IP>
> netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=<WSL_IP>
> ~~~
>
> Get your WSL IP with: `ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1`

Dashboard: `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /login | None | Authenticate and get JWT |
| POST | /alert | None | Splunk webhook receiver |
| GET | /tickets | Any | List tickets (filtered by role) |
| PUT | /tickets/:id | Any | Resolve a ticket |
| PUT | /tickets/:id/assign | Manager | Assign ticket to a team |
| POST | /users | Manager | Create a developer account |
| GET | /users | Manager | List all developers |
| PUT | /users/:id/team | Manager | Change developer's team |

## Default Credentials

There are no hardcoded credentials. A single manager account is seeded at startup from
`SEED_ADMIN_USER` and `SEED_ADMIN_PASSWORD` in `.env`. Set those before the first run and
log in with those values. Developer accounts are then created from the dashboard.