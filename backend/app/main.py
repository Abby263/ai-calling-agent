from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings
from app.db.store import InMemoryTaskStore
from app.services.orchestrator import TaskOrchestrator


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Voice Concierge Agent MVP API",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.database_url and not settings.demo_mode:
        from app.db.postgres_store import PostgresTaskStore

        store = PostgresTaskStore(settings.database_url)
    else:
        store = InMemoryTaskStore()
    app.state.settings = settings
    app.state.store = store
    app.state.orchestrator = TaskOrchestrator(settings, store)

    @app.get("/health")
    async def health() -> dict[str, str | bool]:
        return {
            "status": "ok",
            "demo_mode": settings.demo_mode,
            "google_places_enabled": settings.google_places_enabled,
            "twilio_enabled": settings.twilio_enabled,
            "openai_enabled": settings.openai_enabled,
        }

    app.include_router(api_router)
    return app


app = create_app()
