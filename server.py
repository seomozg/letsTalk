import os
import asyncio
import json
import base64
import logging
from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Mount static files if needed (for now just templates)
templates = Jinja2Templates(directory="templates")

# Configuration
MODEL = "models/gemini-2.5-flash-native-audio-preview-09-2025"
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHANNELS = 1

# Initialize Gemini Client
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY environment variable not found!")
    print("Please set it by running: set GEMINI_API_KEY=your_actual_api_key_here")
    print("Or edit run_server.bat to set it in the script.")
    exit(1)

client = genai.Client(
    http_options={"api_version": "v1beta"},
    api_key=api_key,
)

# Gemini Configuration
config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],  # We want audio response
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Zephyr")
        )
    ),
    system_instruction=types.Content(
        parts=[
            types.Part(
                text="You are a helpful audio chat assistant. You can speak fluently in both Russian and English. "
                     "Listen to the user and respond in the same language they use (Russian or English). "
                     "Keep your responses concise and natural for a voice conversation."
            )
        ]
    ),
)

@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Websocket connection accepted")

    try:
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            logger.info("Connected to Gemini Live API")
            
            # Create a task to receive from Gemini and send to client
            async def receive_from_gemini():
                while True:
                    try:
                        turn = session.receive()
                        async for response in turn:
                            if response.data:
                                # Send audio data to client
                                # Encoding to base64 to send via text frame (or send bytes directly)
                                # Let's send bytes directly if possible, or base64 json
                                await websocket.send_json({
                                    "type": "audio",
                                    "data": base64.b64encode(response.data).decode("utf-8")
                                })
                            if response.text:
                                logger.info(f"Gemini Text: {response.text}")
                    except Exception as e:
                        logger.error(f"Error receiving from Gemini: {e}")
                        break

            receive_task = asyncio.create_task(receive_from_gemini())

            try:
                while True:
                    # Receive message from client
                    message = await websocket.receive_text()
                    data = json.loads(message)
                    
                    if data["type"] == "audio":
                        # Audio data from client (base64 encoded PCM)
                        audio_bytes = base64.b64decode(data["data"])
                        await session.send(input={"data": audio_bytes, "mime_type": "audio/pcm"})
                    
                    elif data["type"] == "text":
                        # Text message if we want to support text input too
                        await session.send(input=data["data"], end_of_turn=True)

            except WebSocketDisconnect:
                logger.info("Client disconnected")
            except Exception as e:
                logger.error(f"Error acting on websocket: {e}")
            finally:
                receive_task.cancel()

    except Exception as e:
        logger.error(f"Connection error: {e}")
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
