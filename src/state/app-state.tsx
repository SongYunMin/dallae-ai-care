import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type {
  AgentNotification,
  CareRecord,
  CareSession,
  ChatMessage,
  ChecklistItem,
  FamilyMember,
  ThankYouReport,
  UserRole,
} from '@/lib/types';
import {
  MOCK_CHILD,
  MOCK_FAMILY_MEMBERS,
  MOCK_NOTIFICATIONS,
  MOCK_RECORDS,
  PARENT_RULES,
} from '@/lib/mock-data';
import { itemDateTime, makeMockChecklist } from '@/lib/checklist';

export type Screen =
  | 'splash'
  | 'onboarding'
  | 'dashboard'
  | 'records'
  | 'recordNew'
  | 'careMode'
  | 'chat'
  | 'notifications'
  | 'family'
  | 'invite'
  | 'rules'
  | 'report'
  | 'thankYouReport'
  | 'checklist';

type Toast = { id: string; text: string };

type AppState = {
  screen: Screen;
  navigate: (s: Screen, payload?: unknown) => void;
  goBack: () => void;
  canGoBack: boolean;
  payload: unknown;

  child: typeof MOCK_CHILD;
  familyMembers: FamilyMember[];
  currentUser: { id: string; name: string; role: UserRole };
  setCurrentUser: (u: { id: string; name: string; role: UserRole }) => void;
  logout: () => void;

  records: CareRecord[];
  addRecord: (r: CareRecord) => void;

  parentRules: string[];
  addRule: (r: string) => void;

  notifications: AgentNotification[];
  setNotificationStatus: (id: string, status: AgentNotification['status']) => void;

  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  pendingChatQuestion: string | null;
  setPendingChatQuestion: (q: string | null) => void;

  session: CareSession | null;
  startSession: (s: CareSession) => void;
  endSession: () => CareSession | null;
  lastEndedSession: CareSession | null;

  invite: { token: string; url: string } | null;
  setInvite: (i: { token: string; url: string } | null) => void;

  toasts: Toast[];
  toast: (text: string) => void;

  checklist: ChecklistItem[];
  addChecklistItem: (item: Omit<ChecklistItem, 'id' | 'completed' | 'createdBy'>) => void;
  toggleChecklistItem: (id: string) => void;
  removeChecklistItem: (id: string) => void;

  thankYouReports: ThankYouReport[];
  addThankYouReport: (r: ThankYouReport) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('splash');
  const [history, setHistory] = useState<Screen[]>([]);
  const [payload, setPayload] = useState<unknown>(null);
  const [child] = useState(MOCK_CHILD);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(MOCK_FAMILY_MEMBERS);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: UserRole }>({
    id: 'user_parent_1',
    name: '엄마',
    role: 'PARENT_ADMIN',
  });
  const [records, setRecords] = useState<CareRecord[]>(MOCK_RECORDS);
  const [parentRules, setParentRules] = useState<string[]>(PARENT_RULES);
  const [notifications, setNotifications] = useState<AgentNotification[]>(MOCK_NOTIFICATIONS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingChatQuestion, setPendingChatQuestion] = useState<string | null>(null);
  const [session, setSession] = useState<CareSession | null>(null);
  const [lastEndedSession, setLastEnded] = useState<CareSession | null>(null);
  const [invite, setInvite] = useState<{ token: string; url: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => makeMockChecklist('user_parent_1'));
  const [thankYouReports, setThankYouReports] = useState<ThankYouReport[]>([]);

  const navigate = useCallback((s: Screen, p?: unknown) => {
    setPayload(p ?? null);
    setScreen((prev) => {
      if (prev !== s && prev !== 'splash' && prev !== 'onboarding') {
        setHistory((h) => [...h, prev]);
      }
      return s;
    });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = h.slice(0, -1);
      const target = h[h.length - 1];
      setPayload(null);
      setScreen(target);
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
      return next;
    });
  }, []);

  const toast = useCallback((text: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  // Polling: 체크리스트 시간이 되면 토스트로 푸시 알림
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setChecklist((arr) => {
        let changed = false;
        const next = arr.map((it) => {
          if (it.completed) return it;
          const due = itemDateTime(it);
          const diffMin = (now.getTime() - due.getTime()) / 60000;
          if (diffMin >= 0 && !it.notifiedDue) {
            toastRef.current(`🔔 체크리스트 시간이에요 — ${it.label}`);
            changed = true;
            return { ...it, notifiedDue: true };
          }
          if (diffMin >= 30 && !it.notifiedFollowup) {
            toastRef.current(`⏰ 아직 완료하지 않으셨어요 — ${it.label}`);
            changed = true;
            return { ...it, notifiedFollowup: true };
          }
          return it;
        });
        return changed ? next : arr;
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const value: AppState = {
    screen,
    payload,
    navigate,
    goBack,
    canGoBack: history.length > 0,
    child,
    familyMembers,
    currentUser,
    setCurrentUser: (u) => {
      setCurrentUser(u);
      // also add to family if not present
      setFamilyMembers((arr) => (arr.find((a) => a.id === u.id) ? arr : [...arr, { id: u.id, name: u.name, relationship: '돌봄자', role: u.role }]));
    },
    records,
    addRecord: (r) => setRecords((arr) => [r, ...arr]),
    parentRules,
    addRule: (r) => setParentRules((arr) => [...arr, r]),
    notifications,
    setNotificationStatus: (id, status) =>
      setNotifications((arr) => arr.map((n) => (n.id === id ? { ...n, status } : n))),
    chatMessages,
    addChatMessage: (m) => setChatMessages((arr) => [...arr, m]),
    pendingChatQuestion,
    setPendingChatQuestion,
    session,
    startSession: (s) => setSession(s),
    endSession: () => {
      if (!session) return null;
      const ended: CareSession = { ...session, status: 'ENDED', endedAt: new Date().toISOString() };
      setLastEnded(ended);
      setSession(null);
      return ended;
    },
    lastEndedSession,
    invite,
    setInvite,
    toasts,
    toast,
    checklist,
    addChecklistItem: (item) =>
      setChecklist((arr) =>
        [
          ...arr,
          {
            ...item,
            id: `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            completed: false,
            createdBy: currentUser.id,
          },
        ].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
      ),
    toggleChecklistItem: (id) =>
      setChecklist((arr) =>
        arr.map((it) =>
          it.id === id
            ? {
                ...it,
                completed: !it.completed,
                completedAt: !it.completed ? new Date().toISOString() : undefined,
                completedBy: !it.completed ? currentUser.name : undefined,
              }
            : it,
        ),
      ),
    removeChecklistItem: (id) => setChecklist((arr) => arr.filter((it) => it.id !== id)),
    thankYouReports,
    addThankYouReport: (r) => {
      setThankYouReports((arr) => [r, ...arr]);
      // 수신자 알림함에 푸시 (시뮬레이션)
      const noti: AgentNotification = {
        id: `noti_thx_${r.id}`,
        type: 'THANK_YOU',
        title: `${r.fromUserName}님이 수고리포트를 보냈어요`,
        message: r.message,
        evidence: `${r.durationLabel} 돌봄 · 수유 ${r.counts.feeding}회 · 기저귀 ${r.counts.diaper}회 · 낮잠 ${r.counts.sleep}회`,
        priority: 'MEDIUM',
        status: 'UNREAD',
        createdAt: r.sentAt,
      };
      setNotifications((arr) => [noti, ...arr]);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}
