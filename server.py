import os
import asyncio
import json
import base64
from pathlib import Path
import logging
import uuid as uuid
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

chats_file_path = Path(os.environ.get("CHATS_FILE", "data/chats.json"))
data_dir = chats_file_path.parent
generated_dir = Path(os.environ.get("GENERATED_DIR", str(data_dir / "generated")))
generated_dir.mkdir(parents=True, exist_ok=True)

# Mount static files
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/generated", StaticFiles(directory=str(generated_dir)), name="generated")
app.mount("/templates", StaticFiles(directory="templates"), name="templates")

# Templates
templates = Jinja2Templates(directory="templates")

# Configuration
MODEL = "models/gemini-3.1-flash-live-preview"
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

fal_api_key = os.environ.get("FAL_API_KEY")
if not fal_api_key:
    print("WARNING: FAL_API_KEY environment variable not found!")
    print("Image generation will use placeholders.")
    print("Please set it by running: set FAL_API_KEY=your_actual_api_key_here")

# Initialize chats storage
chats = {}

def load_chats():
    global chats
    chats_file = str(chats_file_path)
    if os.path.exists(chats_file):
        with open(chats_file, 'r') as f:
            saved_chats = json.load(f)
            for chat_id, data in saved_chats.items():
                if isinstance(data, dict) and "prompt" in data:
                    prompt = data["prompt"]
                    voice = data.get("voice", choose_voice(prompt))
                    image_url = normalize_image_url(data.get("image_url", ""))
                    likes = data.get("likes", 0)
                    chats[chat_id] = {
                        "prompt": prompt,
                        "voice": voice,
                        "image_url": image_url,
                        "likes": likes,
                        "liked_by": data.get("liked_by", []),
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
    if not fal_api_key:
        logger.info("FAL API key not set, skipping image generation")
        return ""  # No image if no API key
    try:
        image_prompt = prompt
        headers = {
            "Authorization": f"Key {fal_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "prompt": image_prompt,
            "num_inference_steps": 8,
            "num_images": 1,
            "output_format": "png",
        }
        logger.info(f"Starting FAL image generation for prompt: {prompt[:50]}...")
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            response = await client.post("https://fal.run/fal-ai/z-image/turbo", json=payload, headers=headers)
            data = response.json()
            images = data.get("images", []) if isinstance(data, dict) else []
            if images:
                image_url = images[0].get("url", "")
                if image_url:
                    local_url = await download_image_locally(image_url)
                    logger.info(f"FAL image ready: {image_url}")
                    return local_url or image_url
            logger.error("FAL response did not include image url")
            return ""
    except Exception as e:
        logger.error(f"Error generating image with FAL API: {e}")
        return ""


async def download_image_locally(image_url: str) -> str:
    try:
        static_dir = generated_dir
        static_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.png"
        file_path = static_dir / filename
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            file_path.write_bytes(response.content)
        return f"/generated/{filename}"
    except Exception as e:
        logger.error(f"Failed to download image: {e}")
        return ""

def save_chats():
    chats_file = str(chats_file_path)
    os.makedirs(os.path.dirname(chats_file), exist_ok=True)
    saved_chats = {cid: {"prompt": data["prompt"], "voice": data.get("voice", "Zephyr"), "image_url": data.get("image_url", ""), "likes": data.get("likes", 0), "liked_by": data.get("liked_by", [])} for cid, data in chats.items() if cid != "default" and "voice" in data}
    with open(chats_file, 'w') as f:
        json.dump(saved_chats, f)


def normalize_image_url(image_url: str) -> str:
    if not image_url:
        return ""
    if image_url.startswith("/static/generated/"):
        return image_url.replace("/static/generated/", "/generated/")
    return image_url

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
        response_modalities=["AUDIO"],
        media_resolution="MEDIA_RESOLUTION_MEDIUM",
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
            )
        ),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(disabled=False)
        ),
        context_window_compression=types.ContextWindowCompressionConfig(
            trigger_tokens=104857,
            sliding_window=types.SlidingWindow(target_tokens=52428),
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
    return {cid: {"prompt": data["prompt"], "voice": data.get("voice", "Zephyr"), "image_url": data.get("image_url", ""), "likes": data.get("likes", 0)} for cid, data in chats.items()}

@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    # Serve the React frontend
    with open("static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read(), status_code=200)


@app.get("/audio-worklet.js")
async def audio_worklet():
    return FileResponse("static/audio-worklet.js", media_type="application/javascript")

@app.get("/chat/{chat_id}", response_class=HTMLResponse)
async def chat_page(request: Request, chat_id: str):
    if chat_id not in chats:
        return templates.TemplateResponse("main.html", {"request": request})  # Redirect to main if not found
    with open("static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read(), status_code=200)


@app.get("/characters", response_class=HTMLResponse)
async def characters_page(request: Request):
    with open("static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read(), status_code=200)

@app.post("/create_chat")
async def create_chat(request: Request):
    data = await request.json()
    original_prompt = data.get("prompt", "")

    # Translate prompt using DeepSeek
    translated_prompt = await translate_text_via_deepseek(original_prompt)

    voice = choose_voice(translated_prompt)
    image_url = await generate_image(translated_prompt)
    chat_id = str(uuid.uuid4())
    config_new = create_chat_config(translated_prompt, voice)
    chats[chat_id] = {
        "prompt": translated_prompt,  # Save translated prompt
        "voice": voice,
        "image_url": image_url,
        "likes": 0,
        "liked_by": [],
        "config": config_new
    }
    save_chats()
    return {"chat_id": chat_id, "voice": voice, "image_url": image_url}

async def translate_text_via_deepseek(text: str) -> str:
    """Translate text to English and add gender description using DeepSeek"""
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")
    if not deepseek_key:
        logger.warning("DeepSeek API key not found, using original text")
        return text

    try:
        import httpx
        response = httpx.post(
            "https://api.deepseek.com/v1/chat/completions",
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": f"Translate this text to English and determine if it's male or female character, add 'male' or 'female' to the description: \"{text}\""}],
                "max_tokens": 200
            },
            headers={"Authorization": f"Bearer {deepseek_key}"},
            timeout=10.0
        )
        if response.status_code == 200:
            result = response.json()
            translated = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            logger.info(f"DeepSeek translation: '{text}' -> '{translated}'")
            return translated or text
        else:
            logger.error(f"DeepSeek API error: {response.status_code} {response.text}")
            return text
    except Exception as e:
        logger.error(f"DeepSeek translation error: {e}")
        return text

@app.post("/delete_chat")
async def delete_chat(request: Request):
    data = await request.json()
    chat_id = data.get("chat_id")
    if chat_id and chat_id in chats and chat_id != "default":
        del chats[chat_id]
        save_chats()
        return {"success": True}
    return {"success": False}


@app.post("/service/delete_character")
async def delete_character(request: Request):
    data = await request.json()
    chat_id = data.get("chat_id")
    if chat_id and chat_id in chats and chat_id != "default":
        del chats[chat_id]
        save_chats()
        return {"success": True}
    return {"success": False}

@app.post("/like_chat")
async def like_chat(request: Request):
    data = await request.json()
    chat_id = data.get("chat_id")
    client_ip = request.client.host
    if chat_id and chat_id in chats:
        liked_by = chats[chat_id].get("liked_by", [])
        if client_ip not in liked_by:
            liked_by.append(client_ip)
            chats[chat_id]["liked_by"] = liked_by
            chats[chat_id]["likes"] += 1
            save_chats()
            return {"likes": chats[chat_id]["likes"]}
        else:
            return {"error": "Already liked"}
    return {"error": "Chat not found"}

@app.post("/translate")
async def translate_text(request: Request):
    data = await request.json()
    text = data.get("text", "")
    from_lang = data.get("from_lang", "")
    logger.info(f"Translate request: text='{text}', from_lang='{from_lang}'")
    if not text:
        logger.info("No text to translate")
        return {"translated": text}

    # Use DeepSeek API if key is set
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")
    logger.info(f"DeepSeek key present: {bool(deepseek_key)}")
    if not deepseek_key:
        return {"translated": text}  # Fallback

    try:
        import httpx
        response = httpx.post(
            "https://api.deepseek.com/v1/chat/completions",
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": f"Translate this text to English and determine if it's male or female character, add 'male' or 'female' to the description: \"{text}\""}],
                "max_tokens": 100
            },
            headers={"Authorization": f"Bearer {deepseek_key}"},
            timeout=10.0
        )
        if response.status_code == 200:
            result = response.json()
            translated = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            logger.info(f"Translated: '{text}' -> '{translated}'")
            return {"translated": translated or text}
        else:
            logger.error(f"DeepSeek API error: {response.status_code} {response.text}")
            return {"translated": text}
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return {"translated": text}

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
            
            # Use dict to avoid nonlocal issues
            state = {"awaiting_response": False}

            # Create a task to receive from Gemini and send to client
            async def receive_from_gemini():
                logger.info("✅ Gemini receive task started")
                while True:
                    try:
                        async for response in session.receive():
                            logger.info(f"📥 Got Gemini response type: {type(response)}")
                            if response.data:
                                # Send audio data to client
                                logger.info("✅ Received audio from Gemini: %s bytes", len(response.data))
                                await websocket.send_json({
                                    "type": "audio",
                                    "data": base64.b64encode(response.data).decode("utf-8")
                                })
                            if response.text:
                                logger.info(f"✅ Gemini Text: {response.text}")
                                # Reset awaiting flag after response
                                state["awaiting_response"] = False
                            if response.server_content:
                                logger.info(f"✅ Gemini turn complete")
                                state["awaiting_response"] = False
                    except Exception as e:
                        logger.error(f"❌ Error receiving from Gemini: {e}", exc_info=True)
                        break
                logger.info("⚠️ Gemini receive task exited")

            last_audio_time = 0
            auto_end_task = None
            
            receive_task = asyncio.create_task(receive_from_gemini())
            
            # Fix Gemini first message bug - send dummy end of turn
            await session.send_realtime_input(audio_stream_end=True)
            
            async def auto_end_turn():
                try:
                    await asyncio.sleep(0.5)
                    logger.info("⏱️ AUTO: Sending audio_stream_end to Gemini")
                    await session.send_realtime_input(audio_stream_end=True)
                    state["awaiting_response"] = True
                except Exception as e:
                    logger.error(f"❌ Ошибка в auto_end_turn: {e}")

            try:
                while True:
                    # Receive message from client
                    message = await websocket.receive_text()
                    data = json.loads(message)
                    
                    if data["type"] == "audio":
                        # Audio data from client (base64 encoded PCM)
                        audio_bytes = base64.b64decode(data["data"])
                        await session.send_realtime_input(
                            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm")
                        )
                        
                        # Cancel previous auto end task
                        if auto_end_task:
                            auto_end_task.cancel()
                        # Schedule new auto end after 0.5 sec silence
                        auto_end_task = asyncio.create_task(auto_end_turn())

                    elif data["type"] == "end_of_turn":
                        logger.info("Sending audio_stream_end to Gemini")
                        if auto_end_task:
                            auto_end_task.cancel()
                        await session.send_realtime_input(audio_stream_end=True)

                    elif data["type"] == "text":
                        # Text message if we want to support text input too
                        await session.send_client_content(
                            turns=[types.Content(role="user", parts=[types.Part(text=data["data"])])],
                            turn_complete=True,
                        )

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
