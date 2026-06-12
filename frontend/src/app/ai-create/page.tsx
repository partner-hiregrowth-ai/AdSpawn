"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { aiCreateApi, uploadApi } from "@/services/api";
import { extractApiError } from "@/lib/utils";
import Link from "next/link";
import {
  Sparkles, Send, Loader2, AlertTriangle, CheckCircle2, Plus, X, Image as ImageIcon, Video, FileText
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GenerationResult {
  totalCreated: { campaigns: number; adSets: number; ads: number };
  warnings: string[];
}

interface FileAttachment {
  id: string;
  file: File;
  type: 'image' | 'video' | 'file';
  status: 'uploading' | 'ready' | 'error';
  url: string;
  metaId?: string; // hash for images, id for videos
  error?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  generationResult?: GenerationResult;
  isError?: boolean;
  attachments?: FileAttachment[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilePreview({ attachment, onRemove }: { attachment: FileAttachment, onRemove: (id: string) => void }) {
  const isImage = attachment.type === 'image';
  const isVideo = attachment.type === 'video';

  return (
    <div className="relative group w-20 h-20 bg-gray-900 border border-gray-700/60 rounded-xl overflow-hidden shrink-0">
      {attachment.status === 'uploading' && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
        </div>
      )}
      {attachment.status === 'error' && (
        <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center z-10" title={attachment.error}>
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
      )}
      
      {isImage ? (
        <img src={attachment.url} alt="preview" className="w-full h-full object-cover" />
      ) : isVideo ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-violet-500/10">
          <Video className="w-6 h-6 text-violet-400" />
          <span className="text-[9px] text-violet-400 font-medium mt-1 uppercase">Video</span>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
      )}

      <button
        onClick={() => onRemove(attachment.id)}
        className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function LoadingDots() {
// ... existing LoadingDots component
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
      <div className="flex flex-col items-end gap-2">
        <div className="max-w-[80%] px-4 py-2.5 bg-blue-600/20 text-gray-100 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
          {msg.content}
        </div>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 max-w-[80%]">
            {msg.attachments.map((att) => (
              <div key={att.id} className="relative w-24 h-24 bg-gray-900 border border-gray-700/60 rounded-xl overflow-hidden shadow-sm">
                {att.type === 'image' ? (
                  <img src={att.url} alt="upload" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-violet-500/10">
                    <Video className="w-6 h-6 text-violet-400" />
                    <span className="text-[9px] text-violet-400 font-medium mt-1 uppercase">Video</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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

// ─── Example prompts ─────────────────────────────────────────────────────────

const EXAMPLES = [
  'Traffic campaign "Website Visits July", 500 baht/day, 2 ad sets, 2 ads each',
  'Sales campaign "Checkout Push", pixel ID 123456789, 1,000 baht/day, 3 ad sets',
  'App installs "Get the App", app ID 987654321, store URL https://apps.apple.com/app/id987654321, 800 baht/day',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Hi! Tell me what campaign you want and I'll create the drafts in one shot.

Include: goal · name · budget (THB/day) · ad sets · ads · creative ID (optional)
Sales needs pixel ID · Leads needs page ID · App needs app ID + store URL

Unspecified fields default to: 1 campaign, 1 ad set, 1 ad, 300 THB/day, Thailand.`,
};

export default function AiCreatePage() {
  const { selectedAccount } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileAttachment[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const { selectedAccount } = useAppStore.getState();
    if (!selectedAccount) return;

    const newAttachments: FileAttachment[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
      status: 'uploading',
      url: URL.createObjectURL(file),
    }));

    setSelectedFiles(prev => [...prev, ...newAttachments]);

    // Reset input so the same file can be selected again
    e.target.value = '';

    // Trigger uploads
    for (const att of newAttachments) {
      try {
        let res;
        if (att.type === 'image') {
          res = await uploadApi.uploadImage(att.file, selectedAccount.adaccount_id || selectedAccount.id);
          const hash = res.data.hash || res.data.id;
          setSelectedFiles(prev => prev.map(f => f.id === att.id ? { ...f, status: 'ready', metaId: hash } : f));
        } else if (att.type === 'video') {
          res = await uploadApi.uploadVideo(att.file, selectedAccount.adaccount_id || selectedAccount.id);
          const videoId = res.data.videoId;
          setSelectedFiles(prev => prev.map(f => f.id === att.id ? { ...f, status: 'ready', metaId: videoId } : f));
        } else {
          setSelectedFiles(prev => prev.map(f => f.id === att.id ? { ...f, status: 'error', error: 'Unsupported file type' } : f));
        }
      } catch (err: any) {
        const msg = extractApiError(err, "Upload failed");
        setSelectedFiles(prev => prev.map(f => f.id === att.id ? { ...f, status: 'error', error: msg } : f));
      }
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return filtered;
    });
  };

  const focusChip = (idx: number) => {
    const el = chipRefs.current[idx];
    if (!el) return;
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const readyAttachments = selectedFiles.filter(f => f.status === 'ready' && f.metaId);
    if ((!text && readyAttachments.length === 0) || isLoading) return;
    // Files still uploading would be silently dropped — the send button is
    // disabled while uploads are in flight; this is just a race guard.
    if (selectedFiles.some(f => f.status === 'uploading')) return;

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

    // Build final message content with attachment info
    let finalContent = text;

    if (readyAttachments.length > 0) {
      const attachmentContext = readyAttachments.map(f =>
        f.type === 'image' ? `(Uploaded Image Hash: ${f.metaId})` : `(Uploaded Video ID: ${f.metaId})`
      ).join(' ');
      // INJECT AS A NATURAL STATEMENT
      finalContent = `I have uploaded these assets for you to use: ${attachmentContext}. \n\n${text || "Use these assets in the ad creatives."}`;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text || "Sent attachments", // Show the original text in UI
      attachments: [...selectedFiles]
    };
    const loadingId = crypto.randomUUID();
    const loadingMsg: Message = { id: loadingId, role: "assistant", content: "", isLoading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    setSelectedFiles([]); // Clear after sending
    setIsLoading(true);

    // Build API payload: filter out loading bubbles, keep last 10 conversation turns
    const apiMessages = [...messages.filter(m => !m.isLoading), { ...userMsg, content: finalContent }]
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
  }, [input, isLoading, messages, selectedAccount, selectedFiles]);


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "ArrowDown" && messages.length === 1 && chipRefs.current[0]) {
      e.preventDefault();
      focusChip(0);
    }
  };

  const handleChipKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number, ex: string) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < EXAMPLES.length - 1) focusChip(idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) {
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        focusChip(idx - 1);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setInput(ex);
      textareaRef.current?.focus();
    } else if (e.key === "Escape") {
      textareaRef.current?.focus();
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

        {/* Example chips — only shown before the user has typed anything */}
        {messages.length === 1 && !isLoading && (
          <div className="shrink-0 pb-3">
            <p className="text-[11px] text-gray-600 mb-2">Try an example <span className="text-gray-700">(↑↓ to navigate, Enter to select)</span>:</p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((ex, idx) => (
                <button
                  key={ex}
                  ref={el => { chipRefs.current[idx] = el; }}
                  onClick={() => { setInput(ex); textareaRef.current?.focus(); }}
                  onKeyDown={e => handleChipKeyDown(e, idx, ex)}
                  className="text-[11px] text-gray-400 bg-gray-800/60 hover:bg-gray-700/60 focus:bg-gray-700/60 border border-gray-700/50 hover:border-gray-600/50 focus:border-violet-500/50 focus:outline-none rounded-lg px-3 py-2 transition-colors text-left"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 pt-4 border-t border-gray-800/60">
          {selectedFiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
              {selectedFiles.map(file => (
                <FilePreview key={file.id} attachment={file} onRemove={removeFile} />
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,video/*"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              size="icon"
              variant="outline"
              className="h-11 w-11 shrink-0 bg-gray-900 border-gray-700/60 hover:bg-gray-800 text-gray-400 rounded-xl"
              aria-label="Attach file"
            >
              <Plus className="w-5 h-5" />
            </Button>

            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Describe your campaign — goal, name, budget, ad sets…"
              className="flex-1 bg-gray-900 border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 resize-none outline-none focus:border-gray-600 transition-colors disabled:opacity-50"
            />
            <Button
              onClick={sendMessage}
              disabled={
                isLoading ||
                selectedFiles.some(f => f.status === 'uploading') ||
                (!input.trim() && selectedFiles.filter(f => f.status === 'ready').length === 0)
              }
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
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-gray-600">
              {selectedFiles.length > 0 && `${selectedFiles.length} file(s) attached`}
            </p>
            <kbd className="text-[10px] text-gray-600 bg-gray-800/60 border border-gray-700/50 rounded px-1.5 py-0.5 font-mono whitespace-nowrap shrink-0">
              Ctrl+K to navigate
            </kbd>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
