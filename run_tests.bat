@echo off
:: --- 1. הגדרת הנתיבים ---
SET NODE_DIR=C:\Rizone\Projects\nitur\nodejs\node-v22.18.0-win-x64
SET PROJECT_DIR=C:\Rizone\Projects\meeting

:: --- 2. יצירת תיקיות ---
if not exist "%PROJECT_DIR%\logs" mkdir "%PROJECT_DIR%\logs"

:: --- 3. ניקוי לוגים (30 יום) ---
forfiles /p "%PROJECT_DIR%\logs" /m *.txt /d -30 /c "cmd /c del @path" 2>nul

:: --- 4. הגדרת קובץ לוג ---
set LOG_FILE=%PROJECT_DIR%\logs\log_%date:~-4,4%-%date:~-7,2%-%date:~-10,2%.txt

:: --- 5. הרצה מאוחדת ---
SET PATH=%NODE_DIR%;%PATH%
SET PLAYWRIGHT_BROWSERS_PATH=0
cd /d "%PROJECT_DIR%"

echo --------------------------------------------------- >> "%LOG_FILE%"
echo Starting Combined Automation Run (ALL) at %TIME% >> "%LOG_FILE%"

:: הרצה של test:all שכוללת את שניהם
call npm run test:all >> "%LOG_FILE%" 2>&1

echo. >> "%LOG_FILE%"
echo Combined Session Ended at %TIME%. >> "%LOG_FILE%"
echo --------------------------------------------------- >> "%LOG_FILE%"