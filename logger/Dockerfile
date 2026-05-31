FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN g++ -o trading_logger trading_logger.cpp -std=c++17

CMD ["./trading_logger"]