import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

// Mock data - in production this would come from an API
import partnerCoach from "@/assets/partner-coach.jpg";
import partnerMeditation from "@/assets/partner-meditation.jpg";
import partnerTherapist from "@/assets/partner-therapist.jpg";
import partnerArtist from "@/assets/partner-artist.jpg";

const mockPartners: Record<string, { name: string; description: string; image: string }> = {
  "1": {
    name: "Sarah",
    description: "A warm life coach focused on career growth and work-life balance",
    image: partnerCoach,
  },
  "2": {
    name: "Marcus",
    description: "A calm meditation instructor specializing in mindfulness and stress relief",
    image: partnerMeditation,
  },
  "3": {
    name: "Dr. James",
    description: "A wise therapist offering guidance on personal relationships and emotional well-being",
    image: partnerTherapist,
  },
  "4": {
    name: "Luna",
    description: "A creative artist who helps explore imagination and self-expression",
    image: partnerArtist,
  },
};

type CallState = "idle" | "listening" | "speaking";

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isCallActive, setIsCallActive] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [partner, setPartner] = useState<{ prompt: string; voice: string; image: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const [audioData, setAudioData] = useState<number[]>([]);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);


  useEffect(() => {
    loadChat();
  }, [id]);

  useEffect(() => {
    let animationId: number;
    if (isCallActive && analyserNode && dataArrayRef.current) {
      const updateAudioData = () => {
        analyserNode.getByteTimeDomainData(dataArrayRef.current!);
        const data = Array.from(dataArrayRef.current!);
        setAudioData(data);
        animationId = requestAnimationFrame(updateAudioData);
      };
      updateAudioData();
    }
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isCallActive, analyserNode]);

  const loadChat = async () => {
    if (!id) return;
    try {
      const chats = await api.getChats();
      const chat = chats[id];
      if (chat) {
        setPartner({
          prompt: chat.prompt,
          voice: chat.voice,
          image: chat.image_url || '/static/placeholder.svg',
        });
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNameFromPrompt = (prompt: string): string => {
    const firstSentence = prompt.split('.')[0];
    return firstSentence.length > 20 ? firstSentence.substring(0, 20) + '...' : firstSentence;
  };

  const handleStartCall = useCallback(async () => {
    if (!id) return;

    try {
      // Resume audio context if suspended (required for autoplay policy)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('AudioContext resumed before call');
      }

      // Connect to WebSocket (use relative URL for proxy)
      const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        // Send initialize message
        ws.send(JSON.stringify({ type: 'initialize', chat_id: id }));
        setIsCallActive(true);
        setCallState("listening");
        // Start recording after WS is open
        setTimeout(startRecording, 100); // Small delay to ensure WS is ready
      };

      ws.onmessage = (event) => {
        console.log('Received WebSocket message, length:', event.data.length);
        try {
          const data = JSON.parse(event.data);
          console.log('Parsed data type:', data.type);
          if (data.type === 'audio') {
            // Handle incoming audio
            const audioData = atob(data.data);
            console.log('Decoded audio data length:', audioData.length);
            queueAudio(audioData);
            setCallState("speaking");
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.log('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed, code:', event.code, 'reason:', event.reason);
        setIsCallActive(false);
        setCallState("idle");
      };

    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }, [id]);



  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('Got media stream');

      // Create audio context and analyser
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('AudioContext created, sample rate:', audioContextRef.current.sampleRate);
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('AudioContext resumed');
      }

      // Load AudioWorklet
      await audioContextRef.current.audioWorklet.addModule('/audio-worklet.js');
      console.log('AudioWorklet loaded');

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.fftSize);
      setAnalyserNode(analyser);

      // Create AudioWorkletNode for PCM capture
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (event) => {
        // Don't send audio if muted
        if (isMuted) return;

        const pcm = new Int16Array(event.data);
        // Send to server - convert Int16Array to base64
        const uint8Array = new Uint8Array(pcm.buffer);
        const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
        console.log('Sending audio data, length:', pcm.length, 'at 16kHz');
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);
      console.log('Recording setup complete');

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const createAudioBuffer = (audioData: string): AudioBuffer | null => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const sampleCount = audioData.length / 2; // 16-bit samples
      const audioBuffer = audioContextRef.current.createBuffer(1, sampleCount, 24000);
      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(new ArrayBuffer(audioData.length));
      for (let i = 0; i < audioData.length; i++) {
        dataView.setUint8(i, audioData.charCodeAt(i));
      }
      const int16Array = new Int16Array(dataView.buffer);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768;
      }
      return audioBuffer;
    } catch (error) {
      console.error('Failed to create audio buffer:', error);
      return null;
    }
  };

  const playNextAudio = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    const buffer = audioQueueRef.current.shift();
    if (buffer) {
      try {
        if (audioContextRef.current!.state === 'suspended') {
          await audioContextRef.current!.resume();
        }
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current!.destination);

        source.onended = () => {
          isPlayingRef.current = false;
          playNextAudio(); // Play next in queue
        };

        source.start();
        console.log('Started playing audio buffer');
      } catch (error) {
        console.error('Failed to play audio:', error);
        isPlayingRef.current = false;
        playNextAudio(); // Try next
      }
    }
  };

  const queueAudio = async (audioData: string) => {
    console.log('Queueing audio data length:', audioData.length);
    const buffer = createAudioBuffer(audioData);
    if (buffer) {
      audioQueueRef.current.push(buffer);
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    }
  };

  const handleEndCall = useCallback(() => {
    // Send stop message to AudioWorklet first
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage('stop');
    }

    if (wsRef.current) {
      wsRef.current.close();
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsCallActive(false);
    setCallState("idle");
  }, []);

  if (!partner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Partner not found</h1>
          <Button variant="link" onClick={() => navigate("/")}>
            Go back home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal Header */}
      <header className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1" />
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
        {/* Partner Image */}
        <div className="relative mb-8">
          <div
            className={`h-40 w-40 overflow-hidden rounded-full shadow-elevated transition-all duration-500 sm:h-48 sm:w-48 ${
              isCallActive ? "ring-4 ring-primary/30 animate-audio-pulse" : ""
            }`}
          >
            <img
              src={partner.image}
              alt={getNameFromPrompt(partner.prompt)}
              className="h-full w-full object-cover"
            />
          </div>
          
          {/* Status Indicator */}
          {isCallActive && (
            <div
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium ${
                callState === "speaking"
                  ? "bg-audio-speaking text-primary-foreground"
                  : "bg-audio-listening text-primary-foreground"
              }`}
            >
              {callState === "speaking" ? "Speaking" : "Listening"}
            </div>
          )}
        </div>

        {/* Partner Info */}
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{getNameFromPrompt(partner.prompt)}</h1>
        <p className="mt-2 max-w-sm text-center text-muted-foreground">{partner.prompt}</p>

        {/* Audio Visualizer */}
        <div className="my-8 h-16">
          <AudioVisualizer isActive={isCallActive} state={callState} data={audioData} sensitivity={1.0} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {!isCallActive ? (
            <Button
              variant="audioStart"
              size="iconXl"
              onClick={handleStartCall}
              className="animate-fade-in-up"
            >
              <Mic className="h-8 w-8" />
            </Button>
          ) : (
            <>
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="iconLg"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
              <Button
                variant="audioEnd"
                size="iconXl"
                onClick={handleEndCall}
              >
                <Phone className="h-8 w-8 rotate-[135deg]" />
              </Button>
            </>
          )}
        </div>

        {/* Hint Text */}
        {!isCallActive && (
          <p className="mt-6 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            Tap to start your voice conversation
          </p>
        )}
      </main>
    </div>
  );
}
