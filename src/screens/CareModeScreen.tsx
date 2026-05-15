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
  transcribeSpeech,
} from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/date";
import { itemDateTime, todayKey, formatItemTime } from "@/lib/checklist";
import { careLogoutButtonState } from "@/lib/care-mode-menu";
import { getRecentCareModeRecords } from "@/lib/care-mode-records";
import { saveFinalThankYouReport } from "@/lib/thank-you-report";
import type { CareRecord, CareRecordType, CareSession, ChecklistItem } from "@/lib/types";
import { nowKstIso } from "@/lib/kst";
import { LogOut, Mic, Send, X } from "lucide-react";
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
  isFinal?: boolean;
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

function hasFinalSpeechResult(results: ArrayLike<SpeechRecognitionResultLike>): boolean {
  return Array.from(results).some((result) => result.isFinal);
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  return (
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
      .webkitSpeechRecognition
  );
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

type MicrophoneRequest = {
  stream: MediaStream | null;
  error: string | null;
};

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function preferredRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

async function requestMicrophoneStream(): Promise<MicrophoneRequest> {
  if (typeof window === "undefined") return { stream: null, error: "음성 인식은 브라우저에서만 사용할 수 있어요." };
  if (!window.isSecureContext) {
    return { stream: null, error: "마이크는 HTTPS 또는 localhost 주소에서만 사용할 수 있어요. 배포 주소나 localhost로 열어 주세요." };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null, error: "이 브라우저는 마이크 권한 확인을 지원하지 않아요. Chrome에서 다시 시도해 주세요." };
  }

  try {
    // 서버 전사 fallback과 브라우저 권한 확인 모두 같은 마이크 스트림을 사용한다.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { stream, error: null };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return { stream: null, error: "마이크 권한이 차단돼 있어요. 주소창의 사이트 설정에서 마이크를 허용해 주세요." };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { stream: null, error: "사용 가능한 마이크를 찾지 못했어요. 기기 마이크 연결 상태를 확인해 주세요." };
    }
    return { stream: null, error: "마이크를 시작하지 못했어요. 브라우저 권한과 기기 마이크 상태를 확인해 주세요." };
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
    logout,
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
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [endingCare, setEndingCare] = useState(false);
  const isParent = currentUser.role === "PARENT_ADMIN" || currentUser.role === "PARENT_EDITOR";
  const canWriteRecords = currentUser.role !== "CAREGIVER_VIEWER";
  const recordsRef = useRef(records);
  const endingCareRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveSpeechTextRef = useRef("");
  const finalSpeechTextRef = useRef("");
  const logoutState = careLogoutButtonState({ endingCare, hasActiveSession: Boolean(session) });
  const onLogoutToHome = () => {
    if (typeof window !== "undefined" && !window.confirm(logoutState.confirmMessage)) return;
    logout();
  };

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
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
    };
  }, []);

  if (!session && !isParent) {
    const viewerCopy = currentUser.role === "CAREGIVER_VIEWER" ? "조회 전용 돌봄 참여로 아이 상태를 확인할 수 있어요" : "지금 아이를 돌보는 분이 사용해요";
    return (
      <div className="px-5 pt-8 pb-6 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">돌봄 모드</h1>
            <p className="text-xs text-muted-foreground mt-1">{viewerCopy}</p>
          </div>
          <button
            onClick={onLogoutToHome}
            disabled={logoutState.disabled}
            aria-label={logoutState.ariaLabel}
            className="h-9 px-3 rounded-full bg-card border border-border text-xs font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-60"
          >
            <LogOut size={14} /> {logoutState.label}
          </button>
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

  const stopVoiceCapture = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }
    recognitionRef.current?.stop();
    setListening(false);
  };

  const startBrowserSpeechRecognition = (showErrors: boolean) => {
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = collectSpeechTranscript(event.results);
      if (!transcript) return;
      liveSpeechTextRef.current = transcript;
      setText(transcript);
      if (hasFinalSpeechResult(event.results)) finalSpeechTextRef.current = transcript;
    };
    recognition.onerror = (event) => {
      console.warn("[CareMode] speech recognition error", event.error, event.message);
      if (showErrors) toast(speechRecognitionErrorMessage(event.error, event.message));
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      if (showErrors) toast("음성 인식을 시작하지 못했어요. 브라우저 권한을 확인해 주세요.");
      return false;
    }
  };

  const startServerTranscription = (stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") return false;
    const mimeType = preferredRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      return false;
    }
    audioChunksRef.current = [];
    liveSpeechTextRef.current = "";
    finalSpeechTextRef.current = "";
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      toast("녹음 중 오류가 났어요. 텍스트로 입력해 주세요.");
      mediaRecorderRef.current = null;
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      setListening(false);
      setTranscribingVoice(false);
    };
    recorder.onstop = async () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      setListening(false);

      if (!audio.size) {
        toast("녹음된 음성이 없어요. 다시 한 번 말해 주세요.");
        return;
      }

      const finalTranscript = finalSpeechTextRef.current.trim();
      if (finalTranscript) {
        setText(finalTranscript);
        toast("음성을 텍스트로 옮겼어요.");
        return;
      }

      setTranscribingVoice(true);
      if (liveSpeechTextRef.current.trim()) setText(liveSpeechTextRef.current.trim());
      try {
        // 브라우저 인식이 실패하거나 최종 결과가 없을 때만 서버에서 녹음 파일을 보정 전사한다.
        const result = await transcribeSpeech(audio);
        setText(result.text);
        toast("음성을 텍스트로 옮겼어요.");
      } catch (err) {
        toast(err instanceof Error ? `서버 음성 인식 실패: ${err.message}` : "서버 음성 인식에 실패했어요.");
      } finally {
        setTranscribingVoice(false);
      }
    };

    try {
      recorder.start();
    } catch {
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      audioChunksRef.current = [];
      return false;
    }
    setListening(true);
    startBrowserSpeechRecognition(false);
    toast("말씀해 주세요. 끝나면 마이크 버튼을 한 번 더 눌러주세요.");
    return true;
  };

  const onVoiceRecord = async () => {
    if (!canWriteRecords) {
      toast("조회 전용 권한이라 기록할 수 없어요.");
      return;
    }
    if (listening) {
      stopVoiceCapture();
      return;
    }
    if (transcribingVoice) {
      return;
    }
    const microphone = await requestMicrophoneStream();
    if (microphone.error || !microphone.stream) {
      toast(microphone.error ?? "마이크를 시작하지 못했어요.");
      return;
    }

    if (startServerTranscription(microphone.stream)) {
      return;
    }
    stopMediaStream(microphone.stream);

    if (!getSpeechRecognitionCtor()) {
      toast("이 브라우저는 음성 인식을 지원하지 않아요. 아래 칸에 말한 내용을 적어주세요.");
      return;
    }

    if (startBrowserSpeechRecognition(true)) setListening(true);
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
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={onLogoutToHome}
              disabled={logoutState.disabled}
              aria-label={logoutState.ariaLabel}
              className="h-9 px-3 rounded-full bg-card/80 border border-border text-xs font-semibold flex items-center gap-1.5 shadow-card disabled:opacity-60"
            >
              <LogOut size={14} /> {logoutState.label}
            </button>
            <IonMascot variant="wink" size={64} />
          </div>
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
              disabled={!canWriteRecords || transcribingVoice}
              className={`h-12 w-12 rounded-full text-primary-foreground flex items-center justify-center shadow-soft shrink-0 ${
                listening || transcribingVoice ? "bg-coral animate-pulse" : "bg-primary"
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
              if (endingCareRef.current) return;
              if (
                typeof window !== "undefined" &&
                !window.confirm("돌봄을 종료할까요? 부모님께 감사 메시지가 전달돼요.")
              )
                return;
              const activeSession = session;
              if (!activeSession) return;
              endingCareRef.current = true;
              setEndingCare(true);
              let completed = false;
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
                const durationLabel = formatDuration(localEnded.startedAt, localEnded.endedAt);
                const { savedReport, usedFallbackMessage } = await saveFinalThankYouReport({
                  ended: localEnded,
                  childName: child.name,
                  durationLabel,
                  parentThankYouMessage,
                  counts,
                  composeMessage: createThankYouMessage,
                  saveReport: addThankYouReport,
                  nowIso: nowKstIso,
                });
                if (!savedReport) return;
                endSession();
                if (usedFallbackMessage && !localEnded.thankYouMessage && !parentThankYouMessage.trim()) {
                  toast("AI 감사 메시지를 생성하지 못해 기본 메시지를 저장했어요.");
                }
                completed = true;
                navigate("thankYouReport", { careSessionId: localEnded.id });
              } catch (err) {
                toast(err instanceof Error ? `돌봄 종료 실패: ${err.message}` : "돌봄 종료 상태를 저장하지 못했어요");
              } finally {
                if (!completed) {
                  endingCareRef.current = false;
                  setEndingCare(false);
                }
              }
            }}
            disabled={endingCare}
            className="w-full h-14 rounded-2xl bg-coral text-coral-foreground font-semibold shadow-soft disabled:opacity-70"
          >
            {endingCare ? "수고 리포트 만드는 중..." : "돌봄 종료하기"}
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
