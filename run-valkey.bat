@echo off
chcp 65001 >nul
echo ========================================================
echo   KHOI DONG VALKEY VA VALKEY ADMIN CHO MINI MARKET
echo ========================================================
echo.

docker compose up -d --build

echo.
echo ========================================================
echo   TRANG THAI CONG VA DICH VU:
echo   - Website          : http://localhost:13000
echo   - Valkey Admin UI  : http://localhost:18080
echo   - CSDL duy nhat    : Valkey NoSQL
echo ========================================================
echo.
pause
