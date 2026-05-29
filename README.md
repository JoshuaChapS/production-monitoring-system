# Production Monitoring System

An end-to-end production monitoring simulation inspired by enterprise CIB (Corporate & Investment Bank) environments, built to demonstrate real-world Production Management workflows.

## Architecture

C++ Log Generator → Splunk (real-time monitoring) → Webhook → C++ HTTP Backend → React Dashboard

## Tech Stack

| Component | Technology |
|---|---|
| Log Generator | C++ |
| Monitoring & Alerting | Splunk Free |
| Backend API | C++ with httplib |
| Frontend | React + TypeScript + Tailwind CSS |
| Build Tool | Vite + pnpm |

## Project Structure

    production-monitoring-system/
    ├── logger/          C++ trading app log simulator
    ├── backend/         C++ HTTP server — REST API
    ├── frontend/        React dashboard
    └── splunk/          Splunk configuration and SPL queries

## How it Works

1. The C++ logger simulates a trading application generating logs with realistic incident patterns — every ~2.5 minutes an incident spike occurs where 80% of transactions fail.
2. Splunk monitors the log file in real time and detects when the error rate exceeds 25%.
3. Splunk fires a webhook to the C++ backend, which creates an incident ticket.
4. The React dashboard polls the backend every 5 seconds and displays active and resolved tickets.
5. Engineers can resolve tickets directly from the dashboard.

## Setup

### Prerequisites
- WSL (Ubuntu)
- g++ with C++17 support
- Splunk Free
- Node.js 20+
- pnpm

### Environment Variables

Copy .env.example to .env and set your log path:

    cp .env.example .env

    LOG_PATH=/path/to/your/logs/trading_app.log
    LOG_INTERVAL_MS=500

### Running the Project

Terminal 1 — Log Generator:

    cd logger && ./run.sh

Terminal 2 — Backend:

    cd backend && ./run.sh

Terminal 3 — Frontend:

    cd frontend && pnpm dev

Then open Splunk at http://localhost:8000 and start the monitor.

The dashboard will be available at http://localhost:5173
