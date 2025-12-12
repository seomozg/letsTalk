@echo off
echo Setting GEMINI_API_KEY environment variable...

REM Replace YOUR_API_KEY_HERE with your actual Gemini API key
SET GEMINI_API_KEY=

REM Or use environment variable if already set
REM set GEMINI_API_KEY=%GEMINI_API_KEY%

echo Starting server...
python server.py
