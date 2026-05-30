#!/bin/bash
cd "$(dirname "$0")"
g++ -o server server.cpp -std=c++17 -pthread -lsqlite3
if [ $? -eq 0 ]; then
    echo "Compiled successfully"
    ./server
else
    echo "Compilation failed"
    exit 1
fi
