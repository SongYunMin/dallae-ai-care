import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/app-state";
import { IonMascot } from "@/components/IonMascot";
import { DEFAULT_RULES } from "@/lib/mock-data";
import {
  createCareRecord,
  createThankYouMessage,
  endCareSession,
  parseTextToRecord,
  startCareSession,
} from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/date";
import { itemDateTime, todayKey, formatItemTime } from "@/lib/checklist";
import type { CareRecord, CareRecordType, ChecklistItem } from "@/lib/types";
import { nowKstIso } from "@/lib/kst";
import { Mic, Send, X } from "lucide-react";
import moodHappy from "@/assets/moods/happy.png";
import moodSurprised from "@/assets/moods/surprised.png";
import moodSad from "@/assets/moods/sad.png";
import moodAngry from "@/assets/moods/angry.png";
import moodHungry from "@/assets/moods/hungry.png";
import moodSick from "@/assets/moods/sick.png";
import moodSleepy from "@/assets/moods/sleepy.png";
import moodCurious from "@/assets/moods/curious.png";

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const quick: { type: CareRecordType; label: string }[] = [
  { type: "FEEDING", label: "분유 먹였어요" },
  { type: "DIAPER", label: "기저귀 갈았어요" },
  { type: "SLEEP_START", label: "낮잠 시작" },
  { type: "SLEEP_END", label: "낮잠 종료" },
  { type: "MEDICINE", label: "약 먹였어요" },
];

const MOOD_OPTIONS: { emoji: string; label: string; image: string }[] = [
  { emoji: "😄", label: "기쁨", image: moodHappy },
  { emoji: "😮", label: "놀람", image: moodSurprised },
  { emoji: "😢", label: "슬픔", image: moodSad },
  { emoji: "😠", label: "화남", image: moodAngry },
  { emoji: "🍔", label: "배고픔", image: moodHungry },
  { emoji: "🤒", label: "아픔", image: moodSick },
  { emoji: "😴", label: "졸림", image: moodSleepy },
  { emoji: "❓", label: "궁금", image: moodCurious },
];

export function CareModeScreen() {
  const {
    session,
    startSession,
    endSession,
    addRecord,
    addThankYouReport,
    parentThankYouMessage,
    child,
    currentUser,
    toast,
    navigate,
    records,
    checklist,
    setChildMood,
  } = useApp();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [tick, setTick] = useState(0);
  const [moodOpen, setMoodOpen] = useState(false);
  const isParent = currentUser.role === "PARENT_ADMIN" || currentUser.role === "PARENT_EDITOR";
  const recordsRef = useRef(records);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000 * 30);
    return () => clearInterval(t);
  }, [session]);
  void tick;

  if (!session && !isParent) {
    return (
      <div className="px-5 pt-8 pb-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">돌봄 모드</h1>
          <p className="text-xs text-muted-foreground mt-1">지금 아이를 돌보는 분이 사용해요</p>
        </header>

        <div className="rounded-3xl gradient-hero p-5 flex flex-col items-center text-center gap-3 shadow-card">
          <IonMascot variant="basic" size={120} />
          <p className="font-bold">
            {child.name} · {child.ageInMonths}개월
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            돌봄을 시작하면 빠른 기록, 음성 기록,
            <br />
            챗봇 도움을 한 화면에서 사용할 수 있어요.
          </p>
        </div>

        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="font-bold text-sm">꼭 지킬 가족 규칙</p>
          <div className="mt-2 space-y-1.5">
            {DEFAULT_RULES.map((r) => (
              <div key={r} className="text-xs flex gap-2">
                <span className="text-mint-foreground">●</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={async () => {
            try {
              const s = await startCareSession(currentUser.name, currentUser.id);
              startSession({
                id: s.careSessionId,
                familyId: "family_1",
                childId: child.id,
                caregiverId: currentUser.id,
                caregiverName: currentUser.name,
                relationship: s.relationship ?? "caregiver",
                inviteToken: s.inviteToken,
                thankYouMessage: s.thankYouMessage,
                startedAt: s.startedAt,
                status: "ACTIVE",
              });
              toast("돌봄을 시작했어요. 안전이 우선이에요.");
            } catch {
              toast("돌봄자 초대 링크로 참여한 뒤 시작할 수 있어요.");
              navigate("dashboard");
            }
          }}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-soft"
        >
          돌봄 시작하기
        </button>
      </div>
    );
  }

  const onQuick = async (type: CareRecordType, label: string) => {
    const r = await createCareRecord({
      type,
      recordedBy: currentUser.id,
      recordedByName: currentUser.name,
      source: "MANUAL",
      memo: label,
      careSessionId: session?.id,
    });
    recordsRef.current = [r, ...recordsRef.current.filter((item) => item.id !== r.id)];
    addRecord(r);
    toast(`${label} · 기록했어요`);
  };

  const onTextRecord = async () => {
    if (!text.trim()) return;
    const parsed = parseTextToRecord(text);
    const r = await createCareRecord({
      type: parsed.type,
      amountMl: parsed.amountMl,
      memo: text,
      recordedBy: currentUser.id,
      recordedByName: currentUser.name,
      source: "VOICE",
      careSessionId: session?.id,
    });
    recordsRef.current = [r, ...recordsRef.current.filter((item) => item.id !== r.id)];
    addRecord(r);
    toast("음성 기록을 저장했어요");
    setText("");
  };

  const onVoiceRecord = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast("이 브라우저는 음성 인식을 지원하지 않아요. 아래 칸에 말한 내용을 적어주세요.");
      return;
    }

    // 조부모 사용자가 긴 입력 없이 한 문장으로 기록할 수 있게 음성을 텍스트로 옮긴다.
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setText(transcript);
    };
    recognition.onerror = () => {
      toast("음성을 듣지 못했어요. 텍스트로 입력해 주세요.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const title = session ? `${session.caregiverName}님이 돌보는 중` : `${currentUser.name}님의 기록 모드`;
  const subtitle = session
    ? `시작 ${formatTime(session.startedAt)} · ${formatDuration(session.startedAt)} 경과`
    : "세션 없이 남긴 기록도 돌보미와 함께 확인할 수 있어요";

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-mint">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-mint-foreground">
              {session ? "돌봄 진행 중" : "부모 기록"}
            </p>
            <h1 className="text-xl font-bold mt-0.5">{title}</h1>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <IonMascot variant="wink" size={64} />
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        <BabyStatusCard records={records} checklist={checklist} />

        <div className="rounded-3xl bg-card shadow-card p-4">
          <p className="font-bold text-sm mb-2">빠른 기록</p>
          <div className="grid grid-cols-2 gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={() => onQuick(q.type, q.label)}
                className="h-14 rounded-2xl bg-cream font-semibold text-sm active:scale-95 transition-transform"
              >
                {q.label}
              </button>
            ))}
            <button
              onClick={() => setMoodOpen(true)}
              className="h-14 rounded-2xl bg-mint/40 font-semibold text-sm active:scale-95 transition-transform"
            >
              😊 감정기록
            </button>
          </div>
        </div>

        {moodOpen && (
          <div
            className="fixed inset-0 z-50 bg-foreground/40 flex items-end justify-center"
            onClick={() => setMoodOpen(false)}
          >
            <div
              className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">아이의 지금 감정은?</p>
                <button
                  onClick={() => setMoodOpen(false)}
                  className="h-8 w-8 rounded-full bg-cream flex items-center justify-center"
                  aria-label="닫기"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                선택한 감정은 홈의 아이온 표정에도 반영돼요.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.label}
                    onClick={async () => {
                      setChildMood({ emoji: m.emoji, label: m.label, image: m.image });
                      const r = await createCareRecord({
                        type: "NOTE",
                        recordedBy: currentUser.id,
                        recordedByName: currentUser.name,
                        source: "MANUAL",
                        memo: `감정: ${m.emoji} ${m.label}`,
                        careSessionId: session?.id,
                      });
                      recordsRef.current = [r, ...recordsRef.current.filter((item) => item.id !== r.id)];
                      addRecord(r);
                      setMoodOpen(false);
                      toast(`${m.emoji} ${m.label} · 감정 기록`);
                    }}
                    className="aspect-square rounded-2xl bg-cream flex flex-col items-center justify-center gap-1 p-1 active:scale-95 transition-transform"
                  >
                    <img
                      src={m.image}
                      alt={m.label}
                      className="h-12 w-12 object-contain"
                      draggable={false}
                    />
                    <span className="text-[10px] font-semibold">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl bg-card shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">말로 기록하기</p>
            <span className="text-[11px] text-muted-foreground">예: 지금 분유 먹였어</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onVoiceRecord}
              className={`h-12 w-12 rounded-full text-primary-foreground flex items-center justify-center shadow-soft shrink-0 ${
                listening ? "bg-coral animate-pulse" : "bg-primary"
              }`}
              aria-label="말로 기록하기"
            >
              <Mic size={20} />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 지금 분유 160ml 먹였어"
              className="flex-1 h-12 px-4 rounded-xl bg-cream border border-border text-sm"
            />
            <button
              onClick={onTextRecord}
              className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {session ? (
          session.caregiverId === currentUser.id ? (
          <button
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm("돌봄을 종료할까요? 부모님께 감사 메시지가 전달돼요.")
              )
                return;
              const ended = endSession();
              if (!ended) return;
              const sessionRecords = recordsRef.current.filter((r) => {
                if (r.careSessionId) return r.careSessionId === ended.id;
                const recordedAt = new Date(r.recordedAt).getTime();
                return (
                  recordedAt >= new Date(ended.startedAt).getTime() &&
                  recordedAt <= new Date(ended.endedAt ?? nowKstIso()).getTime()
                );
              });
              const counts = {
                feeding: sessionRecords.filter((r) => r.type === "FEEDING").length,
                diaper: sessionRecords.filter((r) => r.type === "DIAPER").length,
                sleep: sessionRecords.filter((r) => r.type.startsWith("SLEEP")).length,
                medicine: sessionRecords.filter((r) => r.type === "MEDICINE").length,
                voiceNotes: sessionRecords.filter((r) => r.source === "VOICE").length,
              };
              const durationLabel = formatDuration(ended.startedAt, ended.endedAt);
              void endCareSession(ended.id, ended.startedAt, counts).catch(() => {
                toast("돌봄 종료 상태를 백엔드에 저장하지 못했어요");
              });

              const preset = (ended.thankYouMessage || parentThankYouMessage).trim();
              const baseReport = {
                id: `thx_${ended.id}`,
                sessionId: ended.id,
                fromUserId: "user_parent_1",
                fromUserName: preset ? "부모님" : "부모님 (AI 작성)",
                toCaregiverName: ended.caregiverName,
                message:
                  preset ||
                  `${ended.caregiverName}님, 오늘 ${child.name} 돌봐주셔서 정말 감사해요. 덕분에 안심하고 하루를 보냈어요.`,
                durationLabel,
                counts: {
                  feeding: counts.feeding,
                  diaper: counts.diaper,
                  sleep: counts.sleep,
                  medicine: counts.medicine,
                },
                sentAt: nowKstIso(),
              };

              addThankYouReport(baseReport);
              navigate("thankYouReport", { careSessionId: ended.id });

              if (!preset) {
                void createThankYouMessage({
                  familyId: ended.familyId,
                  childId: ended.childId,
                  caregiverId: ended.caregiverId,
                  careSessionId: ended.id,
                  caregiverName: ended.caregiverName,
                  childName: child.name,
                  durationLabel,
                  counts: {
                    feeding: counts.feeding,
                    diaper: counts.diaper,
                    sleep: counts.sleep,
                    medicine: counts.medicine,
                  },
                }).then((res) => {
                  if (!res?.message) return;
                  addThankYouReport({
                    ...baseReport,
                    fromUserName: "부모님 (AI 작성)",
                    message: res.message,
                    sentAt: nowKstIso(),
                  });
                });
              }
            }}
            className="w-full h-14 rounded-2xl bg-coral text-coral-foreground font-semibold shadow-soft"
          >
            돌봄 종료하기
          </button>
          ) : (
          <div className="w-full rounded-2xl bg-muted/60 border border-border p-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              돌봄 종료는 {session.caregiverName}님만 할 수 있어요
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              지금 돌보고 있는 분이 직접 종료하면 부모님이 준비한 감사 메시지가 전달돼요.
            </p>
          </div>
          )
        ) : (
          <div className="w-full rounded-2xl bg-muted/60 border border-border p-4 text-center">
            <p className="text-sm font-semibold text-foreground">부모 기록 모드로 저장 중이에요</p>
            <p className="text-xs text-muted-foreground mt-1">
              돌봄 세션을 만들지 않기 때문에 종료 리포트 없이 기록만 공유돼요.
            </p>
          </div>
        )}

        <div className="rounded-3xl bg-mint/30 border border-mint/50 p-4">
          <p className="text-[11px] font-bold tracking-wider text-mint-foreground">
            꼭 지킬 가족 규칙
          </p>
          <div className="mt-1.5 space-y-1">
            {DEFAULT_RULES.map((r) => (
              <p key={r} className="text-xs leading-snug">
                • {r}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function whenLabel(targetMs: number): string {
  const diffMin = Math.round((targetMs - Date.now()) / 60000);
  if (diffMin <= 0) return "지금";
  if (diffMin < 60) return `${diffMin}분 뒤`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `${h}시간 뒤` : `${h}시간 ${m}분 뒤`;
}

function nextOfKind(checklist: ChecklistItem[], kind: ChecklistItem["kind"]): ChecklistItem | null {
  const today = todayKey();
  const now = Date.now();
  return (
    checklist
      .filter((it) => it.kind === kind && !it.completed && it.date >= today)
      .filter((it) => itemDateTime(it).getTime() >= now - 5 * 60000)
      .sort((a, b) => itemDateTime(a).getTime() - itemDateTime(b).getTime())[0] ?? null
  );
}

function StatusTile({
  emoji,
  label,
  next,
  tone,
}: {
  emoji: string;
  label: string;
  next: ChecklistItem | null;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl p-3 ${tone}`}>
      <p className="text-[11px] font-bold tracking-wider text-foreground/70">
        {emoji} {label}
      </p>
      <p className="mt-1.5 text-[10px] text-muted-foreground">해야할 일</p>
      <p className="text-sm font-bold leading-tight">
        {next
          ? `${formatItemTime(next.time)} · ${whenLabel(itemDateTime(next).getTime())}`
          : "예정 없음"}
      </p>
    </div>
  );
}

function BabyStatusCard({
  records,
  checklist,
}: {
  records: CareRecord[];
  checklist: ChecklistItem[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  void records;

  const nextFeed = useMemo(() => nextOfKind(checklist, "FEEDING"), [checklist]);
  const nextSleep = useMemo(() => nextOfKind(checklist, "SLEEP"), [checklist]);

  return (
    <div className="rounded-3xl bg-card shadow-card p-4">
      <p className="font-bold text-sm mb-2">다음 할 일</p>
      <div className="grid grid-cols-2 gap-2">
        <StatusTile emoji="🍼" label="밥" tone="bg-cream" next={nextFeed} />
        <StatusTile emoji="😴" label="잠" tone="bg-sky/40" next={nextSleep} />
      </div>
    </div>
  );
}
