import os
import asyncio
import json
import base64
import logging
import uuid as uuid
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

load_dotenv()

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

# Initialize Clients
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

kie_api_key = os.environ.get("KIE_API_KEY")
if not kie_api_key:
    print("WARNING: KIE_API_KEY environment variable not found!")
    print("Image generation will use placeholders.")
    print("Please set it by running: set KIE_API_KEY=your_actual_api_key_here")

# Initialize chats storage
chats = {}

def load_chats():
    global chats
    chats_file = os.environ.get('CHATS_FILE', 'data/chats.json')
    if os.path.exists(chats_file):
        with open(chats_file, 'r') as f:
            saved_chats = json.load(f)
            for chat_id, data in saved_chats.items():
                if isinstance(data, dict) and "prompt" in data:
                    prompt = data["prompt"]
                    voice = data.get("voice", choose_voice(prompt))
                    image_url = data.get("image_url", "")
                    chats[chat_id] = {
                        "prompt": prompt,
                        "voice": voice,
                        "image_url": image_url,
                        "config": create_chat_config(prompt, voice)
                    }
                else:
                    # Backward compatibility, old format was {cid: prompt}
                    prompt = data
                    chats[chat_id] = {
                        "prompt": prompt,
                        "config": create_chat_config(prompt)
                    }

async def generate_image(prompt):
    if not kie_api_key:
        logger.info("Kie API key not set, skipping image generation")
        return ""  # No image if no API key
    try:
        image_prompt = f"Chat with {prompt}"
        headers = {"Authorization": f"Bearer {kie_api_key}"}
        payload = {
            "model": "z-image",
            "input": {
                "prompt": image_prompt,
                "aspect_ratio": "1:1"
            }
        }
        logger.info(f"Starting Kie image generation for prompt: {prompt[:50]}...")
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            # Start generation
            response = await client.post("https://api.kie.ai/api/v1/jobs/createTask", json=payload, headers=headers)
            data = response.json()
            task_id = data.get("data", {}).get("taskId")
            if not task_id:
                logger.error("No taskId received from Kie API")
                return ""
            logger.info(f"Kie task started: {task_id}")

                # Poll for status (max 20 attempts ~1 minute)
            max_attempts = 20
            attempt = 0
            while attempt < max_attempts:
                await asyncio.sleep(3)  # Wait 3 seconds to reduce requests
                params = {"taskId": task_id}
                status_resp = await client.get("https://api.kie.ai/api/v1/jobs/recordInfo", params=params, headers=headers)
                status_data = status_resp.json()
                task_state = status_data.get("data", {}).get("state", "") if status_data and "data" in status_data else ""
                logger.info(f"Kie task {task_id} status: {task_state}")
                if task_state == "success":
                    result_json_str = status_data.get("data", {}).get("resultJson", "") if "data" in status_data else ""
                    if result_json_str:
                        try:
                            result_json = json.loads(result_json_str)
                            result_urls = result_json.get("resultUrls", [])
                            if result_urls:
                                image_url = result_urls[0]
                                logger.info(f"Kie image ready: {image_url}")
                                return image_url
                        except json.JSONDecodeError:
                            logger.error("Invalid resultJson")
                    logger.error(f"Kie task {task_id} completed but no image url")
                    return ""
                elif task_state == "failed":
                    logger.error(f"Kie task {task_id} failed")
                    return ""
                elif task_state in ("exception", "") and attempt > 10:
                    logger.error(f"Kie task {task_id} failed with state: {task_state}")
                    return ""
                attempt += 1
                # Continue polling
            logger.error(f"Kie task {task_id} timed out")
            return ""
    except Exception as e:
        logger.error(f"Error generating image with Kie API: {e}")
        return ""

def save_chats():
    chats_file = os.environ.get('CHATS_FILE', 'data/chats.json')
    os.makedirs(os.path.dirname(chats_file), exist_ok=True)
    saved_chats = {cid: {"prompt": data["prompt"], "voice": data.get("voice", "Zephyr"), "image_url": data.get("image_url", "")} for cid, data in chats.items() if cid != "default" and "voice" in data}
    with open(chats_file, 'w') as f:
        json.dump(saved_chats, f)

def choose_voice(prompt):
    prompt_lower = prompt.lower()
    if "pirate" in prompt_lower or "adventurous" in prompt_lower or "upbeat" in prompt_lower:
        return "Puck"
    elif "robot" in prompt_lower or "machine" in prompt_lower or "artificial" in prompt_lower:
        return "Umbriel"  # Relaxed/Easy-going
    elif "child" in prompt_lower or "young" in prompt_lower or "youthful" in prompt_lower:
        return "Leda"
    elif "breathy" in prompt_lower:
        return "Enceladus"
    elif "deep" in prompt_lower and "male" in prompt_lower:
        return "Orus"
    elif "deep" in prompt_lower and "female" in prompt_lower:
        return "Aoede"
    elif "expressive" in prompt_lower and "male" in prompt_lower:
        return "Fenrir"
    elif "expressive" in prompt_lower and "female" in prompt_lower:
        return "Kore"
    elif "narrative" in prompt_lower or "storyteller" in prompt_lower or "book" in prompt_lower:
        return "Charon"
    elif "female" in prompt_lower:
        return "Erinome"
    elif "male" in prompt_lower:
        return "Iapetus"
    else:
        return "Zephyr"

def create_chat_config(prompt="You are a helpful audio chat assistant.", voice="Zephyr"):
    # Create config for a chat based on prompt and voice
    system_text = prompt
    
    return types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],  # We want audio response
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
            )
        ),
        system_instruction=types.Content(
            parts=[
                types.Part(text=system_text)
            ]
        ),
    )

# Default chat
chats["default"] = {
    "prompt": "",
    "config": create_chat_config("")
}

load_chats()  # Load saved chats after default is set

@app.get("/chats")
def get_chats():
    return {cid: {"prompt": data["prompt"], "voice": data.get("voice", "Zephyr"), "image_url": data.get("image_url", "")} for cid, data in chats.items()}

@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/create_chat")
async def create_chat(request: Request):
    data = await request.json()
    prompt = data.get("prompt", "")
    voice = choose_voice(prompt)
    image_url = await generate_image(prompt)
    chat_id = str(uuid.uuid4())
    config_new = create_chat_config(prompt, voice)
    chats[chat_id] = {
        "prompt": prompt,
        "voice": voice,
        "image_url": image_url,
        "config": config_new
    }
    save_chats()
    return {"chat_id": chat_id, "voice": voice, "image_url": image_url}

@app.post("/delete_chat")
async def delete_chat(request: Request):
    data = await request.json()
    chat_id = data.get("chat_id")
    if chat_id and chat_id in chats and chat_id != "default":
        del chats[chat_id]
        save_chats()
        return {"success": True}
    return {"success": False}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Websocket connection accepted")

    # Wait for initialize message
    chat_id = "default"
    try:
        init_message = await websocket.receive_text()
        init_data = json.loads(init_message)
        if init_data.get("type") != "initialize":
            await websocket.send_json({"error": "First message must be initialize"})
            await websocket.close()
            return
        chat_id = init_data.get("chat_id", "default")
        if chat_id not in chats:
            await websocket.send_json({"error": "Chat not found"})
            await websocket.close()
            return
        current_config = chats[chat_id]["config"]
    except WebSocketDisconnect:
        return

    try:
        async with client.aio.live.connect(model=MODEL, config=current_config) as session:
            logger.info("Connected to Gemini Live API")
            
            # Create a task to receive from Gemini and send to client
            async def receive_from_gemini():
                while True:
                    try:
                        turn = session.receive()
                        async for response in turn:
                            if response.data:
                                # Send audio data to client
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
