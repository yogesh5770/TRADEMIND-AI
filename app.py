import uvicorn
from backend.main import app

if __name__ == "__main__":
    # Hugging Face Spaces expects the app to bind to port 7860
    uvicorn.run(app, host="0.0.0.0", port=7860)
