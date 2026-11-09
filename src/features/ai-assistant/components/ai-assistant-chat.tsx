"use client";

import * as React from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Copy,
  Check,
  Target,
  FileText,
  Lightbulb,
  Zap,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils/utils";
import type {
  AiAssistantMessage,
  AiAssistantPersona,
  AiAssistantResponse,
} from "@/lib/validation/ai-assistant-schemas";

interface AiAssistantChatProps {
  workspaceId: string;
  creatorName?: string;
  niche?: string;
  creditBalance: number;
}

const PERSONA_CONFIGS: Record<
  AiAssistantPersona,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  strategist: {
    label: "Creative Strategist",
    icon: Target,
    description: "Pilar konten, positioning diferensiasi, dan roadmap pertumbuhan",
  },
  hook_doctor: {
    label: "Hook Doctor",
    icon: Zap,
    description: "Bedah 3 detik pertama naskah & retensi penonton tinggi",
  },
  scriptwriter: {
    label: "Viral Scriptwriter",
    icon: FileText,
    description: "Naskah video pendek terstruktur (Hook -> Masalah -> Solusi -> CTA)",
  },
  algorithm_advisor: {
    label: "Algorithm Advisor",
    icon: Sparkles,
    description: "Waktu unggah, SEO pencarian media sosial, dan metrik interaksi",
  },
};

const SAMPLE_PROMPTS: Record<AiAssistantPersona, string[]> = {
  strategist: [
    "Bagaimana cara membagi 3 pilar konten utama saya agar tidak cepat kehabisan ide?",
    "Apa perbedaan positioning konten di TikTok vs Instagram Reels untuk niche saya?",
    "Bagaimana cara memvalidasi apakah ide konten ini layak dibuatkan video panjang?",
  ],
  hook_doctor: [
    "Ubah kalimat 'Halo guys di video ini aku mau jelasin...' jadi hook dengan retensi tinggi!",
    "Berikan 3 contoh hook kontras untuk video tips seputar niche saya",
    "Bagaimana cara menahan penonton agar tidak scroll di detik 0-3?",
  ],
  scriptwriter: [
    "Buatkan naskah 45 detik tentang kesalahan terbesar pemula di niche saya",
    "Bantu susun naskah storytelling dari pengalaman gagal menjadi sukses",
    "Tuliskan naskah edukasi padat dengan Call to Action ajakan komen diskusi",
  ],
  algorithm_advisor: [
    "Kapan jadwal jam posting terbaik untuk audiens Indonesia di hari kerja?",
    "Berapa jumlah hashtag yang ideal di TikTok dan bagaimana struktur SEO-nya?",
    "Apa yang harus dilakukan jika video stagnan di 200 views?",
  ],
};

export function AiAssistantChat({
  workspaceId,
  creatorName = "Kreator",
  niche = "Umum",
  creditBalance,
}: AiAssistantChatProps) {
  const [selectedPersona, setSelectedPersona] = React.useState<AiAssistantPersona>("strategist");
  const [inputText, setInputText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const initialGreeting: AiAssistantMessage = {
    id: "init",
    role: "assistant",
    content: `Halo ${creatorName}! Saya AI Assistant CreatorOS untuk ruang kerja Anda (Niche: ${niche}).

Pilih persona ahli di atas atau tanyakan apa saja seputar riset, naskah, strategi pilar, atau optimasi algoritma. Saya siap membantu Anda membuat konten konsisten dan berdampak!`,
    persona: "strategist",
    suggestedFollowUps: [
      "Bantu saya rancang 3 pilar konten utama",
      "Berikan 3 hook viral untuk video pertama",
      "Jadwal posting terbaik minggu ini",
    ],
    actionItems: [
      "Pilih salah satu persona spesialis di atas.",
      "Kirimkan draft ide atau pertanyaan spesifik naskah Anda.",
    ],
    timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  };

  const [messages, setMessages] = React.useState<AiAssistantMessage[]>([initialGreeting]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText ?? inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: AiAssistantMessage = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
      persona: selectedPersona,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInputText("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/workspace/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          message: textToSend.trim(),
          persona: selectedPersona,
          conversationHistory: messages.slice(-4),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghubungi AI Assistant");
      }

      const assistantReply: AiAssistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        persona: selectedPersona,
        suggestedFollowUps: data.suggestedFollowUps,
        actionItems: data.actionItems,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantReply]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Teks berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const PersonaIcon = PERSONA_CONFIGS[selectedPersona].icon;

  return (
    <div className="space-y-6">
      {/* 1. Header & Persona Mode Selector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Creator AI Assistant
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[11px] font-mono">
              1 Kredit / Chat
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Konsultasi strategi, evaluasi hook, susun naskah, dan bedah algoritma berbasis konteks Creator DNA Anda.
          </p>
        </div>

        {/* Persona Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-card border border-border/80">
          {(Object.keys(PERSONA_CONFIGS) as AiAssistantPersona[]).map((key) => {
            const config = PERSONA_CONFIGS[key];
            const Icon = config.icon;
            const isSelected = selectedPersona === key;

            return (
              <button
                key={key}
                onClick={() => setSelectedPersona(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Active Mode Information Pill */}
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <PersonaIcon className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-primary">{PERSONA_CONFIGS[selectedPersona].label}: </span>
            <span className="text-muted-foreground">{PERSONA_CONFIGS[selectedPersona].description}</span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline">
          Saldo: <strong className="text-foreground">{creditBalance}</strong> Kredit
        </span>
      </div>

      {/* 3. Chat Message Stream */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-xs flex flex-col min-h-[480px] max-h-[640px]">
        <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";

            return (
              <div
                key={msg.id || idx}
                className={cn("flex gap-3 max-w-3xl", isUser ? "ml-auto justify-end" : "mr-auto justify-start")}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0 shadow-xs mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={cn("space-y-2.5 max-w-[85%]", isUser ? "items-end text-right" : "items-start text-left")}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {isUser ? creatorName : `CreatorOS AI (${PERSONA_CONFIGS[msg.persona || selectedPersona].label})`}
                    </span>
                    {msg.timestamp && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">
                        {msg.timestamp}
                      </span>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed border transition-all",
                      isUser
                        ? "bg-primary text-primary-foreground border-primary/20 shadow-xs text-left"
                        : "bg-card border-border/80 text-foreground shadow-xs text-left whitespace-pre-line"
                    )}
                  >
                    {msg.content}
                  </div>

                  {/* Action Items Box (if assistant returned actionable checklist) */}
                  {!isUser && msg.actionItems && msg.actionItems.length > 0 && (
                    <div className="rounded-xl border border-border/70 bg-card/90 p-3 space-y-1.5 text-left text-xs">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Rekomendasi Langkah Aksi:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                        {msg.actionItems.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Copy Button & Follow-Up Suggestions */}
                  {!isUser && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(msg.content, idx)}
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              <span className="text-emerald-500">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Salin Jawaban</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.suggestedFollowUps.map((prompt, i) => (
                            <button
                              key={i}
                              onClick={() => handleSendMessage(prompt)}
                              className="inline-flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 bg-muted/60 hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border/60 transition-colors text-left"
                            >
                              <span>{prompt}</span>
                              <ArrowRight className="h-2.5 w-2.5 shrink-0 opacity-60" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground shrink-0 shadow-xs mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-muted-foreground animate-pulse pt-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
              <span>AI Assistant sedang memikirkan strategi terbaik untuk Anda...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* 4. Sample Prompt Chips & Chat Input Footer */}
        <div className="p-4 border-t border-border/80 bg-card/40 space-y-3">
          {/* Quick Suggestions for Selected Persona */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Lightbulb className="h-3 w-3 text-amber-500" /> Kiat Cepat:
            </span>
            {SAMPLE_PROMPTS[selectedPersona].map((sample, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(sample)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-muted/50 hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border/60 transition-colors truncate max-w-xs"
                title={sample}
              >
                {sample}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="flex gap-2 items-end">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Tanyakan strategi, minta perbaiki hook, atau minta naskah baru kepada ${PERSONA_CONFIGS[selectedPersona].label}... (Enter untuk kirim)`}
              className="resize-none min-h-[46px] max-h-32 text-xs sm:text-sm py-2.5"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className="h-10 px-4 shrink-0 gap-1.5 shadow-xs"
            >
              <span>Kirim</span>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
