"use client";

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeDisplayName } from "@/utils/name";

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar: string | null;
  content: string;
  createdAt: string;
}

interface Props {
  matchId: string;
  currentUserId: string | null;
  currentUserName: string;
  currentUserAvatar: string | null;
  initialMessages: ChatMessage[];
}

function initials(name: string) {
  if (name.includes("@")) return name[0].toUpperCase();
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")
  ).toUpperCase() || "?";
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function mergeMessages(server: ChatMessage[], local: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const msg of server) byId.set(msg.id, msg);
  for (const msg of local) {
    if (msg.id.startsWith("temp_")) {
      const duplicate = [...byId.values()].some(
        (m) =>
          m.playerId === msg.playerId &&
          m.content === msg.content &&
          Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) <
            60_000,
      );
      if (!duplicate) byId.set(msg.id, msg);
      continue;
    }
    if (!byId.has(msg.id)) byId.set(msg.id, msg);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function MatchChat({
  matchId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  initialMessages,
}: Props) {
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messages = useMemo(
    () => mergeMessages(initialMessages, localMessages),
    [initialMessages, localMessages],
  );
  const [text, setText] = useState("");
  const [sending, startSending] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setLocalMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) {
        return prev.map((m) => (m.id === msg.id ? msg : m));
      }
      const withoutTemp = prev.filter(
        (m) =>
          !(
            m.id.startsWith("temp_") &&
            m.playerId === msg.playerId &&
            m.content === msg.content
          ),
      );
      return [...withoutTemp, msg];
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`match_chat_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            player_id: string;
            content: string;
            created_at: string;
          };

          const isMe = row.player_id === currentUserId;
          const base: ChatMessage = {
            id: row.id,
            playerId: row.player_id,
            playerName: isMe ? currentUserName : "Jugador",
            playerAvatar: isMe ? currentUserAvatar : null,
            content: row.content,
            createdAt: row.created_at,
          };
          appendMessage(base);

          if (!isMe) {
            void supabase
              .from("match_messages")
              .select("id, profiles(full_name, avatar_url)")
              .eq("id", row.id)
              .maybeSingle()
              .then(({ data }) => {
                if (!data) return;
                const p = Array.isArray(data.profiles)
                  ? data.profiles[0]
                  : data.profiles;
                appendMessage({
                  ...base,
                  playerName: sanitizeDisplayName(
                    (p as { full_name?: string } | null)?.full_name ?? "Jugador",
                    "Jugador",
                  ),
                  playerAvatar:
                    (p as { avatar_url?: string | null } | null)?.avatar_url ?? null,
                });
              });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    matchId,
    supabase,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    appendMessage,
  ]);

  function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || !currentUserId || sending) return;

    const tempId = `temp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      playerId: currentUserId,
      playerName: currentUserName,
      playerAvatar: currentUserAvatar,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimistic]);
    setText("");
    setSendError(null);

    startSending(async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        });
        const json = (await res.json()) as {
          message?: ChatMessage;
          error?: string;
        };

        if (!res.ok || !json.message) {
          setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
          setText(trimmed);
          setSendError(json.error ?? "No se pudo enviar. Intenta de nuevo.");
          return;
        }

        setLocalMessages((prev) =>
          prev.map((m) => (m.id === tempId ? json.message! : m)),
        );
      } catch {
        setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
        setText(trimmed);
        setSendError("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
      }
    });

    inputRef.current?.focus();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          maxHeight: "320px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          paddingBottom: "0.875rem",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
      >
        {messages.length === 0 && (
          <p
            style={{
              color: "var(--text-3)",
              fontSize: "0.82rem",
              textAlign: "center",
              padding: "1.5rem 0",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Sin mensajes aún. ¡Saluda al grupo!
          </p>
        )}

        {messages.map((msg) => {
          const isMe = msg.playerId === currentUserId;
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "0.5rem",
                flexDirection: isMe ? "row-reverse" : "row",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  flexShrink: 0,
                  overflow: "hidden",
                  position: "relative",
                  background: isMe ? "var(--primary)" : "var(--surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  color: isMe ? "#ffffff" : "var(--text-2)",
                }}
              >
                {msg.playerAvatar ? (
                  <Image
                    src={msg.playerAvatar}
                    alt={msg.playerName}
                    fill
                    sizes="28px"
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  initials(msg.playerName)
                )}
              </div>

              <div
                style={{
                  maxWidth: "72%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  alignItems: isMe ? "flex-end" : "flex-start",
                }}
              >
                {!isMe && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-3)",
                      fontFamily: "var(--font-dm-sans)",
                      paddingLeft: "0.25rem",
                    }}
                  >
                    {msg.playerName.split(" ")[0]}
                  </span>
                )}
                <div
                  style={{
                    background: isMe ? "var(--primary)" : "var(--surface)",
                    color: isMe ? "#ffffff" : "var(--text)",
                    borderRadius: isMe
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                    padding: "0.45rem 0.8rem",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-dm-sans)",
                    lineHeight: 1.45,
                    wordBreak: "break-word",
                    border: isMe ? "none" : "1px solid var(--border)",
                  }}
                >
                  {msg.content}
                </div>
                <span
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-3)",
                    paddingLeft: isMe ? 0 : "0.25rem",
                    paddingRight: isMe ? "0.25rem" : 0,
                  }}
                >
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {currentUserId ? (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <input
            ref={inputRef}
            className="input-base"
            placeholder="Escribe un mensaje..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={sending}
            style={{ flex: 1, fontSize: "0.875rem" }}
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !text.trim()}
            style={{
              background: text.trim() && !sending ? "var(--primary)" : "var(--surface)",
              border: "1px solid var(--border)",
              color: text.trim() && !sending ? "#ffffff" : "var(--text-3)",
              borderRadius: "10px",
              padding: "0 0.875rem",
              cursor: sending || !text.trim() ? "not-allowed" : "pointer",
              transition: "background 0.12s, color 0.12s",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "38px",
              width: "44px",
            }}
          >
            <SendIcon />
          </button>
        </div>
      ) : (
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-3)",
            textAlign: "center",
            padding: "0.5rem 0",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Inicia sesión para enviar mensajes.
        </p>
      )}

      {sendError && (
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--danger)",
            marginTop: "0.4rem",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {sendError}
        </p>
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  );
}
