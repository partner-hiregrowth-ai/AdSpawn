"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { aiCreateApi } from "@/services/api";
import { extractApiError } from "@/lib/utils";
import Link from "next/link";
import {
  Sparkles, Send, Loader2, AlertTriangle, CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GenerationResult {
  totalCreated: { campaigns: number; adSets: number; ads: number };
  warnings: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  generationResult?: GenerationResult;
  isError?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function GenerationCard({ result }: { result: GenerationResult }) {
  const { totalCreated, warnings } = result;
  return (
    <div className="mt-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
      <div className="flex items-center gap-2 text-emerald-400">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">
          Created {totalCreated.campaigns} campaign{totalCreated.campaigns !== 1 ? "s" : ""},&nbsp;
          {totalCreated.adSets} ad set{totalCreated.adSets !== 1 ? "s" : ""},&nbsp;
          {totalCreated.ads} ad{totalCreated.ads !== 1 ? "s" : ""}
        </span>
      </div>
      {warnings.length > 0 && (
        <ul className="text-[11px] text-amber-300/80 space-y-0.5 pl-6 list-disc">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
      <Link
        href="/drafts"
        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline mt-1"
      >
        View in Drafts →
      </Link>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 bg-blue-600/20 text-gray-100 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className={`max-w-[85%] px-4 py-2.5 bg-gray-900 border rounded-2xl rounded-tl-sm text-sm leading-relaxed ${msg.isError ? "border-red-800/40 text-red-300" : "border-gray-800 text-gray-200"}`}>
        {msg.isLoading ? (
          <LoadingDots />
        ) : (
          <>
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.generationResult && <GenerationCard result={msg.generationResult} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm AdSpawn AI. Tell me about the campaign you want to run — your goal, audience, and budget — and I'll set up the drafts for you.",
};

export default function AiCreatePage() {
  const { selectedAccount } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Guard: no account or profile selected
    const { selectedAccount, profile } = useAppStore.getState();
    if (!selectedAccount || !profile) {
      const errId = crypto.randomUUID();
      setMessages(prev => [...prev, {
        id: errId,
        role: "assistant",
        content: !selectedAccount 
          ? "Please select an ad account on the Account page first."
          : "Please select a profile first.",
        isError: true,
      }]);
      return;
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const loadingId = crypto.randomUUID();
    const loadingMsg: Message = { id: loadingId, role: "assistant", content: "", isLoading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    // Build API payload: filter out loading bubbles, keep last 10 conversation turns
    const apiMessages = [...messages, userMsg]
      .filter(m => !m.isLoading && (m.role === "user" || m.role === "assistant"))
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      .slice(-10);

    try {
      const res = await aiCreateApi.chat(
        apiMessages,
        selectedAccount.adaccount_id || selectedAccount.id,
      );
      const { reply, generationResult } = res.data;

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, isLoading: false, content: reply, generationResult }
          : m,
      ));
    } catch (err: any) {
      const errText = extractApiError(err, "Could not reach the server. Please try again.");
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, isLoading: false, content: errText, isError: true }
          : m,
      ));
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, isLoading, messages, selectedAccount]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col max-w-3xl mx-auto h-[calc(100vh-56px-4rem)]">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-violet-400" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-100">AI Campaign Creator</h1>
            <p className="text-sm text-gray-500">Describe your campaign in plain language</p>
          </div>
        </div>

        {/* No-account warning */}
        {!selectedAccount && (
          <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 mb-4 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">
              No ad account selected.{" "}
              <Link href="/dashboard" className="underline hover:text-amber-200">
                Select one on the Account page
              </Link>{" "}
              before creating campaigns.
            </p>
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 pt-4 border-t border-gray-800/60">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Describe your campaign goal…"
              className="flex-1 bg-gray-900 border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 resize-none outline-none focus:border-gray-600 transition-colors disabled:opacity-50"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-11 w-11 shrink-0 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg shadow-violet-600/20"
              aria-label="Send message"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </Button>
          </div>
          <p className="text-[10px] text-gray-700 mt-2 text-center">
            AI creates PAUSED drafts only. Add creative in the Drafts editor before publishing.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
