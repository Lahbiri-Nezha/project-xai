"use client";

import TopBar from "@/components/dashboard/TopBar";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  rating?: number | null;
  streaming?: boolean;
}

type PersistedMessage = {
  id: string;
  role: string;
  content: string;
  rating: number | null;
};

function formatMessage(content: string): React.ReactNode[] {
  return content.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-bold text-foreground mt-2 mb-1">{line.replace(/\*\*/g, "")}</p>;
    }
    if (line.startsWith("- ")) {
      return <li key={i} className="text-text-secondary ml-4 list-disc text-sm">{line.slice(2)}</li>;
    }
    if (line.match(/^\d+\.\s/)) {
      return <li key={i} className="text-text-secondary ml-4 list-decimal text-sm">{line.replace(/^\d+\.\s/, "")}</li>;
    }
    return line.trim() ? <p key={i} className="text-text-secondary text-sm leading-relaxed">{line}</p> : null;
  });
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-lime-dark" />
      </div>
      <div className="bg-surface border border-border-default rounded-xl px-4 py-3 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-lime animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-lime animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-lime animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

export default function CopilotPage() {
  const t = useTranslations("copilot");
  const suggestions = [t("suggestion1"), t("suggestion2"), t("suggestion3"), t("suggestion4")];
  const welcomeMessage = t("welcome");
  const listChats = trpc.copilot.listChats.useQuery(undefined, { retry: false });
  const rateMessage = trpc.copilot.rateMessage.useMutation();

  const [chatIdOverride, setChatIdOverride] = useState<string | null>(null);
  const [ephemeral, setEphemeral] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeChatId = chatIdOverride ?? listChats.data?.[0]?.id ?? undefined;

  const history = trpc.copilot.getChat.useQuery(
    { chatId: activeChatId ?? "" },
    { enabled: !!activeChatId, retry: false }
  );
  const persisted = (history.data as unknown as {
    messages: PersistedMessage[];
  } | null)?.messages ?? [];

  const allMessages: Message[] = [
    ...persisted.map((m) => ({
      id: m.id,
      role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
      rating: m.rating,
    })),
    ...ephemeral,
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [persisted.length, ephemeral, loading]);

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text || input).trim();
      if (!content || loading) return;

      setEphemeral((prev) => [...prev, { role: "user", content }]);
      setInput("");
      setLoading(true);

      const assistantId = `stream-${Date.now()}`;
      setEphemeral((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);

      try {
        const res = await fetch("/api/copilot/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: activeChatId, content }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: t("unknownError") }));
          throw new Error(err.error ?? `${t("unknownError")} ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setEphemeral((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
          );
        }
        acc += decoder.decode();
        setEphemeral((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: acc, streaming: false } : m
          )
        );

        const refreshed = await listChats.refetch();
        const latest = refreshed.data?.[0];
        setChatIdOverride(latest?.id ?? null);
        setHydrated(true);
        setEphemeral([]);
        if (latest?.id) {
          history.refetch().catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("unknownError");
        setEphemeral((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: t("errorMsg", { msg }), streaming: false }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [activeChatId, input, loading, listChats, history, t, setInput]
  );

  const handleRating = async (message: Message, rating: number) => {
    if (!message.id || message.streaming) return;
    await rateMessage.mutateAsync({ messageId: message.id, rating }).catch(() => {});
    history.refetch().catch(() => {});
  };

  const showSuggestions = allMessages.length === 0 || (!hydrated && listChats.isLoading);

  return (
    <>
      <TopBar title={t("title")} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {allMessages.length === 0 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex gap-3"
              >
                <div className="h-8 w-8 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-lime-dark" />
                </div>
                <div className="max-w-[80%] rounded-xl px-4 py-3 bg-surface border border-border-default text-foreground">
                  <div className="space-y-1">{formatMessage(welcomeMessage)}</div>
                </div>
              </motion.div>
            )}
            {allMessages.map((msg, i) => (
              <motion.div
                key={msg.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-lime-dark" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-lime text-white"
                      : "bg-surface border border-border-default text-foreground"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : msg.content ? (
                    <>
                      <div className="space-y-1">{formatMessage(msg.content)}</div>
                      {!msg.streaming && msg.id && (
                        <div className="mt-3 flex items-center gap-1">
                          <button
                            onClick={() => handleRating(msg, 1)}
                            aria-label={t("rateHelpful")}
                            className={`p-1.5 rounded-md transition-colors ${
                              msg.rating === 1
                                ? "bg-lime/15 text-lime-dark"
                                : "hover:bg-surface-elevated text-text-muted"
                            }`}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRating(msg, -1)}
                            aria-label={t("rateNotHelpful")}
                            className={`p-1.5 rounded-md transition-colors ${
                              msg.rating === -1
                                ? "bg-red-500/15 text-red-500"
                                : "hover:bg-surface-elevated text-text-muted"
                            }`}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-text-muted text-sm">…</span>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-text-secondary" />
                  </div>
                )}
              </motion.div>
            ))}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-border-default bg-surface">
          {showSuggestions && (
            <div className="px-6 pt-3 pb-2 flex flex-wrap gap-2">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted mr-1">
                <Sparkles className="h-3 w-3" />
                {t("suggestions")}
              </div>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  disabled={loading}
                  className="text-xs bg-surface-elevated hover:bg-lime/10 text-text-secondary hover:text-lime-dark px-3 py-1.5 rounded-full border border-border-default transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={t("inputPlaceholder")}
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50 focus:border-lime"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="bg-lime hover:bg-lime-dark text-white font-semibold px-5 py-3 rounded-xl transition-all disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">{t("send")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
