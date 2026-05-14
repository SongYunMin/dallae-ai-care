import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { askAgentChat } from '@/lib/api';
import { CHAT_SUGGESTIONS } from '@/lib/mock-data';
import type { AgentCareResponse, ChatMessage } from '@/lib/types';
import { Send, Sparkles, AlertTriangle, ListChecks, ShieldCheck, NotebookPen, Bell } from 'lucide-react';

export function ChatScreen() {
  const { chatMessages, addChatMessage, currentUser, child, session, pendingChatQuestion, setPendingChatQuestion } = useApp();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const send = async (q: string) => {
    if (!q.trim()) return;
    const userMsg: ChatMessage = { id: 'u' + Date.now(), role: 'user', text: q, at: new Date().toISOString() };
    addChatMessage(userMsg);
    setText('');
    setLoading(true);
    try {
      const r = await askAgentChat(q, {
        caregiverId: currentUser.id,
        careSessionId: session?.id,
      });
      addChatMessage({ id: 'a' + Date.now(), role: 'agent', response: r, at: new Date().toISOString() });
    } finally {
      setLoading(false);
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
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, loading]);

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="px-5 pt-7 pb-3 gradient-hero">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-card/70 p-1 shadow-card">
            <IonMascot variant="basic" size={48} />
          </div>
          <div>
            <h1 className="text-base font-bold">아이온 AI 돌봄 챗봇</h1>
            <p className="text-[11px] text-muted-foreground">
              {child.name}이의 기록과 가족 규칙을 보고 답해요
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-card/80 backdrop-blur p-3 text-xs space-y-0.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold tracking-wider bg-foreground/85 text-background px-1.5 py-0.5 rounded-full">
              지금 보고 있는 기록
            </span>
          </div>
          <p className="font-bold">{child.name} · {child.ageInMonths}개월</p>
          <p className="text-muted-foreground">마지막 수유: 오후 2:20 / 160ml</p>
          <p className="text-muted-foreground">마지막 낮잠 종료: 오후 12:00</p>
          <p className="text-muted-foreground">현재 돌보는 사람: {currentUser.name}</p>
          <p className="text-mint-foreground font-semibold flex items-center gap-1">
            <ShieldCheck size={12} /> 가족 규칙 반영 중
          </p>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
        {chatMessages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-mint/30 border border-mint/40 p-3">
              <div className="flex items-start gap-2">
                <IonMascot variant="wink" size={36} />
                <div>
                  <p className="text-xs font-bold">
                    안녕하세요! {currentUser.name}님,
                  </p>
                  <p className="text-[11px] text-foreground/75 mt-0.5 leading-relaxed">
                    {child.name}이의 모든 기록을 알고 있어요. 돌보면서 궁금한 건
                    바로 물어보세요. 데이터 기반으로 답해드릴게요.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-foreground/70 px-1 mb-2">
                💬 돌봄자가 자주 묻는 질문
              </p>
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

        {chatMessages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
                {m.text}
              </div>
            </div>
          ) : (
            <AgentBubble key={m.id} response={m.response!} />
          )
        )}

        {loading && (
          <div className="flex items-end gap-2">
            <IonMascot variant="basic" size={32} />
            <div className="rounded-2xl bg-card border border-border px-4 py-3 text-sm text-muted-foreground">
              아이온이 생각 중이에요…
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 p-3 bg-background/95 backdrop-blur border-t border-border">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(text)}
            placeholder="아이에 대해 궁금한 점을 물어보세요"
            className="flex-1 h-12 px-4 rounded-full bg-card border border-border text-sm"
          />
          <button
            onClick={() => send(text)}
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentBubble({ response }: { response: AgentCareResponse }) {
  return (
    <div className="flex items-start gap-2">
      <IonMascot variant="basic" size={32} />
      <div className="flex-1 space-y-2 max-w-[88%]">
        <Card icon={<Sparkles size={14} />} title="지금 상황" tone="cream">
          <p className="text-sm leading-relaxed">{response.answer}</p>
        </Card>
        {response.nextActions.length > 0 && (
          <Card icon={<ListChecks size={14} />} title="바로 할 일" tone="mint">
            <ul className="space-y-1 text-sm">
              {response.nextActions.map((a) => (
                <li key={a} className="flex gap-2"><span>•</span><span>{a}</span></li>
              ))}
            </ul>
          </Card>
        )}
        {response.ruleReminders.length > 0 && (
          <Card icon={<ShieldCheck size={14} />} title="가족 규칙" tone="sky">
            {response.ruleReminders.map((r) => (
              <p key={r} className="text-sm">• {r}</p>
            ))}
          </Card>
        )}
        {response.recordSuggestions.length > 0 && (
          <Card icon={<NotebookPen size={14} />} title="기록하면 좋은 것" tone="warm">
            {response.recordSuggestions.map((r) => (
              <p key={r} className="text-sm">• {r}</p>
            ))}
          </Card>
        )}
        {response.proactiveNotifications.length > 0 && (
          <Card icon={<Bell size={14} />} title="부모님께 알릴 것" tone="warm">
            {response.proactiveNotifications.map((r) => (
              <p key={r} className="text-sm">• {r}</p>
            ))}
          </Card>
        )}
        {response.escalation !== 'NONE' && (
          <Card icon={<AlertTriangle size={14} />} title="확인 필요" tone="coral">
            <p className="text-sm">
              {response.escalation === 'ASK_PARENT'
                ? '보호자에게 바로 확인해 주세요.'
                : '의료 전문가의 확인이 필요할 수 있어요.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone: 'cream' | 'mint' | 'sky' | 'coral' | 'warm';
}) {
  const tones = {
    cream: 'bg-cream',
    mint: 'bg-mint/40',
    sky: 'bg-sky/40',
    coral: 'bg-coral/40',
    warm: 'bg-card border border-border',
  };
  return (
    <div className={`rounded-2xl rounded-tl-sm p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">
        {icon} {title}
      </div>
      <div className="text-foreground/90">{children}</div>
    </div>
  );
}
