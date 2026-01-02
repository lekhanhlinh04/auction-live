@echo off
echo ========================================
echo   Building Auction Server
echo ========================================
echo.

echo Compiling...
gcc -o server.exe src/server.c src/db.c src/user.c src/room.c src/item.c src/auction.c -I./include -L./lib -lmysql -lws2_32 -Wall

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Build successful!
    echo ========================================
    echo Output: server.exe
) else (
    echo.
    echo ========================================
    echo   Build FAILED!
    echo ========================================
    echo Please check:
    echo - GCC is installed and in PATH
    echo - MySQL connector files in include/ and lib/
)

echo.
pause
