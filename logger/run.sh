#!/bin/bash
cd "$(dirname "$0")"
export $(cat ../.env | xargs)
g++ -o trading_logger trading_logger.cpp -std=c++17
if [ $? -eq 0 ]; then
    echo "Compiled successfully"
    ./trading_logger
else
    echo "Compilation failed"
    exit 1
fi
