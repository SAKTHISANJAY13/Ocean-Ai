from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="ORIGIN API",
    description="AI-Based Oil Spill Detection and Source Attribution",
    version="1.0.0",
)

# Allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "ORIGIN API is running",
        "status": "online"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "ORIGIN backend"
    }