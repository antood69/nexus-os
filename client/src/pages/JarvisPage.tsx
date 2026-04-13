import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type VoiceModel = { id: string; name: string; description: string; isDefault?: boolean };
type ChatMessage = { role: "user" | "assistant"; content: string; timestamp: string };

export default function JarvisPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [selectedVoice, setSelectedVoice] = useState("jarvis");
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(24).fill(4));
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: voices = [] } = useQuery<VoiceModel[]>({ queryKey: ["/api/jarvis/voices"] });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Waveform animation
  useEffect(() => {
    if (status === "listening" || status === "speaking") {
      const animate = () => {
        const analyser = analyserRef.current;
        if (analyser) {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          const bars = Array.from({ length: 24 }, (_, i) => {
            const idx = Math.floor((i / 24) * data.length);
            return 4 + (data[idx] / 255) * 40;
          });
          setWaveHeights(bars);
        } else {
          setWaveHeights(Array.from({ length: 24 }, (_, i) =>
            12 + Math.sin(Date.now() / 200 + i * 0.5) * 20 + Math.random() * 10
          ));
        }
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
      return () => cancelAnimationFrame(animFrameRef.current);
    } else if (status === "processing") {
      const animate = () => {
        setWaveHeights(Array.from({ length: 24 }, (_, i) =>
          8 + Math.sin(Date.now() / 300 + i * 0.8) * 12
        ));
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
      return () => cancelAnimationFrame(animFrameRef.current);
    } else {
      setWaveHeights(Array(24).fill(4));
    }
  }, [status]);

  // TTS: play audio from response text
  const playTTS = useCallback(async (text: string) => {
    if (!ttsEnabled) return;
    try {
      setStatus("speaking");
      const res = await apiRequest("POST", "/api/jarvis/tts", { text, voice: selectedVoice });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("audio")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        // Connect to analyser for waveform
        try {
          const ctx = new AudioContext();
          const source = ctx.createMediaElementSource(audio);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyser.connect(ctx.destination);
          analyserRef.current = analyser;
        } catch {}

        audio.onended = () => { setStatus("idle"); analyserRef.current = null; URL.revokeObjectURL(url); };
        audio.onerror = () => { setStatus("idle"); URL.revokeObjectURL(url); };
        await audio.play();
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
    }
  }, [selectedVoice, ttsEnabled]);

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      setStatus("processing");
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/jarvis/chat", { message: text, history });
      return res.json();
    },
    onSuccess: (data) => {
      const reply = data.reply || "I couldn't process that.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date().toISOString() }]);
      playTTS(reply);
    },
    onError: () => setStatus("idle"),
  });

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: input.trim(), timestamp: new Date().toISOString() }]);
    sendMessage.mutate(input.trim());
    setInput("");
  };

  // Push-to-talk with MediaRecorder
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsListening(true);
      setStatus("listening");
      audioChunksRef.current = [];

      // Set up analyser for waveform
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch {}

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        analyserRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) { setStatus("idle"); return; }

        setStatus("processing");
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const b64 = (reader.result as string).split(",")[1];
              resolve(b64);
            };
            reader.readAsDataURL(blob);
          });

          const res = await apiRequest("POST", "/api/jarvis/stt", { audio: base64 });
          const data = await res.json();
          if (data.transcript) {
            setMessages(prev => [...prev, { role: "user", content: data.transcript, timestamp: new Date().toISOString() }]);
            sendMessage.mutate(data.transcript);
          } else {
            setStatus("idle");
          }
        } catch {
          setStatus("idle");
        }
      };

      mediaRecorder.start();
    } catch {
      setIsListening(false);
      setStatus("idle");
    }
  }, [sendMessage, messages]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Jarvis</h1>
            <p className="text-xs text-muted-foreground">Voice-powered AI assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`p-2 rounded-md transition-colors ${ttsEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
            title={ttsEnabled ? "TTS On" : "TTS Off"}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <select
            className="px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground"
            value={selectedVoice}
            onChange={e => setSelectedVoice(e.target.value)}
          >
            {voices.map(v => (
              <option key={v.id} value={v.id}>{v.name} — {v.description}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Voice Waveform Visualization */}
      <div className="flex items-center justify-center py-8 shrink-0">
        <div className="flex items-center gap-1">
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                status === "listening" || status === "speaking"
                  ? "bg-primary"
                  : status === "processing"
                  ? "bg-yellow-400"
                  : "bg-muted-foreground/20"
              }`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="text-center text-sm text-muted-foreground pb-4 shrink-0">
        {status === "idle" && "Ready"}
        {status === "listening" && (
          <span className="text-primary animate-pulse">Listening... (release to send)</span>
        )}
        {status === "processing" && (
          <span className="text-yellow-400 animate-pulse">Processing...</span>
        )}
        {status === "speaking" && (
          <span className="text-emerald-400 animate-pulse">Speaking...</span>
        )}
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-6 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Volume2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Hey, I'm Jarvis.</p>
            <p className="text-sm mt-1">Press the mic button or type a message to get started.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Push-to-Talk + Text Input */}
      <div className="px-6 py-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3">
          <button
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onTouchStart={startListening}
            onTouchEnd={stopListening}
            onClick={(e) => {
              // For click fallback (toggle mode)
              if (!("ontouchstart" in window)) {
                e.preventDefault();
                toggleListening();
              }
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
              isListening
                ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30"
                : "bg-primary/20 text-primary hover:bg-primary/30"
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <div className="flex-1 flex gap-2">
            <input
              className="flex-1 px-4 py-2.5 bg-background border border-border rounded-full text-sm text-foreground"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              disabled={status === "processing"}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || status === "processing"}
              className="rounded-full w-10 h-10 p-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          from { transform: scaleY(0.6); }
          to { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  );
}
