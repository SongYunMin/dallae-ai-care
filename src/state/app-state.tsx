import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type {
  AgentNotification,
  CareRecord,
  CareRecordPatch,
  CareSession,
  ChatMessage,
  ChecklistItem,
  Child,
  ChildPatch,
  FamilyMember,
  FamilyMemberPatch,
  ThankYouReport,
  UserRole,
} from '@/lib/types';
import {
  DEMO_ACTIVE_RULES,
  DEFAULT_RULES,
  MOCK_CHILD,
  MOCK_FAMILY_MEMBERS,
  MOCK_NOTIFICATIONS,
  MOCK_RECORDS,
  PARENT_RULES,
} from '@/lib/mock-data';
import { collectChecklistNotificationUpdates, makeMockChecklist } from '@/lib/checklist';
import {
  DEFAULT_CHILD_ID,
  DEFAULT_FAMILY_ID,
  DEFAULT_PARENT_ID,
  createChecklistItem as createChecklistItemApi,
  createChecklistNotification,
  createRule,
  deleteCareRecord as deleteCareRecordApi,
  deleteChecklistItem as deleteChecklistItemApi,
  deleteFamilyMember as deleteFamilyMemberApi,
  deleteRule as deleteRuleApi,
  evaluateAgentNotifications,
  getChildStatus,
  listAgentNotifications,
  listCareRecords,
  listChecklistItems,
  listFamilyMembers,
  listRules,
  saveThankYouReport,
  updateAgentNotificationStatus,
  updateCareRecord as updateCareRecordApi,
  updateChecklistItem as updateChecklistItemApi,
  updateChild as updateChildApi,
  updateFamilyMember as updateFamilyMemberApi,
  updateRule as updateRuleApi,
  type ParentOnboardingResult,
} from '@/lib/api';
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

const DEMO_STORAGE_KEY = 'dallae.demoMode';

const EMPTY_CHILD: Child = {
  id: DEFAULT_CHILD_ID,
  familyId: DEFAULT_FAMILY_ID,
  name: '아이',
  ageInMonths: 0,
  birthDate: '',
  feedingType: 'FORMULA',
};

const DEFAULT_PARENT = {
  id: DEFAULT_PARENT_ID,
  name: '엄마',
  role: 'PARENT_ADMIN' as UserRole,
};

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
  if (screen === 'invite') return `/invite/${encodeURIComponent(p?.token ?? 'missing')}`;
  if (screen === 'report') return `/reports/${encodeURIComponent(p?.careSessionId ?? 'latest')}`;
  if (screen === 'thankYouReport') {
    return `/reports/${encodeURIComponent(p?.careSessionId ?? 'latest')}/thank-you`;
  }
  return SCREEN_PATHS[screen] ?? '/dashboard';
}

function sortRecords(records: CareRecord[]): CareRecord[] {
  return [...records].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
}

function sortChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => (a.date + a.time + a.id).localeCompare(b.date + b.time + b.id));
}

function upsertRecord(records: CareRecord[], record: CareRecord): CareRecord[] {
  // 같은 서버 ID를 다시 받는 경우 기존 항목을 교체해 화면 중복과 통계 중복을 막는다.
  return sortRecords([record, ...records.filter((item) => item.id !== record.id)]);
}

function upsertThankYouReport(reports: ThankYouReport[], report: ThankYouReport): ThankYouReport[] {
  return [report, ...reports.filter((item) => item.sessionId !== report.sessionId)];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '요청을 처리하지 못했어요.';
}

type AppState = {
  screen: Screen;
  navigate: (s: Screen, payload?: unknown) => void;
  goBack: () => void;
  canGoBack: boolean;
  payload: unknown;

  demoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  isBootstrapping: boolean;
  loadError: string | null;

  child: Child;
  updateChild: (patch: ChildPatch) => Promise<void>;
  familyMembers: FamilyMember[];
  updateFamilyMember: (id: string, patch: FamilyMemberPatch) => Promise<void>;
  deleteFamilyMember: (id: string) => Promise<void>;
  currentUser: { id: string; name: string; role: UserRole };
  setCurrentUser: (u: { id: string; name: string; role: UserRole }) => void;
  applyOnboardingResult: (result: ParentOnboardingResult) => void;
  logout: () => void;

  records: CareRecord[];
  addRecord: (r: CareRecord) => void;
  updateRecord: (id: string, patch: CareRecordPatch) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;

  parentRules: string[];
  editableParentRules: string[];
  addRule: (r: string) => Promise<void>;
  updateRule: (index: number, text: string) => Promise<void>;
  deleteRule: (index: number) => Promise<void>;

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
  addThankYouReport: (r: ThankYouReport) => Promise<ThankYouReport | null>;

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
  const [demoMode, setDemoMode] = useState(() =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem(DEMO_STORAGE_KEY) === '1' : false,
  );
  const [isBootstrapping, setIsBootstrapping] = useState(() =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem(DEMO_STORAGE_KEY) !== '1' : true,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [child, setChild] = useState<Child>(EMPTY_CHILD);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUserState] = useState<{ id: string; name: string; role: UserRole }>(DEFAULT_PARENT);
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [parentRules, setParentRules] = useState<string[]>([]);
  const [editableParentRules, setEditableParentRules] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingChatQuestion, setPendingChatQuestion] = useState<string | null>(null);
  const [session, setSession] = useState<CareSession | null>(null);
  const [lastEndedSession, setLastEnded] = useState<CareSession | null>(null);
  const [invite, setInvite] = useState<{ token: string; url: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
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

  const applyDemoState = useCallback(() => {
    setLoadError(null);
    setIsBootstrapping(false);
    setSession(null);
    setLastEnded(null);
    setInvite(null);
    setChatMessages([]);
    setPendingChatQuestion(null);
    setParentThankYouMessage('');
    setChildMoodState(null);
    setChild(MOCK_CHILD);
    setFamilyMembers(MOCK_FAMILY_MEMBERS);
    setCurrentUserState(DEFAULT_PARENT);
    setRecords(sortRecords(MOCK_RECORDS));
    setParentRules(DEMO_ACTIVE_RULES);
    setEditableParentRules(PARENT_RULES);
    setNotifications(MOCK_NOTIFICATIONS);
    setChecklist(makeMockChecklist(DEFAULT_PARENT_ID));
    setThankYouReports([]);
  }, []);

  useEffect(() => {
    let active = true;
    if (demoMode) {
      applyDemoState();
      return () => {
        active = false;
      };
    }

    setIsBootstrapping(true);
    setLoadError(null);
    Promise.all([
      getChildStatus(DEFAULT_CHILD_ID),
      listRules(DEFAULT_CHILD_ID),
      listFamilyMembers(DEFAULT_FAMILY_ID),
      listCareRecords(DEFAULT_CHILD_ID),
      listAgentNotifications(DEFAULT_CHILD_ID),
      listChecklistItems(DEFAULT_CHILD_ID),
    ])
      .then(([status, rules, members, loadedRecords, loadedNotifications, loadedChecklist]) => {
        if (!active) return;
        const parent = members.find((member) => member.role === 'PARENT_ADMIN') ?? members[0];
        setChild(status.child);
        setParentRules(rules.rules.length > 0 ? rules.rules : status.activeRules);
        setEditableParentRules(rules.parentRules);
        setFamilyMembers(members);
        setCurrentUserState(parent ? { id: parent.id, name: parent.name, role: parent.role } : DEFAULT_PARENT);
        setRecords(sortRecords(loadedRecords));
        setNotifications(loadedNotifications);
        setChecklist(loadedChecklist);
      })
      .catch((err) => {
        if (!active) return;
        setChild(EMPTY_CHILD);
        setFamilyMembers([]);
        setRecords([]);
        setParentRules([]);
        setEditableParentRules([]);
        setNotifications([]);
        setChecklist([]);
        setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (active) setIsBootstrapping(false);
      });

    return () => {
      active = false;
    };
  }, [applyDemoState, demoMode]);

  const refreshAgentNotifications = useCallback(() => {
    if (demoMode || loadError) return;
    void evaluateAgentNotifications(currentUser.id, child.id)
      .then((res) => mergeNotifications(res.notifications))
      .catch(() => {
        toast('AI 알림을 새로 계산하지 못했어요');
      });
  }, [child.id, currentUser.id, demoMode, loadError, mergeNotifications, toast]);

  useEffect(() => {
    if (!isBootstrapping) refreshAgentNotifications();
  }, [isBootstrapping, refreshAgentNotifications]);

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const checklistRef = useRef(checklist);
  checklistRef.current = checklist;
  useEffect(() => {
    const tick = () => {
      const updates = collectChecklistNotificationUpdates(checklistRef.current);
      if (updates.length === 0) return;

      const fieldById = new Map(updates.map((update) => [update.id, update.field]));
      setChecklist((arr) =>
        arr.map((it) => {
          const field = fieldById.get(it.id);
          return field ? { ...it, [field]: true } : it;
        }),
      );
      updates.forEach((update) => {
        const phase = update.field === 'notifiedDue' ? 'due' : 'followup';
        if (demoMode) {
          mergeNotifications([update.notification]);
          toastRef.current(update.toast);
          return;
        }

        void createChecklistNotification(update.id, phase)
          .then((notification) => {
            mergeNotifications([notification]);
            toastRef.current(update.toast);
          })
          .catch(() => {
            // 서버에 알림을 만들지 못하면 로컬 알림을 대신 쌓지 않고 플래그도 되돌린다.
            setChecklist((arr) =>
              arr.map((it) => (it.id === update.id ? { ...it, [update.field]: false } : it)),
            );
            toastRef.current('체크리스트 알림을 백엔드에 저장하지 못했어요');
          });
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [demoMode, mergeNotifications]);

  const setCurrentUser = useCallback((u: { id: string; name: string; role: UserRole }) => {
    setCurrentUserState(u);
    setFamilyMembers((arr) =>
      arr.find((a) => a.id === u.id)
        ? arr
        : [...arr, { id: u.id, name: u.name, relationship: '돌봄자', role: u.role }],
    );
  }, []);

  const exitDemoMode = useCallback(() => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(DEMO_STORAGE_KEY);
    setDemoMode(false);
  }, []);

  const enterDemoMode = useCallback(() => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(DEMO_STORAGE_KEY, '1');
    setDemoMode(true);
    applyDemoState();
  }, [applyDemoState]);

  const value: AppState = {
    screen,
    payload,
    navigate,
    goBack,
    canGoBack: history.length > 0,
    demoMode,
    enterDemoMode,
    exitDemoMode,
    isBootstrapping,
    loadError,
    child,
    updateChild: async (patch) => {
      const previous = child;
      setChild((current) => ({ ...current, ...patch }));
      if (demoMode) return;
      try {
        const saved = await updateChildApi(child.id, patch, currentUser.id);
        setChild(saved);
      } catch (err) {
        setChild(previous);
        toast(`아이 정보를 저장하지 못했어요: ${errorMessage(err)}`);
        throw err;
      }
    },
    familyMembers,
    updateFamilyMember: async (id, patch) => {
      const previousMembers = familyMembers;
      const previousCurrentUser = currentUser;
      const previousSession = session;
      setFamilyMembers((arr) => arr.map((member) => (member.id === id ? { ...member, ...patch } : member)));
      if (currentUser.id === id) {
        setCurrentUserState((user) => ({
          id: user.id,
          name: patch.name ?? user.name,
          role: patch.role ?? user.role,
        }));
      }
      if (session?.caregiverId === id) {
        setSession((item) =>
          item
            ? {
                ...item,
                caregiverName: patch.name ?? item.caregiverName,
                relationship: patch.relationship ?? item.relationship,
              }
            : item,
        );
      }
      if (demoMode) return;
      try {
        const saved = await updateFamilyMemberApi(id, patch, currentUser.id);
        setFamilyMembers((arr) => arr.map((member) => (member.id === id ? saved : member)));
        if (currentUser.id === id) {
          setCurrentUserState({ id: saved.id, name: saved.name, role: saved.role });
        }
      } catch (err) {
        setFamilyMembers(previousMembers);
        setCurrentUserState(previousCurrentUser);
        setSession(previousSession);
        toast(`가족 구성원 정보를 저장하지 못했어요: ${errorMessage(err)}`);
        throw err;
      }
    },
    deleteFamilyMember: async (id) => {
      const previousMembers = familyMembers;
      setFamilyMembers((arr) => arr.filter((member) => member.id !== id));
      if (demoMode) return;
      try {
        await deleteFamilyMemberApi(id, currentUser.id);
      } catch (err) {
        setFamilyMembers(previousMembers);
        toast(`가족 구성원을 삭제하지 못했어요: ${errorMessage(err)}`);
        throw err;
      }
    },
    currentUser,
    setCurrentUser,
    applyOnboardingResult: (result) => {
      setChild(result.child);
      setCurrentUserState({ id: result.userId, name: result.member.name, role: result.role });
      setFamilyMembers((arr) => [result.member, ...arr.filter((member) => member.id !== result.member.id)]);
      setParentRules(result.activeRules);
      setEditableParentRules(result.child.careNotes ? [result.child.careNotes] : []);
      setLoadError(null);
    },
    logout: () => {
      exitDemoMode();
      setSession(null);
      setLastEnded(null);
      setInvite(null);
      setPendingChatQuestion(null);
      setCurrentUserState(DEFAULT_PARENT);
      setHistory([]);
      setPayload(null);
      setParentThankYouMessage('');
      setScreen('splash');
      routeNavigate({ to: pathForScreen('splash') });
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
      toast('로그아웃했어요');
    },
    records,
    addRecord: (r) => {
      setRecords((arr) => upsertRecord(arr, r));
      refreshAgentNotifications();
    },
    updateRecord: async (id, patch) => {
      const previous = records;
      setRecords((arr) => sortRecords(arr.map((record) => (record.id === id ? { ...record, ...patch } : record))));
      if (demoMode) return;
      try {
        const saved = await updateCareRecordApi(id, patch, currentUser.id);
        setRecords((arr) => upsertRecord(arr, saved));
        refreshAgentNotifications();
      } catch (err) {
        setRecords(previous);
        toast(`기록을 수정하지 못했어요: ${errorMessage(err)}`);
        throw err;
      }
    },
    deleteRecord: async (id) => {
      const previous = records;
      setRecords((arr) => arr.filter((record) => record.id !== id));
      if (demoMode) return;
      try {
        await deleteCareRecordApi(id, currentUser.id);
        refreshAgentNotifications();
      } catch (err) {
        setRecords(previous);
        toast(`기록을 삭제하지 못했어요: ${errorMessage(err)}`);
        throw err;
      }
    },
    parentRules,
    editableParentRules,
    addRule: async (r) => {
      if (demoMode) {
        setEditableParentRules((arr) => (arr.includes(r) ? arr : [...arr, r]));
        setParentRules((arr) => (arr.includes(r) ? arr : [...arr, r]));
        return;
      }
      const rules = await createRule(r, child.id);
      setParentRules(rules.rules);
      setEditableParentRules(rules.parentRules);
    },
    updateRule: async (index, text) => {
      const previousActive = parentRules;
      const previousEditable = editableParentRules;
      const nextEditable = editableParentRules.map((rule, idx) => (idx === index ? text : rule));
      setEditableParentRules(nextEditable);
      setParentRules(demoMode ? [...DEFAULT_RULES, ...nextEditable] : parentRules.map((rule) => (rule === previousEditable[index] ? text : rule)));
      if (demoMode) return;
      try {
        const saved = await updateRuleApi(index, text, child.id, currentUser.id);
        setParentRules(saved.rules);
        setEditableParentRules(saved.parentRules);
      } catch (err) {
        setParentRules(previousActive);
        setEditableParentRules(previousEditable);
        toast(`규칙을 수정하지 못했어요: ${errorMessage(err)}`);
        throw err;
      }
    },
    deleteRule: async (index) => {
      const previousActive = parentRules;
      const previousEditable = editableParentRules;
      const nextEditable = editableParentRules.filter((_, idx) => idx !== index);
      setEditableParentRules(nextEditable);
      setParentRules(demoMode ? [...DEFAULT_RULES, ...nextEditable] : parentRules.filter((rule) => rule !== previousEditable[index]));
      if (demoMode) return;
      try {
        const saved = await deleteRuleApi(index, child.id, currentUser.id);
        setParentRules(saved.rules);
        setEditableParentRules(saved.parentRules);
      } catch (err) {
        setParentRules(previousActive);
        setEditableParentRules(previousEditable);
        toast(`규칙을 삭제하지 못했어요: ${errorMessage(err)}`);
        throw err;
      }
    },
    notifications,
    setNotificationStatus: (id, status) => {
      const previous = notifications.find((n) => n.id === id)?.status;
      setNotifications((arr) => arr.map((n) => (n.id === id ? { ...n, status } : n)));
      if (demoMode) return;
      void updateAgentNotificationStatus(id, status).catch(() => {
        if (previous) {
          setNotifications((arr) => arr.map((n) => (n.id === id ? { ...n, status: previous } : n)));
        }
        toast('알림 상태를 백엔드에 저장하지 못했어요');
      });
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
    addChecklistItem: (item) => {
      const localItem: ChecklistItem = {
        ...item,
        id: `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        familyId: DEFAULT_FAMILY_ID,
        childId: child.id,
        completed: false,
        createdBy: currentUser.id,
        createdByRole: currentUser.role,
      };
      setChecklist((arr) => sortChecklist([...arr, localItem]));
      if (demoMode) return;
      void createChecklistItemApi(localItem, child.id)
        .then((saved) => {
          setChecklist((arr) => arr.map((it) => (it.id === localItem.id ? saved : it)));
        })
        .catch(() => {
          setChecklist((arr) => arr.filter((it) => it.id !== localItem.id));
          toast('체크리스트를 백엔드에 저장하지 못했어요');
        });
    },
    toggleChecklistItem: (id) => {
      const target = checklistRef.current.find((it) => it.id === id);
      if (!target) return;
      const completed = !target.completed;
      const patch = {
        completed,
        completedAt: completed ? nowKstIso() : null,
        completedBy: completed ? currentUser.name : null,
      };
      setChecklist((arr) =>
        arr.map((it) =>
          it.id === id
            ? {
                ...it,
                completed,
                completedAt: patch.completedAt,
                completedBy: patch.completedBy,
              }
            : it,
        ),
      );
      if (demoMode) return;
      void updateChecklistItemApi(id, patch)
        .then((saved) => {
          setChecklist((arr) => arr.map((it) => (it.id === id ? saved : it)));
        })
        .catch(() => {
          setChecklist((arr) => arr.map((it) => (it.id === id ? target : it)));
          toast('체크리스트 완료 상태를 백엔드에 저장하지 못했어요');
        });
    },
    removeChecklistItem: (id) => {
      const removed = checklistRef.current.find((it) => it.id === id);
      setChecklist((arr) => arr.filter((it) => it.id !== id));
      if (demoMode) return;
      void deleteChecklistItemApi(id).catch(() => {
        if (removed) setChecklist((arr) => sortChecklist([...arr, removed]));
        toast('체크리스트 삭제를 백엔드에 저장하지 못했어요');
      });
    },
    thankYouReports,
    addThankYouReport: async (r) => {
      if (demoMode) {
        setThankYouReports((arr) => upsertThankYouReport(arr, r));
        return r;
      }
      try {
        const saved = await saveThankYouReport(r);
        setThankYouReports((arr) => upsertThankYouReport(arr, saved));
        const noti: AgentNotification = {
          id: `noti_thx_${saved.sessionId}`,
          type: 'THANK_YOU',
          title: '수고리포트가 도착했어요',
          message: saved.message,
          evidence: `${saved.durationLabel} 돌봄 · 수유 ${saved.counts.feeding}회 · 기저귀 ${saved.counts.diaper}회 · 낮잠 ${saved.counts.sleep}회`,
          priority: 'MEDIUM',
          status: 'UNREAD',
          createdAt: saved.sentAt,
        };
        setNotifications((arr) => [noti, ...arr.filter((item) => item.id !== noti.id)]);
        return saved;
      } catch (err) {
        toast(`수고리포트를 저장하지 못했어요: ${errorMessage(err)}`);
        return null;
      }
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
