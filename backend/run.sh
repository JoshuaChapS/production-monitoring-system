#!/bin/bash
cd "$(dirname "$0")"
export $(cat ../.env | xargs)
g++ -o server server.cpp -std=c++17 -pthread -lsqlite3 -lssl -lcrypto
if [ $? -eq 0 ]; then
    echo "Compiled successfully"
    ./server
else
    echo "Compilation failed"
    exit 1
fi