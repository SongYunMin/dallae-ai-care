import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/app-state";
import { IonMascot } from "@/components/IonMascot";
import { askAgentChat } from "@/lib/api";
import { CHAT_SUGGESTIONS, DEFAULT_RULES } from "@/lib/mock-data";
import type { ChatMessage } from "@/lib/types";
import { Send, ShieldCheck } from "lucide-react";

export function ChatScreen() {
  const {
    chatMessages,
    addChatMessage,
    currentUser,
    child,
    pendingChatQuestion,
    setPendingChatQuestion,
    records,
    checklist,
    parentRules,
    childMood,
    notifications,
    session,
  } = useApp();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const localContext = useMemo(
    () => ({
      child: {
        name: child.name,
        ageMonths: child.ageInMonths,
        feedingType: child.feedingType,
      },
      currentUser: { name: currentUser.name, role: currentUser.role },
      session: session ? { caregiver: session.caregiverName, startedAt: session.startedAt } : null,
      childMood,
      familyRules: [...DEFAULT_RULES, ...parentRules],
      recentRecords: records.slice(0, 30).map((r) => ({
        type: r.type,
        recordedAt: r.recordedAt,
        memo: r.memo,
        amountMl: r.amountMl,
        by: r.recordedByName,
      })),
      checklist: checklist.slice(0, 30).map((c) => ({
        date: c.date,
        time: c.time,
        label: c.label,
        kind: c.kind,
        done: c.completed,
      })),
      recentNotifications: notifications.slice(0, 5).map((n) => ({
        title: n.title,
        message: n.message,
      })),
      now: new Date().toISOString(),
    }),
    [records, checklist, parentRules, child, currentUser, session, childMood, notifications],
  );

  const send = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMessage = {
      id: "u" + Date.now(),
      role: "user",
      text: trimmed,
      at: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    setText("");
    setLoading(true);
    setError(null);
    try {
      // 서버가 매 요청마다 최신 아이 상태/권한/기록 컨텍스트를 다시 조립한다.
      // localContext는 현재 UI에서 어떤 맥락을 보고 있는지 유지하기 위한 화면용 스냅샷이다.
      void localContext;
      const response = await askAgentChat(trimmed, {
        caregiverId: currentUser.id,
        careSessionId: session?.id,
      });
      addChatMessage({
        id: "a" + Date.now(),
        role: "agent",
        response,
        at: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (pendingChatQuestion) {
      send(pendingChatQuestion);
      setPendingChatQuestion(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChatQuestion]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-5 pt-7 pb-3 gradient-hero shrink-0">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-card/70 p-1 shadow-card">
            <IonMascot variant="basic" size={48} />
          </div>
          <div>
            <h1 className="text-base font-bold">아이온 AI 돌봄 챗봇</h1>
            <p className="text-[11px] text-muted-foreground">
              {child.name}이의 모든 기록·규칙·감정을 보고 답해요
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-card/80 backdrop-blur p-3 text-xs space-y-0.5">
          <p className="font-bold">
            {child.name} · {child.ageInMonths}개월
          </p>
          <p className="text-muted-foreground">
            기록 {records.length}건 · 체크리스트 {checklist.length}건 · 규칙{" "}
            {DEFAULT_RULES.length + parentRules.length}개
            {childMood ? ` · 감정 ${childMood.emoji} ${childMood.label}` : ""}
          </p>
          <p className="text-mint-foreground font-semibold flex items-center gap-1">
            <ShieldCheck size={12} /> 가족 규칙 반영 중
          </p>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 min-h-0 px-4 py-4 space-y-3 overflow-y-auto">
        {chatMessages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-mint/30 border border-mint/40 p-3">
              <div className="flex items-start gap-2">
                <IonMascot variant="wink" size={36} />
                <div>
                  <p className="text-xs font-bold">안녕하세요! {currentUser.name}님,</p>
                  <p className="text-[11px] text-foreground/75 mt-0.5 leading-relaxed">
                    {child.name}이의 기록과 가족 규칙을 모두 알고 있어요. 무엇이든 자유롭게
                    물어보세요.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground/70 px-1 mb-2">💬 자주 묻는 질문</p>
              <div className="flex flex-wrap gap-2">
                {CHAT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-3 py-2 rounded-full bg-card border border-border shadow-card active:scale-95 transition-transform"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {chatMessages.map((m) => {
          const body = m.text ?? m.response?.answer ?? "";
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
                  {body}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="flex items-start gap-2">
              <IonMascot variant="basic" size={32} />
              <div className="flex-1 max-w-[88%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                {body}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-end gap-2">
            <IonMascot variant="basic" size={32} />
            <div className="rounded-2xl bg-card border border-border px-4 py-3 text-sm text-muted-foreground">
              아이온이 생각 중이에요…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-coral/30 border border-coral/50 px-4 py-3 text-xs text-foreground">
            오류: {error}
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 bg-background/95 backdrop-blur border-t border-border safe-bottom">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder="아이에 대해 무엇이든 물어보세요"
            className="flex-1 h-12 px-4 rounded-full bg-card border border-border text-sm"
          />
          <button
            onClick={() => send(text)}
            disabled={loading || !text.trim()}
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
            aria-label="전송"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
