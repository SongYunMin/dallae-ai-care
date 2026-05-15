import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/app-state";
import { IonMascot } from "@/components/IonMascot";
import {
  createCareRecord,
  createThankYouMessage,
  endCareSession,
  parseTextToRecord,
  saveVoiceNote,
  startCareSession,
} from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/date";
import { itemDateTime, todayKey, formatItemTime } from "@/lib/checklist";
import type { CareRecord, CareRecordType, CareSession, ChecklistItem } from "@/lib/types";
import { nowKstIso } from "@/lib/kst";
import { Mic, Send, X } from "lucide-react";
import moodAngry from "@/assets/moods/ion-angry.png";
import moodCurious from "@/assets/moods/ion-curious.png";
import moodHappy from "@/assets/moods/ion-happy.png";
import moodHungry from "@/assets/moods/ion-hungry.png";
import moodSad from "@/assets/moods/ion-sad.png";
import moodSick from "@/assets/moods/ion-sick.png";
import moodSleepy from "@/assets/moods/ion-sleepy.png";
import moodSurprised from "@/assets/moods/ion-surprised.png";

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  error?: string;
  message?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous?: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function collectSpeechTranscript(results: ArrayLike<SpeechRecognitionResultLike>): string {
  // 브라우저 음성 인식은 한 문장을 여러 결과 조각으로 나눠 줄 수 있어 전체 결과를 합쳐 입력칸에 반영한다.
  return Array.from(results, (result) => result[0]?.transcript?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function speechRecognitionErrorMessage(error?: string, message?: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "마이크 권한이 막혀 있어요. 브라우저 권한을 허용한 뒤 다시 눌러주세요.";
  }
  if (error === "audio-capture") {
    return "마이크 장치를 찾지 못했어요. 기기 마이크가 켜져 있는지 확인해 주세요.";
  }
  if (error === "network") {
    return "브라우저 음성 인식 서버에 연결하지 못했어요. 네트워크나 브라우저 음성 인식 지원 상태를 확인해 주세요.";
  }
  if (error === "no-speech") {
    return "음성을 듣지 못했어요. 조금 더 가까이 말하거나 텍스트로 입력해 주세요.";
  }
  if (error === "language-not-supported") {
    return "이 브라우저가 한국어 음성 인식을 지원하지 않아요. Chrome에서 다시 시도해 주세요.";
  }
  if (error === "aborted") {
    return "음성 인식이 중단됐어요. 다시 한 번 눌러 말해 주세요.";
  }
  const detail = [error, message].filter(Boolean).join(": ");
  return `음성 인식에 실패했어요${detail ? ` (${detail})` : ""}. 텍스트로 입력해 주세요.`;
}

async function requestMicrophoneAccess(): Promise<string | null> {
  if (typeof window === "undefined") return "음성 인식은 브라우저에서만 사용할 수 있어요.";
  if (!window.isSecureContext) {
    return "마이크는 HTTPS 또는 localhost 주소에서만 사용할 수 있어요. 배포 주소나 localhost로 열어 주세요.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "이 브라우저는 마이크 권한 확인을 지원하지 않아요. Chrome에서 다시 시도해 주세요.";
  }

  try {
    // SpeechRecognition이 바로 `not-allowed`로 끝나는 브라우저가 있어 마이크 권한을 먼저 명시적으로 요청한다.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return null;
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "마이크 권한이 차단돼 있어요. 주소창의 사이트 설정에서 마이크를 허용해 주세요.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "사용 가능한 마이크를 찾지 못했어요. 기기 마이크 연결 상태를 확인해 주세요.";
    }
    return "마이크를 시작하지 못했어요. 브라우저 권한과 기기 마이크 상태를 확인해 주세요.";
  }
}

const quick: { type: CareRecordType; label: string }[] = [
  { type: "FEEDING", label: "분유 먹였어요" },
  { type: "DIAPER", label: "기저귀 갈았어요" },
  { type: "SLEEP_START", label: "낮잠 시작" },
  { type: "SLEEP_END", label: "낮잠 종료" },
  { type: "MEDICINE", label: "약 먹였어요" },
];

const TYPE_LABEL: Record<CareRecordType, string> = {
  FEEDING: "수유",
  DIAPER: "기저귀",
  SLEEP_START: "낮잠 시작",
  SLEEP_END: "낮잠 종료",
  MEDICINE: "약",
  CRYING: "울음",
  NOTE: "메모",
};

function recordTypeLabel(type: string): string {
  return (TYPE_LABEL as Record<string, string>)[type] ?? "알 수 없는 기록";
}

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

function caregiverDisplayName(session: CareSession) {
  const name = session.caregiverName.trim();
  const relationship = session.relationship.trim();
  // 이전 초대 화면의 기본값 때문에 이름이 "할머니"로 저장된 세션은 관계명으로 상단 표시를 보정한다.
  if (name === "할머니" && relationship && relationship !== name) return relationship;
  return name || relationship || "돌봄자";
}

export function CareModeScreen() {
  const {
    session,
    startSession,
    endSession,
    addRecord,
    addThankYouReport,
    parentThankYouMessage,
    parentRules,
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
  const [savingQuickType, setSavingQuickType] = useState<CareRecordType | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const isParent = currentUser.role === "PARENT_ADMIN" || currentUser.role === "PARENT_EDITOR";
  const canWriteRecords = currentUser.role !== "CAREGIVER_VIEWER";
  const recordsRef = useRef(records);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000 * 30);
    return () => clearInterval(t);
  }, [session]);
  void tick;

  useEffect(() => {
    // 서버와 클라이언트에서 생성 시간이 달라지는 시간 기반 기록은 마운트 이후에만 화면에 붙여 hydration 차이를 피한다.
    setClientReady(true);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  if (!session && !isParent) {
    const viewerCopy = currentUser.role === "CAREGIVER_VIEWER" ? "조회 전용 돌봄 참여로 아이 상태를 확인할 수 있어요" : "지금 아이를 돌보는 분이 사용해요";
    return (
      <div className="px-5 pt-8 pb-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">돌봄 모드</h1>
          <p className="text-xs text-muted-foreground mt-1">{viewerCopy}</p>
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
            {parentRules.map((r) => (
              <div key={r} className="text-xs flex gap-2">
                <span className="text-mint-foreground">●</span>
                <span>{r}</span>
              </div>
            ))}
            {parentRules.length === 0 && (
              <p className="text-xs text-muted-foreground">아직 불러온 가족 규칙이 없어요.</p>
            )}
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
            } catch (err) {
              toast(err instanceof Error ? `돌봄 시작 실패: ${err.message}` : "돌봄자 초대 링크로 참여한 뒤 시작할 수 있어요.");
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
    if (!canWriteRecords) {
      toast("조회 전용 권한이라 기록할 수 없어요.");
      return;
    }
    if (savingQuickType) return;
    setSavingQuickType(type);
    try {
      // 버튼을 누른 자리에서 저장 진행 상태를 보여주고, 완료 후 같은 화면의 최근 기록에 즉시 반영한다.
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
    } catch {
      toast("기록 저장에 실패했어요. 잠시 후 다시 눌러주세요.");
    } finally {
      setSavingQuickType(null);
    }
  };

  const onTextRecord = async () => {
    if (!text.trim()) return;
    if (!canWriteRecords) {
      toast("조회 전용 권한이라 기록할 수 없어요.");
      return;
    }

    try {
      const memo = text.trim();
      const r = session
        ? (await saveVoiceNote(memo, session.id, currentUser.id)).createdRecord
        : await createCareRecord({
            ...parseTextToRecord(memo),
            recordedBy: currentUser.id,
            recordedByName: currentUser.name,
            source: "VOICE",
          });
      recordsRef.current = [r, ...recordsRef.current.filter((item) => item.id !== r.id)];
      addRecord(r);
      toast("음성 기록을 저장했어요");
      setText("");
    } catch (err) {
      toast(err instanceof Error ? `기록 저장 실패: ${err.message}` : "음성 기록을 저장하지 못했어요");
    }
  };

  const onVoiceRecord = async () => {
    if (!canWriteRecords) {
      toast("조회 전용 권한이라 기록할 수 없어요.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast("이 브라우저는 음성 인식을 지원하지 않아요. 아래 칸에 말한 내용을 적어주세요.");
      return;
    }
    const microphoneError = await requestMicrophoneAccess();
    if (microphoneError) {
      toast(microphoneError);
      return;
    }

    // 조부모 사용자가 긴 입력 없이 한 문장으로 기록할 수 있게 음성을 텍스트로 옮긴다.
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = collectSpeechTranscript(event.results);
      if (transcript) setText(transcript);
    };
    recognition.onerror = (event) => {
      console.warn("[CareMode] speech recognition error", event.error, event.message);
      toast(speechRecognitionErrorMessage(event.error, event.message));
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      toast("음성 인식을 시작하지 못했어요. 브라우저 권한을 확인해 주세요.");
    }
  };

  const sessionDisplayName = session ? caregiverDisplayName(session) : currentUser.name;
  const title = session ? `${sessionDisplayName}님이 돌보는 중` : `${currentUser.name}님의 빠른 기록 모드`;
  const subtitle = session
    ? `시작 ${formatTime(session.startedAt)} · ${formatDuration(session.startedAt)} 경과`
    : "세션 없이 남긴 기록도 돌보미와 함께 확인할 수 있어요";
  const recentRecords = clientReady ? getRecentCareModeRecords(records, session) : [];

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-8 pb-4 gradient-mint">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-mint-foreground">
              {session ? "돌봄 진행 중" : "부모 빠른 기록"}
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
                disabled={savingQuickType !== null || !canWriteRecords}
                className="h-14 rounded-2xl bg-cream font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
              >
                {savingQuickType === q.type ? "저장 중..." : q.label}
              </button>
            ))}
            <button
              onClick={() => setMoodOpen(true)}
              disabled={!canWriteRecords}
              className="h-14 rounded-2xl bg-mint/40 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
            >
              😊 감정기록
            </button>
          </div>
        </div>

        {recentRecords.length > 0 && (
          <div className="rounded-3xl bg-card shadow-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">최근 기록</p>
              <button
                onClick={() => navigate("records")}
                className="text-[11px] font-semibold text-mint-foreground"
              >
                전체 보기
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {recentRecords.map((record) => (
                <div key={record.id} className="rounded-2xl bg-cream px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {recordTypeLabel(record.type)}
                      {record.amountMl ? ` · ${record.amountMl}ml` : ""}
                    </p>
                    <p className="shrink-0 text-[11px] text-muted-foreground">
                      {formatTime(record.recordedAt)}
                    </p>
                  </div>
                  {record.memo && (
                    <p className="mt-1 text-xs leading-snug text-foreground/70">{record.memo}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                선택한 감정은 홈의 메인 프로필 사진에도 반영돼요.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.label}
                    onClick={async () => {
                      if (!canWriteRecords) return;
                      try {
                        const r = await createCareRecord({
                          type: "NOTE",
                          recordedBy: currentUser.id,
                          recordedByName: currentUser.name,
                          source: "MANUAL",
                          memo: `감정: ${m.emoji} ${m.label}`,
                          careSessionId: session?.id,
                        });
                        // 서버 저장이 성공한 감정만 전역 표정과 기록 목록에 반영한다.
                        setChildMood({ emoji: m.emoji, label: m.label, image: m.image });
                        recordsRef.current = [r, ...recordsRef.current.filter((item) => item.id !== r.id)];
                        addRecord(r);
                        setMoodOpen(false);
                        toast(`${m.emoji} ${m.label} · 감정 기록`);
                      } catch (err) {
                        toast(err instanceof Error ? `감정 기록 실패: ${err.message}` : "감정 기록을 저장하지 못했어요");
                      }
                    }}
                    className="aspect-square rounded-2xl bg-cream flex flex-col items-center justify-center gap-1 p-1 active:scale-95 transition-transform"
                  >
                    <img
                      src={m.image}
                      alt={m.label}
                      className="h-16 w-16 object-contain"
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
              disabled={!canWriteRecords}
              className={`h-12 w-12 rounded-full text-primary-foreground flex items-center justify-center shadow-soft shrink-0 ${
                listening ? "bg-coral animate-pulse" : "bg-primary"
              } disabled:opacity-50`}
              aria-label="말로 기록하기"
            >
              <Mic size={20} />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!canWriteRecords}
              placeholder="예: 지금 분유 160ml 먹였어"
              className="flex-1 h-12 px-4 rounded-xl bg-cream border border-border text-sm disabled:opacity-60"
            />
            <button
              onClick={onTextRecord}
              disabled={!canWriteRecords || !text.trim()}
              className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 disabled:opacity-50"
              aria-label="텍스트 기록 저장"
            >
              <Send size={18} />
            </button>
          </div>
          {!canWriteRecords && (
            <p className="text-[11px] text-muted-foreground">조회 전용 돌봄 참여라 음성/텍스트 기록은 비활성화돼요.</p>
          )}
        </div>

        {session ? (
          session.caregiverId === currentUser.id ? (
          <button
            onClick={async () => {
              if (
                typeof window !== "undefined" &&
                !window.confirm("돌봄을 종료할까요? 부모님께 감사 메시지가 전달돼요.")
              )
                return;
              const activeSession = session;
              if (!activeSession) return;
              const localEnded: CareSession = { ...activeSession, status: "ENDED", endedAt: nowKstIso() };
              const sessionRecords = recordsRef.current.filter((r) => {
                if (r.careSessionId) return r.careSessionId === localEnded.id;
                const recordedAt = new Date(r.recordedAt).getTime();
                return (
                  recordedAt >= new Date(localEnded.startedAt).getTime() &&
                  recordedAt <= new Date(localEnded.endedAt ?? nowKstIso()).getTime()
                );
              });
              const counts = {
                feeding: sessionRecords.filter((r) => r.type === "FEEDING").length,
                diaper: sessionRecords.filter((r) => r.type === "DIAPER").length,
                sleep: sessionRecords.filter((r) => r.type.startsWith("SLEEP")).length,
                medicine: sessionRecords.filter((r) => r.type === "MEDICINE").length,
                voiceNotes: sessionRecords.filter((r) => r.source === "VOICE").length,
              };
              try {
                await endCareSession(localEnded.id, counts);
              } catch (err) {
                toast(err instanceof Error ? `돌봄 종료 실패: ${err.message}` : "돌봄 종료 상태를 백엔드에 저장하지 못했어요");
                return;
              }

              const ended = endSession() ?? localEnded;
              const durationLabel = formatDuration(ended.startedAt, ended.endedAt);
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

              const savedBaseReport = await addThankYouReport(baseReport);
              if (!savedBaseReport) return;
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
                  const fromUserName = res.fallbackUsed ? "부모님 (AI 기본 응답)" : "부모님 (AI 작성)";
                  addThankYouReport({
                    ...baseReport,
                    fromUserName,
                    message: res.message,
                    sentAt: nowKstIso(),
                  });
                }).catch(() => {
                  toast("AI 감사 메시지를 생성하지 못해 기본 메시지를 유지했어요.");
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
              돌봄 종료는 {sessionDisplayName}님만 할 수 있어요
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              지금 돌보고 있는 분이 직접 종료하면 부모님이 준비한 감사 메시지가 전달돼요.
            </p>
          </div>
          )
        ) : (
          <div className="w-full rounded-2xl bg-muted/60 border border-border p-4 text-center">
            <p className="text-sm font-semibold text-foreground">부모 빠른 기록 모드로 저장 중이에요</p>
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
            {parentRules.map((r) => (
              <p key={r} className="text-xs leading-snug">
                • {r}
              </p>
            ))}
            {parentRules.length === 0 && (
              <p className="text-xs text-muted-foreground">아직 불러온 가족 규칙이 없어요.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getRecentCareModeRecords(
  records: CareRecord[],
  session: CareSession | null,
): CareRecord[] {
  // 돌봄 세션 중에는 해당 세션 기록만 보여주고, 부모 기록 모드에서는 전체 최신 기록을 보여준다.
  const sessionStartedAt = session ? new Date(session.startedAt).getTime() : null;
  return records
    .filter((record) => {
      if (!session) return true;
      if (record.careSessionId) return record.careSessionId === session.id;
      return sessionStartedAt !== null && new Date(record.recordedAt).getTime() >= sessionStartedAt;
    })
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
    .slice(0, 3);
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
