FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    g++ \
    libsqlite3-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN g++ -o server server.cpp -std=c++17 -pthread -lsqlite3 -lssl -lcrypto

EXPOSE 8080
CMD ["./server"]