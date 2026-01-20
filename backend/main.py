import sys
import os
from pathlib import Path

# Add parent directory to path so we can import backend module
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from backend.database import init_db, SessionLocal
from backend.routers import auth, groups, media, messages, admin, templates
from backend.routers import settings as settings_router
from backend.services import message_service, settings_service
from backend.config import settings
from backend.migrate_analytics import migrate as run_migration


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown events."""
    # Startup
    print("Starting Telegram Automation System...")
    
    # Run database migration
    try:
        print("Checking database schema...")
        run_migration()
    except Exception as e:
        print(f"Migration warning: {e}")
    
    # Initialize database
    init_db()
    print("Database initialized")
    
    # Start scheduler
    message_service.start()
    
    # Load scheduled messages
    db = SessionLocal()
    try:
        # Cleanup stuck jobs (marked as sending but server restarted)
        message_service.cleanup_stuck_jobs(db)
        
        message_service.load_scheduled_messages(db)
        settings_service.refresh_settings_cache(db)
    finally:
        db.close()
    
    yield
    
    # Shutdown
    print("Shutting down...")
    message_service.shutdown()


# Create FastAPI app
app = FastAPI(
    title="Telegram User Automation System",
    description="Automate Telegram marketing with user account",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(media.router)
app.include_router(messages.router)
app.include_router(settings_router.router)
app.include_router(admin.router)
app.include_router(templates.router)

# Serve frontend static files
frontend_dir = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Telegram Automation System"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
