import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mic, MicOff, Send, Volume2 } from "lucide-react";
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: voices = [] } = useQuery<VoiceModel[]>({ queryKey: ["/api/jarvis/voices"] });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      setStatus("processing");
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/jarvis/chat", { message: text, history });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, timestamp: new Date().toISOString() }]);
      setStatus("idle");
    },
    onError: () => setStatus("idle"),
  });

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: input.trim(), timestamp: new Date().toISOString() }]);
    sendMessage.mutate(input.trim());
    setInput("");
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      setStatus("idle");
    } else {
      setIsListening(true);
      setStatus("listening");
      // Placeholder: real STT integration would go here
      setTimeout(() => {
        setIsListening(false);
        setStatus("idle");
      }, 3000);
    }
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

      {/* Voice Waveform Visualization */}
      <div className="flex items-center justify-center py-8 shrink-0">
        <div className="flex items-center gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                status === "listening" || status === "speaking"
                  ? "bg-primary"
                  : status === "processing"
                  ? "bg-yellow-400"
                  : "bg-muted-foreground/20"
              }`}
              style={{
                height: status === "listening" || status === "speaking"
                  ? `${12 + Math.sin(Date.now() / 200 + i * 0.5) * 20 + Math.random() * 10}px`
                  : status === "processing"
                  ? `${8 + Math.sin(Date.now() / 300 + i * 0.8) * 12}px`
                  : "4px",
                animation: (status === "listening" || status === "speaking") ? `pulse 0.5s ease-in-out ${i * 0.05}s infinite alternate` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="text-center text-sm text-muted-foreground pb-4 shrink-0">
        {status === "idle" && "Ready"}
        {status === "listening" && (
          <span className="text-primary animate-pulse">Listening...</span>
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
            onClick={toggleListening}
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
