import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { DEFAULT_RULES } from '@/lib/mock-data';
import { ShieldCheck, Plus, ChevronLeft } from 'lucide-react';

export function RulesScreen() {
  const { parentRules, addRule, navigate, toast } = useApp();
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col">
      <header className="px-4 pt-7 pb-3 flex items-center gap-2 pl-16">
        <h1 className="text-lg font-bold">우리 가족 규칙</h1>
      </header>
      <div className="px-4 space-y-3">
        <div className="rounded-3xl bg-mint/30 border border-mint/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} className="text-mint-foreground" />
            <p className="text-sm font-bold text-mint-foreground">기본 안전 규칙</p>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mint-foreground/10 text-mint-foreground">
              ✨ AI 자동 생성
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">달래 AI가 안전을 위해 자동으로 적용했어요. 삭제할 수 없어요.</p>
          <ul className="space-y-1.5">
            {DEFAULT_RULES.map((r) => (
              <li key={r} className="text-sm flex gap-2"><span>✨</span><span>{r}</span></li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-bold">우리 집 규칙</p>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              👩‍👧 부모가 직접 추가
            </span>
          </div>
          <ul className="space-y-1.5 mb-3">
            {parentRules.map((r) => (
              <li key={r} className="text-sm flex gap-2"><span>💛</span><span>{r}</span></li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 낮잠은 2시간 이상 재우지 않기"
              className="flex-1 h-11 px-3 rounded-xl bg-cream border border-border text-sm"
            />
            <button
              onClick={() => {
                if (!text.trim()) return;
                addRule(text.trim());
                setText('');
                toast('규칙을 추가했어요');
              }}
              className="h-11 px-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-1"
            >
              <Plus size={14} /> 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
