import threading
from contextlib import asynccontextmanager

from fastapi.middleware.cors import CORSMiddleware


from fastapi import FastAPI

from api.auth import router as auth_router
from api.users import router as user_router
from api.classrooms import router as classroom_router
from mqtt.subscriber import start_mqtt_subscriber
from api.devices import router as device_router
from api.sensors import router as sensor_router
from api.vision import router as vision_router
from api.vision_calibration import router as vision_calibration_router
from api.faults import router as fault_router
from api.tickets import router as ticket_router
from api.ticket_history import router as ticket_history_router
from api.ticket_evidence import router as ticket_evidence_router    
from api.verification import router as verification_router
from api.health import router as health_router
from api.calibration_image import (
    router as calibration_image_router
)
from api.notifications import router as notification_router
from api.live import router as live_router
from services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app):
    threading.Thread(
        target=start_mqtt_subscriber,
        name="mqtt",
        daemon=True
    ).start()

    scheduler_stop = start_scheduler()

    print("SIMMS backend started.")

    yield

    scheduler_stop.set()


app = FastAPI(
    title="Smart Classroom Infrastructure Monitoring System",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(classroom_router)
app.include_router(device_router)
app.include_router(sensor_router)
app.include_router(vision_router)
app.include_router(fault_router)
app.include_router(ticket_router)
app.include_router(ticket_history_router)
app.include_router(ticket_evidence_router)
app.include_router(verification_router)
app.include_router(vision_calibration_router)
app.include_router(health_router)
app.include_router(
    calibration_image_router
)
app.include_router(notification_router)
app.include_router(live_router)

@app.get("/")
def root():
    return {
        "message": "SIMMS backend is running."
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }