"""
Run the real backend for the end-to-end test without reading
backend/.env: every setting comes from the environment run.py passes in
(throwaway database, test broker, short timings).
"""

import os
import sys
from pathlib import Path

import dotenv

dotenv.load_dotenv = lambda *args, **kwargs: False

BACKEND = Path(__file__).resolve().parents[2]
os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

import uvicorn  # noqa: E402

uvicorn.run(
    "main:app",
    host="127.0.0.1",
    port=int(os.environ.get("E2E_PORT", "8001")),
    log_level="warning",
)
