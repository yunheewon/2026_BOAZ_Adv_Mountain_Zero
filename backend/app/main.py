
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.floorplan.router import router as floorplan_router

app = FastAPI(
    title="FORKSIGHT API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "FORKSIGHT API is running"}

@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(api_router)
app.include_router(floorplan_router)
