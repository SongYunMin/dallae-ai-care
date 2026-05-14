import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
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
import { evaluateAgentNotifications, updateAgentNotificationStatus } from '@/lib/api';
import { nowKstIso } from '@/lib/kst';

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

const SCREEN_PATHS: Partial<Record<Screen, string>> = {
  splash: '/',
  onboarding: '/onboarding/parent',
  dashboard: '/dashboard',
  records: '/records',
  recordNew: '/records/new',
  careMode: '/care-mode',
  chat: '/chat',
  notifications: '/notifications',
  family: '/family',
  rules: '/rules',
  checklist: '/checklist',
  thankYouReport: '/reports/latest/thank-you',
};

function screenFromPath(pathname: string): { screen: Screen; payload: unknown } {
  if (pathname === '/') return { screen: 'splash', payload: null };
  if (pathname === '/onboarding/parent') return { screen: 'onboarding', payload: null };
  if (pathname === '/dashboard') return { screen: 'dashboard', payload: null };
  if (pathname === '/records/new') return { screen: 'recordNew', payload: null };
  if (pathname === '/records') return { screen: 'records', payload: null };
  if (pathname === '/care-mode') return { screen: 'careMode', payload: null };
  if (pathname === '/chat') return { screen: 'chat', payload: null };
  if (pathname === '/notifications') return { screen: 'notifications', payload: null };
  if (pathname === '/family') return { screen: 'family', payload: null };
  if (pathname === '/rules') return { screen: 'rules', payload: null };
  if (pathname === '/checklist') return { screen: 'checklist', payload: null };
  const invite = pathname.match(/^\/invite\/([^/]+)$/);
  if (invite) return { screen: 'invite', payload: { token: decodeURIComponent(invite[1]) } };
  const thankYou = pathname.match(/^\/reports\/([^/]+)\/thank-you$/);
  if (thankYou) return { screen: 'thankYouReport', payload: { careSessionId: decodeURIComponent(thankYou[1]) } };
  const report = pathname.match(/^\/reports\/([^/]+)$/);
  if (report) return { screen: 'report', payload: { careSessionId: decodeURIComponent(report[1]) } };
  return { screen: 'dashboard', payload: null };
}

function pathForScreen(screen: Screen, payload?: unknown): string {
  const p = payload as { token?: string; careSessionId?: string } | undefined;
  if (screen === 'invite') return `/invite/${encodeURIComponent(p?.token ?? 'invite_demo123')}`;
  if (screen === 'report') return `/reports/${encodeURIComponent(p?.careSessionId ?? 'latest')}`;
  if (screen === 'thankYouReport') {
    return `/reports/${encodeURIComponent(p?.careSessionId ?? 'latest')}/thank-you`;
  }
  return SCREEN_PATHS[screen] ?? '/dashboard';
}

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

  parentThankYouMessage: string;
  setParentThankYouMessage: (m: string) => void;

  toasts: Toast[];
  toast: (text: string) => void;

  checklist: ChecklistItem[];
  addChecklistItem: (item: Omit<ChecklistItem, 'id' | 'completed' | 'createdBy'>) => void;
  toggleChecklistItem: (id: string) => void;
  removeChecklistItem: (id: string) => void;

  thankYouReports: ThankYouReport[];
  addThankYouReport: (r: ThankYouReport) => void;

  childMood: { emoji: string; label: string; image?: string; at: string } | null;
  setChildMood: (m: { emoji: string; label: string; image?: string } | null) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const routeNavigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
  const [parentThankYouMessage, setParentThankYouMessage] = useState<string>('');
  const [childMood, setChildMoodState] = useState<{ emoji: string; label: string; image?: string; at: string } | null>(null);

  useEffect(() => {
    const next = screenFromPath(pathname);
    setScreen(next.screen);
    setPayload(next.payload);
  }, [pathname]);

  const navigate = useCallback((s: Screen, p?: unknown) => {
    setPayload(p ?? null);
    setScreen((prev) => {
      if (prev !== s && prev !== 'splash' && prev !== 'onboarding') {
        setHistory((h) => [...h, prev]);
      }
      return s;
    });
    routeNavigate({ to: pathForScreen(s, p) });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [routeNavigate]);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = h.slice(0, -1);
      const target = h[h.length - 1];
      setPayload(null);
      setScreen(target);
      routeNavigate({ to: pathForScreen(target) });
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
      return next;
    });
  }, [routeNavigate]);

  const toast = useCallback((text: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const mergeNotifications = useCallback((incoming: AgentNotification[]) => {
    if (incoming.length === 0) return;
    setNotifications((arr) => {
      const seen = new Set(arr.map((n) => n.id));
      const fresh = incoming.filter((n) => !seen.has(n.id));
      return fresh.length === 0 ? arr : [...fresh, ...arr];
    });
  }, []);

  const refreshAgentNotifications = useCallback(() => {
    void evaluateAgentNotifications().then((res) => mergeNotifications(res.notifications));
  }, [mergeNotifications]);

  useEffect(() => {
    refreshAgentNotifications();
  }, [refreshAgentNotifications]);

  // Polling: 체크리스트 시간이 되면 토스트로 푸시 알림
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const checklistRef = useRef(checklist);
  checklistRef.current = checklist;
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const updates = new Map<string, 'notifiedDue' | 'notifiedFollowup'>();
      const messages: string[] = [];
      for (const it of checklistRef.current) {
        if (it.completed) continue;
        const diffMin = (now - itemDateTime(it).getTime()) / 60000;
        if (diffMin >= 0 && !it.notifiedDue) {
          updates.set(it.id, 'notifiedDue');
          messages.push(`🔔 체크리스트 시간이에요 — ${it.label}`);
        } else if (diffMin >= 30 && !it.notifiedFollowup) {
          updates.set(it.id, 'notifiedFollowup');
          messages.push(`⏰ 아직 완료하지 않으셨어요 — ${it.label}`);
        }
      }
      if (updates.size === 0) return;
      setChecklist((arr) =>
        arr.map((it) => {
          const field = updates.get(it.id);
          return field ? { ...it, [field]: true } : it;
        }),
      );
      messages.forEach((m) => toastRef.current(m));
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
    logout: () => {
      setSession(null);
      setLastEnded(null);
      setInvite(null);
      setPendingChatQuestion(null);
      setCurrentUser({ id: 'user_parent_1', name: '엄마', role: 'PARENT_ADMIN' });
      setHistory([]);
      setPayload(null);
      setParentThankYouMessage('');
      setScreen('splash');
      // 라우터 URL까지 초기 화면으로 돌려야 pathname 동기화가 다시 현재 화면을 복구하지 않는다.
      routeNavigate({ to: pathForScreen('splash') });
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
      toast('로그아웃했어요');
    },
    records,
    addRecord: (r) => {
      setRecords((arr) => [r, ...arr]);
      // 기록이 바뀌면 백엔드가 최신 맥락으로 AI 알림 후보를 다시 판단한다.
      refreshAgentNotifications();
    },
    parentRules,
    addRule: (r) => setParentRules((arr) => [...arr, r]),
    notifications,
    setNotificationStatus: (id, status) => {
      setNotifications((arr) => arr.map((n) => (n.id === id ? { ...n, status } : n)));
      void updateAgentNotificationStatus(id, status);
    },
    chatMessages,
    addChatMessage: (m) => setChatMessages((arr) => [...arr, m]),
    pendingChatQuestion,
    setPendingChatQuestion,
    session,
    startSession: (s) => setSession(s),
    endSession: () => {
      if (!session) return null;
      const ended: CareSession = { ...session, status: 'ENDED', endedAt: nowKstIso() };
      setLastEnded(ended);
      setSession(null);
      return ended;
    },
    lastEndedSession,
    invite,
    setInvite,
    parentThankYouMessage,
    setParentThankYouMessage,
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
                completedAt: !it.completed ? nowKstIso() : undefined,
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
    childMood,
    setChildMood: (m) =>
      setChildMoodState(m ? { ...m, at: nowKstIso() } : null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}
