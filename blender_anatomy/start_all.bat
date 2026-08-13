@echo off
setlocal

REM Resolve the directory this script lives in (trailing backslash included)
set "ROOT=%~dp0"

echo ========================================================
echo MedTwin: Unified Integration Demo (Tracking, Detecting, Forecasting)
echo ========================================================
echo.

echo [1/3] Starting Centralized API Gateway on port 8001...
start "MedTwin API Hub" cmd /c "cd /d "%ROOT%MedTwin" && set MEDTWIN_XGB_MODEL_PATH=%ROOT%MedTwin\artifacts\xgb_heart_model.pkl && set MEDTWIN_ENABLE_REMOTE_NLP=1 && python -m uvicorn cloud.api.main:app --host 0.0.0.0 --port 8001"
ping 127.0.0.1 -n 6 > nul

echo [2/3] Starting Live Edge Telemetry Simulator...
start "MedTwin Edge Node" cmd /c "cd /d "%ROOT%MedTwin" && python edge\mqtt_publisher.py"

echo [3/3] Starting Advanced Fullstack UI...
start "MedTwin Vite Frontend" cmd /c "cd /d "%ROOT%Advanced Interactive Application" && npm run dev"

echo.
echo All modules are running!
echo - Vite Frontend Dashboard: http://localhost:8443
echo - API Hub Docs: http://localhost:8001/docs
echo - Edge Simulator: Broadcasting live telemetry + heart.csv data to MQTT
echo.
echo [Optional] To see the 3D Dynamic Heartbeat Animation:
echo 1. Open Blender
echo 2. Load MedTwin\scripts\animate_heart.py in the Scripting tab
echo 3. Click "Run Script"
echo.
pause
