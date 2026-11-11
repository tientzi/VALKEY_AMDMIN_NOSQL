@echo off
chcp 65001 >nul
echo Khoi dong MiniMart Valkey NoSQL...
docker compose down --remove-orphans
docker compose up --build
pause
