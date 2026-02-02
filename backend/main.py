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
from backend.routers import auth, groups, media, messages, admin, templates, users
from backend.routers import settings as settings_router
from backend.services import message_service, settings_service
from backend.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown events."""
    # Startup
    print("Starting Telegram Automation System...")
    
    # Initialize database
    init_db()
    print("Database initialized")
    
    # Create default admin user if no users exist
    db = SessionLocal()
    try:
        from backend.models.user import User
        from backend.utils.auth import get_password_hash
        
        if db.query(User).count() == 0:
            admin = User(
                email="admin@example.com",
                name="Administrator",
                password_hash=get_password_hash("admin123"),
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("✓ Created default admin user: admin@example.com / admin123")
    finally:
        db.close()
    
    # Start scheduler
    message_service.start()
    
    # Load scheduled messages
    db = SessionLocal()
    try:
        # Cleanup stuck jobs (marked as sending but server restarted)
        message_service.cleanup_stuck_jobs(db)
        
        message_service.load_scheduled_messages(db)
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
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(media.router)
app.include_router(messages.router)
app.include_router(settings_router.router)
app.include_router(admin.router)
app.include_router(templates.router)

# Health check endpoint - MUST be before static files mount!
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Telegram Automation System"}

# Serve frontend static files - MUST be last!
# Static file mount catches all remaining paths
frontend_dir = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
