import type {
  AgentCareResponse,
  AgentNotification,
  CareRecord,
  CareRecordType,
  Invite,
  RecordSource,
  UserRole,
} from './types';

const FALLBACK_FAMILY_ID = 'family_1';
const FALLBACK_CHILD_ID = 'child_1';
const FALLBACK_PARENT_ID = 'user_parent_1';
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8000';

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function createLocalRecord(input: {
  type: CareRecordType;
  amountMl?: number;
  memo?: string;
  recordedBy: string;
  recordedByName?: string;
  source: RecordSource;
  careSessionId?: string;
}): CareRecord {
  return {
    id: 'rec_' + Math.random().toString(36).slice(2, 8),
    familyId: FALLBACK_FAMILY_ID,
    childId: FALLBACK_CHILD_ID,
    careSessionId: input.careSessionId,
    type: input.type,
    recordedAt: new Date().toISOString(),
    amountMl: input.amountMl,
    memo: input.memo,
    recordedBy: input.recordedBy,
    recordedByName: input.recordedByName ?? input.recordedBy,
    source: input.source,
  };
}

export async function createParentOnboarding(input: {
  parentName: string;
  childName: string;
  birthDate: string;
  feedingType: string;
  allergies?: string;
  medicalNotes?: string;
  careNotes?: string;
}) {
  const res = await requestJson<{
    familyId: string;
    childId: string;
    userId: string;
    role: 'PARENT_ADMIN';
  }>('/api/onboarding/parent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (res) return { ...res, input };

  await delay();
  return {
    familyId: FALLBACK_FAMILY_ID,
    childId: FALLBACK_CHILD_ID,
    userId: FALLBACK_PARENT_ID,
    role: 'PARENT_ADMIN' as const,
    input,
  };
}

export async function createInvite(input: {
  relationship: string;
  role: UserRole;
  memo?: string;
}): Promise<{ token: string; inviteUrl: string }> {
  const res = await requestJson<{ token: string; inviteUrl: string }>(
    `/api/families/${FALLBACK_FAMILY_ID}/invites`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (res) return res;

  await delay();
  const token = 'invite_' + Math.random().toString(36).slice(2, 8);
  return {
    token,
    inviteUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${token}`,
  };
}

export async function getInvite(token: string): Promise<Invite> {
  const res = await requestJson<Invite>(`/api/invites/${encodeURIComponent(token)}`);
  if (res) return res;

  await delay();
  return {
    token,
    familyId: FALLBACK_FAMILY_ID,
    childName: '하린',
    relationship: '할머니',
    role: 'CAREGIVER_EDITOR',
    status: 'ACTIVE',
  };
}

export async function acceptInvite(_token: string, input: { name: string; emailOrPin: string }) {
  const res = await requestJson<{
    userId: string;
    familyId: string;
    childId: string;
    role: 'CAREGIVER_EDITOR' | 'CAREGIVER_VIEWER';
    name: string;
  }>(`/api/invites/${encodeURIComponent(_token)}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (res) return res;

  await delay();
  return {
    userId: 'user_grandma_1',
    familyId: FALLBACK_FAMILY_ID,
    childId: FALLBACK_CHILD_ID,
    role: 'CAREGIVER_EDITOR' as const,
    name: input.name,
  };
}

export async function getChildStatus() {
  const res = await requestJson<{
    child: { id: string; name: string; ageInMonths: number };
    latestStatus: Record<string, string>;
    activeRules?: string[];
  }>(`/api/children/${FALLBACK_CHILD_ID}/status`);
  if (res) return res;

  await delay();
  return {
    child: { id: FALLBACK_CHILD_ID, name: '하린', ageInMonths: 6 },
    latestStatus: {
      feeding: '오후 2:20 / 160ml',
      sleep: '오후 12:00 종료',
      diaper: '정상',
      medicine: '기록 없음',
    },
  };
}

export async function createCareRecord(input: {
  type: CareRecordType;
  amountMl?: number;
  memo?: string;
  recordedBy: string;
  recordedByName?: string;
  source: RecordSource;
  careSessionId?: string;
}): Promise<CareRecord> {
  const payload = {
    familyId: FALLBACK_FAMILY_ID,
    childId: FALLBACK_CHILD_ID,
    careSessionId: input.careSessionId,
    type: input.type,
    amountMl: input.amountMl,
    recordedBy: input.recordedBy,
    recordedByName: input.recordedByName ?? input.recordedBy,
    source: input.source,
    memo: input.memo,
  };
  const res = await requestJson<CareRecord>('/api/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res) return res;

  await delay(120);
  return createLocalRecord(input);
}

export async function startCareSession(caregiverName: string, caregiverId = 'user_grandma_1') {
  const res = await requestJson<{
    careSessionId: string;
    startedAt: string;
    status: 'ACTIVE';
    caregiverName: string;
  }>('/api/care-sessions/start', {
    method: 'POST',
    body: JSON.stringify({
      familyId: FALLBACK_FAMILY_ID,
      childId: FALLBACK_CHILD_ID,
      caregiverId,
      caregiverName,
    }),
  });
  if (res) return res;

  await delay();
  return {
    careSessionId: 'session_' + Date.now(),
    startedAt: new Date().toISOString(),
    status: 'ACTIVE' as const,
    caregiverName,
  };
}

export async function endCareSession(
  careSessionId: string,
  startedAt: string,
  counts: Record<string, number>,
) {
  const res = await requestJson<{
    careSessionId: string;
    durationMinutes: number;
    summary: string;
    counts: Record<string, number>;
    praise: string;
  }>(`/api/care-sessions/${encodeURIComponent(careSessionId)}/end`, {
    method: 'POST',
    body: JSON.stringify({ counts }),
  });
  if (res) return res;

  await delay();
  const durationMinutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  return {
    careSessionId,
    durationMinutes,
    summary: `오늘 할머니가 ${Math.floor(durationMinutes / 60)}시간 ${durationMinutes % 60}분 동안 하린이를 돌봐주셨어요.`,
    counts,
    praise: '덕분에 부모가 아이 상태를 정확히 이어받을 수 있어요.',
  };
}

export async function saveVoiceNote(text: string, careSessionId = 'session_demo') {
  const res = await requestJson<{
    voiceNoteId: string;
    parsedRecord: { type: CareRecordType; memo: string; amountMl?: number };
  }>(`/api/care-sessions/${encodeURIComponent(careSessionId)}/voice-notes`, {
    method: 'POST',
    body: JSON.stringify({ text, recordedBy: FALLBACK_PARENT_ID }),
  });
  if (res) return res;

  await delay();
  return {
    voiceNoteId: 'voice_' + Date.now(),
    parsedRecord: parseTextToRecord(text),
  };
}

export function parseTextToRecord(text: string): { type: CareRecordType; memo: string; amountMl?: number } {
  if (/(분유|수유|먹였|먹임|모유)/.test(text)) {
    const m = text.match(/(\d{2,3})\s*ml/i);
    return { type: 'FEEDING', memo: text, amountMl: m ? Number(m[1]) : undefined };
  }
  if (/(기저귀|응가|변)/.test(text)) return { type: 'DIAPER', memo: text };
  if (/(낮잠|잠).*(시작|재웠|재움)/.test(text)) return { type: 'SLEEP_START', memo: text };
  if (/(낮잠|잠).*(끝|종료|깼|일어)/.test(text)) return { type: 'SLEEP_END', memo: text };
  if (/(잠|낮잠)/.test(text)) return { type: 'SLEEP_START', memo: text };
  if (/약/.test(text)) return { type: 'MEDICINE', memo: text };
  if (/(울|보채|칭얼)/.test(text)) return { type: 'CRYING', memo: text };
  return { type: 'NOTE', memo: text };
}

export async function askAgentChat(
  message: string,
  context?: {
    caregiverId?: string;
    careSessionId?: string;
  },
): Promise<AgentCareResponse> {
  const res = await requestJson<AgentCareResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      familyId: FALLBACK_FAMILY_ID,
      childId: FALLBACK_CHILD_ID,
      caregiverId: context?.caregiverId ?? FALLBACK_PARENT_ID,
      careSessionId: context?.careSessionId,
      message,
    }),
  });
  if (res) return res;
  await delay(400);
  return mockAgentResponse(message);
}

function mockAgentResponse(message: string): AgentCareResponse {
  if (/(유튜브|영상|동영상|tv|티비)/i.test(message)) {
    return {
      answer:
        '영상은 부모가 허용한 경우가 아니면 보여주지 않는 규칙이 있어요. 먼저 기저귀와 졸림 신호를 확인해보세요.',
      nextActions: [
        '기저귀 상태를 확인해보세요.',
        '토끼 인형이나 좋아하는 장난감으로 먼저 달래보세요.',
        '조용한 곳에서 안아주며 진정시켜보세요.',
      ],
      ruleReminders: ['유튜브와 영상 시청은 부모가 명시적으로 허용한 경우가 아니면 보여주지 않는다.'],
      recordSuggestions: ['보챈 시간과 달랜 방법을 기록해두면 좋아요.'],
      proactiveNotifications: [],
      escalation: 'NONE',
    };
  }
  if (/약/.test(message)) {
    return {
      answer:
        '약은 부모가 등록한 내용이 있을 때만 먹이는 규칙이에요. 현재 등록된 약 기록이 없어요.',
      nextActions: ['보호자에게 약 복용 여부를 먼저 확인해 주세요.'],
      ruleReminders: ['약은 부모가 등록한 내용이 있을 때만 먹인다.'],
      recordSuggestions: ['보호자 확인 후 약 기록을 남겨주세요.'],
      proactiveNotifications: [],
      escalation: 'ASK_PARENT',
    };
  }
  if (/(수유|분유|마지막 수유|밥|먹)/.test(message)) {
    return {
      answer: '마지막 수유는 오후 2:20에 분유 160ml였어요.',
      nextActions: ['보통 3시간 간격으로 수유했어요. 다음 수유 시간을 확인해보세요.'],
      ruleReminders: [],
      recordSuggestions: ['수유 후 기록을 남기면 다음 돌봄자가 이어받기 쉬워요.'],
      proactiveNotifications: [],
      escalation: 'NONE',
    };
  }
  if (/(울|보채|칭얼)/.test(message)) {
    const severe = /(많이|심하게|계속|오래)/.test(message);
    return {
      answer: severe
        ? '울음이 오래 지속되거나 심하다면 보호자에게 바로 연락해 주세요.'
        : '먼저 기저귀, 졸림, 수유 간격을 확인해보세요. 조용히 안아주는 것도 도움이 돼요.',
      nextActions: [
        '기저귀를 확인해보세요.',
        '마지막 수유 후 시간 간격을 확인해보세요.',
        '좋아하는 장난감으로 시선을 돌려보세요.',
      ],
      ruleReminders: ['열, 호흡 이상, 지속적인 심한 울음 등 위험 신호가 있으면 부모에게 바로 확인한다.'],
      recordSuggestions: ['울음 시작 시간과 달랜 방법을 기록해두면 좋아요.'],
      proactiveNotifications: [],
      escalation: severe ? 'ASK_PARENT' : 'NONE',
    };
  }
  if (/(낮잠|잠|자)/.test(message)) {
    return {
      answer: '오늘 마지막 낮잠은 오후 12:00에 종료되었어요.',
      nextActions: ['졸린 신호가 보이면 조용한 환경을 만들어 주세요.', '자기 전 조명을 어둡게 해주세요.'],
      ruleReminders: [],
      recordSuggestions: ['낮잠 시작/종료 시간을 기록해두면 루틴 분석에 도움이 돼요.'],
      proactiveNotifications: [],
      escalation: 'NONE',
    };
  }
  if (/(루틴|자기 전)/.test(message)) {
    return {
      answer: '하린이는 보통 목욕 → 수유 → 조명 낮춤 → 자장가 순서로 잠들어요.',
      nextActions: ['조명을 어둡게 해주세요.', '조용한 자장가를 틀어주세요.'],
      ruleReminders: ['자기 전에는 조명을 어둡게 해요.'],
      recordSuggestions: [],
      proactiveNotifications: [],
      escalation: 'NONE',
    };
  }
  return {
    answer: '아직 그 부분 기록이 없어요. 보호자에게 확인해 주세요.',
    nextActions: ['지금 상황을 메모로 기록해두면 좋아요.'],
    ruleReminders: [],
    recordSuggestions: ['상황을 메모로 남겨주세요.'],
    proactiveNotifications: [],
    escalation: 'NONE',
  };
}

export async function listAgentNotifications(childId = FALLBACK_CHILD_ID): Promise<AgentNotification[]> {
  const res = await requestJson<{ notifications: AgentNotification[] }>(
    `/api/children/${encodeURIComponent(childId)}/agent-notifications`,
  );
  return res?.notifications ?? [];
}

export async function evaluateAgentNotifications() {
  const res = await requestJson<{ notifications: AgentNotification[] }>('/api/agent-notifications/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      familyId: FALLBACK_FAMILY_ID,
      childId: FALLBACK_CHILD_ID,
      caregiverId: FALLBACK_PARENT_ID,
    }),
  });
  return res ?? { notifications: [] };
}

export async function updateAgentNotificationStatus(id: string, status: string) {
  const res = await requestJson<{ id: string; status: string }>(
    `/api/agent-notifications/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
  return res ?? { id, status };
}

export async function getChatSuggestions() {
  const res = await requestJson<{ suggestions: string[] }>(
    `/api/children/${FALLBACK_CHILD_ID}/chat-suggestions?caregiverId=${FALLBACK_PARENT_ID}`,
  );
  if (res) return res;
  await delay();
  return {
    suggestions: [
      '오늘 약 먹여야 해?',
      '마지막 수유는 언제였어?',
      '울면 어떻게 달래면 돼?',
      '자기 전 루틴이 뭐야?',
    ],
  };
}
