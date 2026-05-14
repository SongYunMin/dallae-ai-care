import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { createParentOnboarding } from '@/lib/api';
import { DEFAULT_RULES } from '@/lib/mock-data';
import { ChevronLeft } from 'lucide-react';

const feedingOptions = [
  { id: 'BREAST', label: '모유' },
  { id: 'FORMULA', label: '분유' },
  { id: 'MIXED', label: '혼합' },
  { id: 'SOLID', label: '이유식 포함' },
];

export function OnboardingScreen() {
  const { navigate, toast, applyOnboardingResult, exitDemoMode } = useApp();
  const [parentName, setParentName] = useState('엄마');
  const [childName, setChildName] = useState('하린');
  const [birthDate, setBirthDate] = useState('2025-11-07');
  const [feedingType, setFeedingType] = useState('FORMULA');
  const [allergies, setAllergies] = useState('없음');
  const [medical, setMedical] = useState('해열제는 부모 확인 후 복용');
  const [routine, setRoutine] = useState('밤 9시 취침, 3시간 간격 수유');
  const [careNote, setCareNote] = useState('영상보다 장난감으로 달래기');

  const submit = async () => {
    exitDemoMode();
    try {
      const result = await createParentOnboarding({
        parentName,
        childName,
        birthDate,
        feedingType,
        allergies,
        medicalNotes: medical,
        routineNotes: routine,
        careNotes: careNote,
      });
      applyOnboardingResult(result);
      toast(`${childName}이의 돌봄 정보가 저장되었어요.`);
      navigate('dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : '아이 정보를 저장하지 못했어요.');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-4 pt-6 pb-2 flex items-center gap-2">
        <button onClick={() => navigate('splash')} className="p-2 -ml-2 text-muted-foreground">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">아이 정보 등록</h1>
      </header>

      <div className="px-5 pb-3 flex items-center gap-3">
        <IonMascot variant="wink" size={64} />
        <p className="text-sm text-muted-foreground leading-snug">
          아이온이 돌봄을 도울 수 있도록
          <br />
          기본 정보를 알려주세요.
        </p>
      </div>

      <div className="flex-1 px-5 pb-32 space-y-4">
        <Field label="보호자 이름">
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="아이 이름">
          <input value={childName} onChange={(e) => setChildName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="생년월일">
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="수유 방식">
          <div className="grid grid-cols-2 gap-2">
            {feedingOptions.map((o) => (
              <button
                key={o.id}
                onClick={() => setFeedingType(o.id)}
                className={`h-12 rounded-xl border text-sm font-medium transition-colors ${
                  feedingType === o.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="알레르기 / 주의사항">
          <input value={allergies} onChange={(e) => setAllergies(e.target.value)} className={inputCls} />
        </Field>
        <Field label="복용 중인 약 / 의료 메모">
          <textarea value={medical} onChange={(e) => setMedical(e.target.value)} className={`${inputCls} min-h-[72px]`} />
        </Field>
        <Field label="기본 수면·수유 루틴">
          <textarea value={routine} onChange={(e) => setRoutine(e.target.value)} className={`${inputCls} min-h-[72px]`} />
        </Field>
        <Field label="우리 집 돌봄 규칙">
          <input value={careNote} onChange={(e) => setCareNote(e.target.value)} className={inputCls} />
        </Field>

        <div className="rounded-2xl bg-mint/40 border border-mint p-4 space-y-2">
          <p className="text-xs font-bold text-mint-foreground">기본 안전 규칙 · 자동 적용</p>
          {DEFAULT_RULES.map((r) => (
            <div key={r} className="flex gap-2 text-sm text-foreground/90">
              <span>•</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 mx-auto max-w-[430px] p-4 bg-background/95 backdrop-blur border-t border-border safe-bottom">
        <button
          onClick={submit}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft"
        >
          아이 정보 저장하기
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-foreground/90">{label}</span>
      {children}
    </label>
  );
}
