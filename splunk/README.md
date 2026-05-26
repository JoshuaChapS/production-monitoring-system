# Splunk Configuration

## Monitor Setup
- Source: `C:\Users\{user}\OneDrive\Documentos\Aprendizaje\JPM\logs\trading_app.log`
- Source type: `trading_app`
- Index: `trading`
- Host: `trading-server-mexico`

## Base Query
index="trading" earliest=-5m

## Real-time Timechart
index="trading" | timechart count by level

## Webhook Configuration
- Action: Webhook
- URL: http://localhost:8080/alert
- Trigger: When error_rate > 25% in last 15 minutes
