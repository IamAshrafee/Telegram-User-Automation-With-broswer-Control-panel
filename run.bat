@echo off
echo Starting Telegram Automation System...
echo.

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate

if not exist venv\Lib\site-packages\fastapi (
    echo Installing dependencies...
    pip install -r requirements.txt
)

echo.
echo Starting Backend Server...
echo The application will be available at http://localhost:8000
echo.

cd backend
python main.py
pause
