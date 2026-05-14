import { useState } from 'react';
import { useApp } from '@/state/app-state';
import { IonMascot } from '@/components/IonMascot';
import { createParentOnboarding } from '@/lib/api';
import { DEFAULT_RULES } from '@/lib/mock-data';
import {
  Baby,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

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
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-20 px-4 pt-5 pb-3 flex items-center gap-2 bg-background/85 backdrop-blur border-b border-border/50">
        <button
          onClick={() => navigate('splash')}
          aria-label="시작 화면으로 돌아가기"
          className="h-10 w-10 -ml-2 rounded-full text-muted-foreground flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <p className="text-[11px] font-bold text-primary">아이온 시작 설정</p>
          <h1 className="text-xl font-bold leading-tight">아이 프로필 만들기</h1>
        </div>
      </header>

      <div className="px-5 pt-3 pb-32 space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 gradient-hero px-5 pt-5 pb-4 shadow-soft">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0 pt-1">
              <p className="inline-flex items-center gap-1 rounded-full bg-card/80 px-3 py-1 text-[11px] font-bold text-primary shadow-card">
                <Sparkles size={12} />
                1분 설정
              </p>
              <h2 className="mt-3 text-[28px] font-bold leading-[1.15] text-foreground">
                {childName}이의
                <br />
                돌봄 기준 만들기
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                루틴과 주의사항을
                <br />
                아이온이 이어받아요.
              </p>
            </div>
            <div className="shrink-0 rounded-[1.6rem] bg-card/75 p-2 shadow-card">
              <IonMascot variant="wink" size={116} className="drop-shadow-sm" />
            </div>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
            <InfoPill icon={UserRound} label="보호자" value={parentName || '-'} />
            <InfoPill icon={Baby} label="아이" value={childName || '-'} />
            <InfoPill icon={CalendarDays} label="생일" value={birthDate ? birthDate.slice(5).replace('-', '.') : '-'} />
          </div>
        </section>

        <section className={sectionCls}>
          <SectionTitle icon={Baby} eyebrow="STEP 1" title="기본 정보" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="보호자 이름">
              <input value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="아이 이름">
              <input value={childName} onChange={(e) => setChildName(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="생년월일">
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
          </Field>
          <div>
            <p className="ion-field-label">수유 방식</p>
            <div className="grid grid-cols-2 gap-2">
              {feedingOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setFeedingType(o.id)}
                  className={`h-12 rounded-2xl border text-sm font-bold transition-all active:scale-[0.98] ${
                    feedingType === o.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                      : 'bg-background text-foreground border-border shadow-card'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionCls}>
          <SectionTitle icon={HeartPulse} eyebrow="STEP 2" title="루틴과 주의사항" />
          <Field label="알레르기 / 주의사항">
            <input value={allergies} onChange={(e) => setAllergies(e.target.value)} className={inputCls} />
          </Field>
          <Field label="복용 중인 약 / 의료 메모">
            <textarea value={medical} onChange={(e) => setMedical(e.target.value)} className={textareaCls} />
          </Field>
          <Field label="기본 수면·수유 루틴">
            <textarea value={routine} onChange={(e) => setRoutine(e.target.value)} className={textareaCls} />
          </Field>
          <Field label="우리 집 돌봄 규칙">
            <input value={careNote} onChange={(e) => setCareNote(e.target.value)} className={inputCls} />
          </Field>
        </section>

        <section className="rounded-[1.75rem] border border-mint/70 bg-mint/25 p-4 shadow-card">
          <SectionTitle icon={ShieldCheck} eyebrow="AUTO" title="기본 안전 규칙" />
          <div className="mt-3 space-y-2">
            {DEFAULT_RULES.map((r) => (
              <div key={r} className="flex gap-2 rounded-2xl bg-card/75 px-3 py-2 text-sm leading-relaxed text-foreground/85">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint-foreground" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </section>
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

const sectionCls = 'rounded-[1.75rem] border border-border/70 bg-card/90 p-4 shadow-card space-y-4';
const inputCls = 'ion-control ion-input';
const textareaCls = 'ion-control ion-textarea';

function SectionTitle({ icon: Icon, eyebrow, title }: { icon: LucideIcon; eyebrow: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-primary/12 text-primary flex items-center justify-center">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-muted-foreground">{eyebrow}</p>
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
      </div>
    </div>
  );
}

function InfoPill({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-card/75 px-3 py-2 shadow-card">
      <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
        <Icon size={11} />
        {label}
      </div>
      <p className="mt-1 truncate text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ion-field">
      <span className="ion-field-label">{label}</span>
      {children}
    </label>
  );
}
