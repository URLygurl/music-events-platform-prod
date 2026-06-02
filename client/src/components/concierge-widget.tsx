/**
 * AI Festival Concierge Widget
 * A floating minimised circle that expands into a chat panel.
 * Matches the site's primary brand colour.
 * Shows a trivia badge notification at the configured interval.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { X, MessageCircle, Send, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConciergePublicSettings {
  enabled: boolean;
  publicAccess: boolean;
  name: string;
  triviaFrequencyMins: number;
  hasApiKey: boolean;
}

export function ConciergeWidget() {
  const { get } = useSettings();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [triviaReady, setTriviaReady] = useState(false);
  const [triviaMessage, setTriviaMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const triviaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const primaryColor = get("global_primary_color", "#000000");
  const accentColor = get("global_accent_color", "#666666");

  // Fetch concierge public settings
  const { data: conciergeSettings } = useQuery<ConciergePublicSettings>({
    queryKey: ["/api/concierge/settings"],
    staleTime: 60000,
  });

  // Fetch trivia
  const triviaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/concierge/trivia", {});
      return res.json();
    },
    onSuccess: (data) => {
      setTriviaMessage(data.trivia || "");
      setTriviaReady(true);
    },
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (msgs: Message[]) => {
      const res = await apiRequest("POST", "/api/concierge/chat", { messages: msgs });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: (error: any) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: error.message || "Sorry, I couldn't process that. Please try again." },
      ]);
    },
  });

  // Set up trivia timer
  const scheduleTrivia = useCallback(() => {
    if (triviaTimerRef.current) clearTimeout(triviaTimerRef.current);
    const mins = conciergeSettings?.triviaFrequencyMins ?? 60;
    triviaTimerRef.current = setTimeout(() => {
      triviaMutation.mutate();
    }, mins * 60 * 1000);
  }, [conciergeSettings?.triviaFrequencyMins]);

  useEffect(() => {
    if (conciergeSettings?.enabled && conciergeSettings?.hasApiKey) {
      scheduleTrivia();
    }
    return () => {
      if (triviaTimerRef.current) clearTimeout(triviaTimerRef.current);
    };
  }, [conciergeSettings, scheduleTrivia]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Show welcome message when first opened
  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      const name = conciergeSettings?.name || "your festival concierge";
      const welcome = triviaReady && triviaMessage
        ? `Hey! I'm ${name} 🎵\n\nHere's a fun fact to kick things off:\n\n${triviaMessage}\n\nHow can I help you today?`
        : `Hey! I'm ${name} 🎵 Ask me anything about the artists, the venue, local tips, or just chat music!`;
      setMessages([{ role: "assistant", content: welcome }]);
      if (triviaReady) {
        setTriviaReady(false);
        setTriviaMessage("");
        scheduleTrivia();
      }
    }
  };

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    chatMutation.mutate(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render if not enabled or no API key
  if (!conciergeSettings?.enabled || !conciergeSettings?.hasApiKey) return null;

  // Don't render if not public and user not logged in
  if (!conciergeSettings.publicAccess && !user) return null;

  const concierge_name = conciergeSettings.name || "Concierge";

  return (
    <>
      {/* Floating circle button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ backgroundColor: primaryColor }}
          aria-label={`Open ${concierge_name}`}
          data-testid="concierge-open-button"
        >
          <MessageCircle className="w-5 h-5 text-white" />
          {/* Trivia badge */}
          {triviaReady && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: accentColor, fontSize: "9px" }}
            >
              <Sparkles className="w-2.5 h-2.5" />
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 z-50 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "480px", backgroundColor: "var(--background)", border: `1px solid ${primaryColor}33` }}
          data-testid="concierge-panel"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{concierge_name}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close concierge"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-3"
            style={{ minHeight: "200px", maxHeight: "320px" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap`}
                  style={
                    msg.role === "user"
                      ? { backgroundColor: primaryColor, color: "white" }
                      : { backgroundColor: "var(--muted)", color: "var(--foreground)" }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--muted)" }}
                >
                  <span className="animate-pulse">...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-3 border-t border-border flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="flex-1 resize-none text-sm min-h-[36px] max-h-[80px]"
              rows={1}
              data-testid="concierge-input"
            />
            <Button
              size="icon"
              className="flex-shrink-0 w-9 h-9"
              style={{ backgroundColor: primaryColor }}
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              data-testid="concierge-send"
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
