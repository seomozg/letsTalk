# AI Audio Chat - Real-time Voice Chat with Gemini AI

Многозвучный (русский/английский) веб-чат с искусственным интеллектом в реальном времени через голосовое взаимодействие.

Multi-language (Russian/English) real-time AI voice chat web application.

## 🚀 Quick Start (Development)

### Prerequisites
- Docker & Docker Compose
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Setup
1. **Clone and enter project directory**
   ```bash
   cd letsTalk
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file**
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. **Run development deployment**
   ```bash
   ./deploy.sh
   # or: docker-compose up --build
   ```

5. **Open in browser**
   - Visit: http://localhost:8000
   - Click "Start Chat" and allow microphone access

## 🏭 Production Deployment

### Option 1: Fly.io Deployment (Recommended)

1. **Install Fly CLI**
   ```bash
   # Install Fly CLI (if not already installed)
   curl -L https://fly.io/install.sh | sh
   ```

2. **Authenticate with Fly**
   ```bash
   fly auth login
   ```

3. **Set Application Secrets**
   ```bash
   # Required: Set your Gemini API key
   fly secrets set GEMINI_API_KEY=your_actual_gemini_api_key_here

   # Optional: Set Kie.ai API key for image generation
   fly secrets set KIE_API_KEY=your_kie_api_key_here
   ```

4. **Deploy to Fly.io**
   ```bash
   fly deploy
   ```

5. **Access Your App**
   - Your app will be available at: `https://letstalk.fly.dev` (or custom domain if configured)
   - Fly.io automatically provides HTTPS

### Option 2: Docker Compose Deployment

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API key and production settings
   ```

2. **SSL Certificates (Required for microphone access)**
   ```bash
   # Option 1: Let's Encrypt (recommended)
   sudo certbot certonly --standalone -d your-domain.com

   # Option 2: Copy existing certificates
   mkdir -p nginx/ssl
   cp /path/to/cert.pem nginx/ssl/
   cp /path/to/key.pem nginx/ssl/
   ```

3. **Deploy Production**
   ```bash
   ./deploy.sh prod
   ```

4. **Access**
   - HTTPS: https://your-domain.com
   - HTTP redirects to HTTPS automatically

## 📋 Features

- 🎤 **Real-time voice input** - Continuous speech recognition
- 🔊 **AI voice responses** - Natural audio synthesis
- 🌍 **Bilingual support** - Automatic Russian/English detection
- 🌐 **WebRTC integration** - Low-latency browser audio
- 🐳 **Docker deployment** - Containerized for easy hosting
- 🔒 **HTTPS security** - SSL/TLS encryption required
- 🏗️ **Production ready** - Nginx reverse proxy, health checks
- 🗣️ **Multiple personas** - Create custom chat characters with unique voices and images
- 🎨 **AI image generation** - Automatic avatar creation for new chats using Kie.ai

## 🏗️ Architecture

### Frontend (WebRTC)
- HTML5 Web Audio API for microphone access
- WebSocket connection for real-time streaming
- Audio visualization during recording
- Automatic audio playback of AI responses

### Backend (FastAPI)
- WebSocket endpoint for audio streaming
- Gemini Live API integration
- System instructions for bilingual communication
- Async task management for concurrent operations

### Infrastructure (Docker)
- Multi-stage container build
- Health checks and monitoring
- Nginx reverse proxy with SSL termination
- Volume mounting for logs and certificates

## 🔧 Configuration

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | - | **Required** - Your Gemini API key |
| `KIE_API_KEY` | - | **Optional** - Your Kie.ai API key for image generation |
| `PORT` | 8000 | Server port |
| `HOST` | 0.0.0.0 | Host binding |

### Model Settings (Code)
- Model: `models/gemini-2.5-flash-native-audio-preview-09-2025`
- Audio: 16kHz send, 24kHz receive
- Voice: "Zephyr" prebuilt voice
- Context compression: Enabled

## 🐛 Troubleshooting

### Microphone Access Issues
- **HTTPS required**: Microphone access only works over HTTPS in production
- **Permissions**: Grant microphone permission when prompted
- **Browser support**: Modern Chrome/Firefox recommended

### Connection Problems
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart audio-chat
```

### API Key Issues
- Verify key in `.env` file
- Check Gemini API key format (should start with `AIzaSy...`)
- Ensure key has sufficient quota

## 🛠️ Development

### Local Development (without Docker)
```bash
# Install dependencies
pip install -r requirements.txt

# Set API key
export GEMINI_API_KEY=your_key

# Run server
python server.py

# Access at http://localhost:8000
```

### Testing Audio
1. Open browser console during chat
2. Check for WebRTC connection errors
3. Verify audio stream data flow

## 📊 Monitoring

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f audio-chat
```

### Performance
- Audio latency: ~100-200ms
- WebRTC streaming: 16kHz PCM
- Container memory: ~200-300MB

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Test with both local and Docker deployments
4. Submit pull request

## 📄 License

Built with Gemini Live API and FastAPI.

## 🌟 Russian Translation

Это веб-приложение для голосового чата с ИИ в реальном времени. Поддерживает русский и английский языки. Использует WebRTC для низкой задержки и Docker для легкого развертывания.

**Функции:**
- Голосовой ввод в реальном времени
- Автоматическое переключение между русским/английским
- Синтез речи AI с природными голосами
- Полностью контейнеризованная архитектура
