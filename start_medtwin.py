import subprocess
import sys
import os
import time

def main():
    print("=====================================================")
    print("  Starting MedTwin AI Digital Twin Platform          ")
    print("=====================================================")
    
    root_dir = os.path.dirname(os.path.abspath(__file__))
    next_dir = os.path.join(root_dir, "next-dashboard")

    # Start FastAPI backend
    print("-> Launching FastAPI Backend (cloud.api.main:app on port 8000)")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "cloud.api.main:app", "--reload", "--port", "8000"],
        cwd=root_dir
    )

    # Give backend a moment to bind ports
    time.sleep(2)

    # Start Next.js frontend
    print(f"-> Launching Next.js Frontend Dashboard from {next_dir}")
    frontend_proc = subprocess.Popen(
        "npm run dev",
        cwd=next_dir,
        shell=True
    )

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\n[!] Shutting down MedTwin Platform...")
        backend_proc.terminate()
        frontend_proc.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
