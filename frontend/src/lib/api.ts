const API_BASE = window.location.origin;

export interface Chat {
  prompt: string;
  voice: string;
  image_url: string;
  likes: number;
}

export interface CreateChatRequest {
  prompt: string;
}

export interface CreateChatResponse {
  chat_id: string;
  voice: string;
  image_url: string;
}

export interface LikeChatRequest {
  chat_id: string;
}

export interface LikeChatResponse {
  likes: number;
}

export interface DeleteCharacterRequest {
  chat_id: string;
}

export interface DeleteCharacterResponse {
  success: boolean;
}

export interface TranslateRequest {
  text: string;
  from_lang: string;
}

export interface TranslateResponse {
  translated: string;
}

export const api = {
  getChats: async (): Promise<Record<string, Chat>> => {
    const response = await fetch(`${API_BASE}/chats`);
    if (!response.ok) throw new Error('Failed to fetch chats');
    return response.json();
  },

  createChat: async (data: CreateChatRequest): Promise<CreateChatResponse> => {
    const response = await fetch(`${API_BASE}/create_chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create chat');
    return response.json();
  },

  likeChat: async (data: LikeChatRequest): Promise<LikeChatResponse> => {
    const response = await fetch(`${API_BASE}/like_chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to like chat');
    return response.json();
  },

  translate: async (data: TranslateRequest): Promise<TranslateResponse> => {
    const response = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to translate');
    return response.json();
  },

  deleteCharacter: async (
    data: DeleteCharacterRequest,
  ): Promise<DeleteCharacterResponse> => {
    const response = await fetch(`${API_BASE}/service/delete_character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to delete character');
    return response.json();
  },
};
