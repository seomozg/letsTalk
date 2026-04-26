import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import server


@pytest.fixture(autouse=True)
def reset_chats(monkeypatch):
    original_chats = server.chats.copy()
    server.chats.clear()
    server.chats["default"] = {"prompt": "", "config": server.create_chat_config("")}
    yield
    server.chats.clear()
    server.chats.update(original_chats)


def test_delete_character_endpoint_removes_chat(monkeypatch):
    server.chats["abc"] = {
        "prompt": "Test",
        "voice": "Zephyr",
        "image_url": "",
        "likes": 0,
        "liked_by": [],
        "config": server.create_chat_config("Test", "Zephyr"),
    }

    request = MagicMock()
    request.json = AsyncMock(return_value={"chat_id": "abc"})

    response = asyncio.run(server.delete_character(request))

    assert response == {"success": True}
    assert "abc" not in server.chats


def test_delete_character_endpoint_rejects_default(monkeypatch):
    request = MagicMock()
    request.json = AsyncMock(return_value={"chat_id": "default"})

    response = asyncio.run(server.delete_character(request))

    assert response == {"success": False}


def test_generate_image_uses_fal_endpoint(monkeypatch):
    monkeypatch.setattr(server, "fal_api_key", "test-key", raising=False)
    response_mock = MagicMock()
    response_mock.json.return_value = {
        "images": [{"url": "https://example.com/image.png"}]
    }

    async def fake_post(*args, **kwargs):
        assert args[0] == "https://fal.run/fal-ai/z-image/turbo"
        assert kwargs["headers"]["Authorization"] == "Key test-key"
        return response_mock

    client_mock = AsyncMock()
    client_mock.__aenter__.return_value = client_mock
    client_mock.post = fake_post
    monkeypatch.setattr(server.httpx, "AsyncClient", lambda *a, **k: client_mock)

    monkeypatch.setattr(server, "download_image_locally", AsyncMock(return_value="/generated/test.png"))

    result = asyncio.run(server.generate_image("prompt"))

    assert result == "/generated/test.png"