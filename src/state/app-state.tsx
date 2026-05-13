import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  AgentNotification,
  CareRecord,
  CareSession,
  ChatMessage,
  FamilyMember,
  UserRole,
} from '@/lib/types';
import {
  MOCK_CHILD,
  MOCK_FAMILY_MEMBERS,
  MOCK_NOTIFICATIONS,
  MOCK_RECORDS,
  PARENT_RULES,
} from '@/lib/mock-data';

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
  | 'report';

type Toast = { id: string; text: string };

type AppState = {
  screen: Screen;
  navigate: (s: Screen, payload?: unknown) => void;
  payload: unknown;

  child: typeof MOCK_CHILD;
  familyMembers: FamilyMember[];
  currentUser: { id: string; name: string; role: UserRole };
  setCurrentUser: (u: { id: string; name: string; role: UserRole }) => void;

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
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('splash');
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

  const navigate = useCallback((s: Screen, p?: unknown) => {
    setPayload(p ?? null);
    setScreen(s);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  const toast = useCallback((text: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const value: AppState = {
    screen,
    payload,
    navigate,
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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}
