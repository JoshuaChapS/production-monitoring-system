#!/bin/bash
echo "Starting Production Monitoring System..."

# Start logger in background
cd logger
export $(cat ../.env | xargs)
g++ -o trading_logger trading_logger.cpp -std=c++17
./trading_logger &
LOGGER_PID=$!
echo "Logger started (PID: $LOGGER_PID)"

# Start backend in background
cd ../backend
g++ -o server server.cpp -std=c++17 -pthread -lsqlite3
./server &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Start frontend
cd ../frontend
echo "Starting frontend at http://localhost:5173"
pnpm dev &
FRONTEND_PID=$!

echo ""
echo "All services running. Press Ctrl+C to stop."

# Stop all on exit
trap "kill $LOGGER_PID $BACKEND_PID $FRONTEND_PID" EXIT
wait
