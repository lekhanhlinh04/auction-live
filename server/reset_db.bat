@echo off
echo ========================================
echo   Xoa du lieu DB - Giu lai tai khoan
echo ========================================
echo.

set MYSQL_PATH=mysql
set DB_HOST=localhost
set DB_USER=root
set DB_PASS=Hantieu0301
set DB_NAME=auction_db

echo Dang xoa du lieu...
echo.

echo [1/5] Xoa bids...
%MYSQL_PATH% -h %DB_HOST% -u %DB_USER% -p%DB_PASS% %DB_NAME% -e "DELETE FROM bids;"

echo [2/5] Xoa room_members...
%MYSQL_PATH% -h %DB_HOST% -u %DB_USER% -p%DB_PASS% %DB_NAME% -e "DELETE FROM room_members;"

echo [3/5] Xoa items...
%MYSQL_PATH% -h %DB_HOST% -u %DB_USER% -p%DB_PASS% %DB_NAME% -e "DELETE FROM items;"

echo [4/5] Xoa rooms...
%MYSQL_PATH% -h %DB_HOST% -u %DB_USER% -p%DB_PASS% %DB_NAME% -e "DELETE FROM rooms;"

echo [5/5] Xoa activity_log...
%MYSQL_PATH% -h %DB_HOST% -u %DB_USER% -p%DB_PASS% %DB_NAME% -e "DELETE FROM activity_logs;"

echo.
echo ========================================
echo   HOAN THANH! Tai khoan van duoc giu
echo ========================================
echo.

pause
