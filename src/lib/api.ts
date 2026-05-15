import type {
  AgentCareResponse,
  AgentNotification,
  CareRecord,
  CareRecordPatch,
  CareRecordType,
  CareSession,
  ChecklistItem,
  Child,
  ChildPatch,
  FamilyMember,
  FamilyMemberPatch,
  Invite,
  RecordSource,
  ThankYouReport,
  UserRole,
} from './types';
import { sharedRecordQueryString } from './shared-record-sync';

export const DEFAULT_FAMILY_ID = 'family_1';
export const DEFAULT_CHILD_ID = 'child_1';
export const DEFAULT_PARENT_ID = 'user_parent_1';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8000';

type ChecklistPatch = Omit<Partial<ChecklistItem>, 'completedAt' | 'completedBy'> & {
  completedAt?: string | null;
  completedBy?: string | null;
};

export type RulesResult = {
  rules: string[];
  parentRules: string[];
};

export type ParentOnboardingResult = {
  familyId: string;
  childId: string;
  userId: string;
  role: 'PARENT_ADMIN';
  child: Child;
  member: FamilyMember;
  activeRules: string[];
};

export type ChildStatusResult = {
  child: Child;
  latestStatus: Record<string, string>;
  activeRules: string[];
};

export type CareSessionStartResult = {
  careSessionId: string;
  startedAt: string;
  status: 'ACTIVE';
  caregiverName: string;
  relationship: string;
  inviteToken?: string;
  thankYouMessage?: string | null;
};

export type CareSessionEndResult = {
  careSessionId: string;
  durationMinutes: number;
  summary: string;
  counts: Record<string, number>;
  praise: string;
};

export type VoiceNoteResult = {
  voiceNoteId: string;
  parsedRecord: { type: CareRecordType; memo: string; amountMl?: number };
  createdRecord: CareRecord;
};

export type SpeechTranscribeResult = {
  text: string;
  provider: string;
};

export type ThankYouMessageResult = {
  message: string;
  agentKind?: string;
  fallbackUsed?: boolean;
  evidence?: string[];
  followUpQuestions?: string[];
};

export class ApiHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function responseErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return res.statusText;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === 'string') return parsed.detail;
  } catch {
    // JSON이 아닌 오류 응답은 원문을 그대로 보여준다.
  }
  return text;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'API 서버에 연결할 수 없습니다.');
  }

  if (!res.ok) {
    throw new ApiHttpError(res.status, await responseErrorMessage(res));
  }

  return (await res.json()) as T;
}

export async function createParentOnboarding(input: {
  parentName: string;
  childName: string;
  birthDate: string;
  feedingType: string;
  allergies?: string;
  medicalNotes?: string;
  routineNotes?: string;
  careNotes?: string;
}): Promise<ParentOnboardingResult> {
  return requestJson<ParentOnboardingResult>('/api/onboarding/parent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listFamilyMembers(
  familyId = DEFAULT_FAMILY_ID,
): Promise<FamilyMember[]> {
  const res = await requestJson<{ members: FamilyMember[] }>(
    `/api/families/${encodeURIComponent(familyId)}/members`,
  );
  return res.members;
}

export async function updateFamilyMember(
  memberId: string,
  patch: FamilyMemberPatch,
  actorId = DEFAULT_PARENT_ID,
  familyId = DEFAULT_FAMILY_ID,
): Promise<FamilyMember> {
  return requestJson<FamilyMember>(
    `/api/families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ actorId, ...patch }),
    },
  );
}

export async function deleteFamilyMember(
  memberId: string,
  actorId = DEFAULT_PARENT_ID,
  familyId = DEFAULT_FAMILY_ID,
): Promise<boolean> {
  const res = await requestJson<{ id: string; deleted: boolean }>(
    `/api/families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(memberId)}?actorId=${encodeURIComponent(actorId)}`,
    { method: 'DELETE' },
  );
  return res.deleted;
}

export async function createInvite(input: {
  relationship: string;
  role: UserRole;
  memo?: string;
}): Promise<{ token: string; inviteUrl: string }> {
  return requestJson<{ token: string; inviteUrl: string }>(
    `/api/families/${DEFAULT_FAMILY_ID}/invites`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function getInvite(token: string): Promise<Invite> {
  return requestJson<Invite>(`/api/invites/${encodeURIComponent(token)}`);
}

export async function acceptInvite(
  token: string,
  input: { name: string; emailOrPin: string },
): Promise<{
  userId: string;
  familyId: string;
  childId: string;
  role: 'CAREGIVER_EDITOR' | 'CAREGIVER_VIEWER';
  name: string;
  relationship: string;
  inviteToken?: string;
  thankYouMessage?: string | null;
}> {
  return requestJson(`/api/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getChildStatus(
  childId = DEFAULT_CHILD_ID,
): Promise<ChildStatusResult> {
  return requestJson<ChildStatusResult>(`/api/children/${encodeURIComponent(childId)}/status`);
}

export async function updateChild(
  childId: string,
  patch: ChildPatch,
  actorId = DEFAULT_PARENT_ID,
): Promise<Child> {
  return requestJson<Child>(`/api/children/${encodeURIComponent(childId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ actorId, ...patch }),
  });
}

export async function listRules(childId = DEFAULT_CHILD_ID): Promise<RulesResult> {
  return requestJson<RulesResult>(
    `/api/rules?childId=${encodeURIComponent(childId)}`,
  );
}

export async function createRule(
  text: string,
  childId = DEFAULT_CHILD_ID,
  actorId = DEFAULT_PARENT_ID,
): Promise<RulesResult> {
  return requestJson<RulesResult>('/api/rules', {
    method: 'POST',
    body: JSON.stringify({ actorId, childId, text }),
  });
}

export async function updateRule(
  index: number,
  text: string,
  childId = DEFAULT_CHILD_ID,
  actorId = DEFAULT_PARENT_ID,
): Promise<RulesResult> {
  return requestJson<RulesResult>(`/api/rules/${index}`, {
    method: 'PATCH',
    body: JSON.stringify({ actorId, childId, text }),
  });
}

export async function deleteRule(
  index: number,
  childId = DEFAULT_CHILD_ID,
  actorId = DEFAULT_PARENT_ID,
): Promise<RulesResult> {
  return requestJson<RulesResult>(
    `/api/rules/${index}?childId=${encodeURIComponent(childId)}&actorId=${encodeURIComponent(actorId)}`,
    { method: 'DELETE' },
  );
}

export async function createCareRecord(input: {
  type: CareRecordType;
  amountMl?: number;
  memo?: string;
  recordedBy: string;
  recordedByName?: string;
  source: RecordSource;
  careSessionId?: string;
  familyId?: string;
  childId?: string;
}): Promise<CareRecord> {
  return requestJson<CareRecord>('/api/records', {
    method: 'POST',
    body: JSON.stringify({
      familyId: input.familyId ?? DEFAULT_FAMILY_ID,
      childId: input.childId ?? DEFAULT_CHILD_ID,
      careSessionId: input.careSessionId,
      type: input.type,
      amountMl: input.amountMl,
      recordedBy: input.recordedBy,
      recordedByName: input.recordedByName ?? input.recordedBy,
      source: input.source,
      memo: input.memo,
    }),
  });
}

export async function listCareRecords(childId = DEFAULT_CHILD_ID, actorId?: string): Promise<CareRecord[]> {
  const res = await requestJson<{ records: CareRecord[] }>(`/api/records?${sharedRecordQueryString(childId, actorId)}`);
  return res.records;
}

export async function updateCareRecord(
  id: string,
  patch: CareRecordPatch,
  actorId: string,
): Promise<CareRecord> {
  return requestJson<CareRecord>(`/api/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ actorId, ...patch }),
  });
}

export async function deleteCareRecord(id: string, actorId: string): Promise<boolean> {
  const res = await requestJson<{ id: string; deleted: boolean }>(
    `/api/records/${encodeURIComponent(id)}?actorId=${encodeURIComponent(actorId)}`,
    { method: 'DELETE' },
  );
  return res.deleted;
}

export async function startCareSession(
  caregiverName: string,
  caregiverId = 'user_grandma_1',
): Promise<CareSessionStartResult> {
  return requestJson<CareSessionStartResult>('/api/care-sessions/start', {
    method: 'POST',
    body: JSON.stringify({
      familyId: DEFAULT_FAMILY_ID,
      childId: DEFAULT_CHILD_ID,
      caregiverId,
      caregiverName,
    }),
  });
}

export async function endCareSession(
  careSessionId: string,
  counts: Record<string, number>,
): Promise<CareSessionEndResult> {
  return requestJson<CareSessionEndResult>(
    `/api/care-sessions/${encodeURIComponent(careSessionId)}/end`,
    {
      method: 'POST',
      body: JSON.stringify({ counts }),
    },
  );
}

export async function getCareSession(sessionId: string): Promise<CareSession> {
  return requestJson<CareSession>(`/api/care-sessions/${encodeURIComponent(sessionId)}`);
}

export async function getLatestCareSession(childId = DEFAULT_CHILD_ID): Promise<CareSession> {
  return requestJson<CareSession>(
    `/api/care-sessions/latest?childId=${encodeURIComponent(childId)}`,
  );
}

export async function saveVoiceNote(
  text: string,
  careSessionId: string,
  recordedBy: string,
): Promise<VoiceNoteResult> {
  return requestJson<VoiceNoteResult>(
    `/api/care-sessions/${encodeURIComponent(careSessionId)}/voice-notes`,
    {
      method: 'POST',
      body: JSON.stringify({ text, recordedBy }),
    },
  );
}

export async function transcribeSpeech(audio: Blob): Promise<SpeechTranscribeResult> {
  const form = new FormData();
  form.append('audio', audio, `voice-note.${audio.type.includes('mp4') ? 'mp4' : 'webm'}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/speech/transcribe`, {
      method: 'POST',
      body: form,
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'API 서버에 연결할 수 없습니다.');
  }
  if (!res.ok) {
    throw new ApiHttpError(res.status, await responseErrorMessage(res));
  }
  return (await res.json()) as SpeechTranscribeResult;
}

export async function createThankYouMessage(input: {
  familyId: string;
  childId: string;
  caregiverId: string;
  careSessionId: string;
  caregiverName: string;
  childName: string;
  durationLabel: string;
  counts: { feeding: number; diaper: number; sleep: number; medicine: number };
}): Promise<ThankYouMessageResult> {
  return requestJson<ThankYouMessageResult>('/api/thankyou', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function saveThankYouReport(report: ThankYouReport): Promise<ThankYouReport> {
  return requestJson<ThankYouReport>('/api/thank-you-reports', {
    method: 'POST',
    body: JSON.stringify({
      familyId: DEFAULT_FAMILY_ID,
      childId: DEFAULT_CHILD_ID,
      ...report,
    }),
  });
}

export async function getThankYouReport(sessionId: string): Promise<ThankYouReport> {
  return requestJson<ThankYouReport>(
    `/api/thank-you-reports/${encodeURIComponent(sessionId)}`,
  );
}

const VOICE_AMOUNT_PATTERN = /(\d{2,3})\s*(?:m\s*l|ml|미리|밀리|밀리리터)/i;
const FEEDING_WORD_PATTERN = /(분유|수유|모유|우유|이유식)/;
const EATING_WORD_PATTERN = /(먹였|먹임|먹었|먹어|먹고)/;
const MEDICINE_WORD_PATTERN = /(약|복용|해열제|영양제|시럽)/;
const SLEEP_START_PATTERN = /(재웠|재움|잠들|잠 시작|낮잠 시작)/;
const SLEEP_END_PATTERN = /(깼|일어났|일어남|기상|잠 끝|낮잠 끝|잠 종료|낮잠 종료)/;

function extractVoiceAmountMl(text: string): number | undefined {
  // 음성 인식 결과는 `ml`보다 `미리/밀리`로 들어오는 경우가 많아 같은 수유량 단위로 처리한다.
  const amount = text.match(VOICE_AMOUNT_PATTERN);
  return amount ? Number(amount[1]) : undefined;
}

export function parseTextToRecord(text: string): { type: CareRecordType; memo: string; amountMl?: number } {
  const normalized = text.replace(/\s+/g, '');
  const amountMl = extractVoiceAmountMl(text);
  const hasMedicineWord = MEDICINE_WORD_PATTERN.test(text);
  const hasFeedingWord = FEEDING_WORD_PATTERN.test(text);
  const hasEatingWord = EATING_WORD_PATTERN.test(text);

  if (hasFeedingWord || (amountMl !== undefined && hasEatingWord && !hasMedicineWord)) return { type: 'FEEDING', memo: text, amountMl };
  if (/(기저귀|응가|변)/.test(text)) return { type: 'DIAPER', memo: text };
  if (hasMedicineWord) return { type: 'MEDICINE', memo: text };
  if (/(울|보채|칭얼)/.test(text)) return { type: 'CRYING', memo: text };
  if (SLEEP_END_PATTERN.test(text)) return { type: 'SLEEP_END', memo: text };
  if (SLEEP_START_PATTERN.test(text)) return { type: 'SLEEP_START', memo: text };
  if (/(잠|낮잠)/.test(normalized)) {
    if (/(끝|종료|깼|일어)/.test(text)) return { type: 'SLEEP_END', memo: text };
    return { type: 'SLEEP_START', memo: text };
  }
  return { type: 'NOTE', memo: text };
}

export async function askAgentChat(
  message: string,
  context?: {
    caregiverId?: string;
    careSessionId?: string;
  },
): Promise<AgentCareResponse> {
  return requestJson<AgentCareResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      familyId: DEFAULT_FAMILY_ID,
      childId: DEFAULT_CHILD_ID,
      caregiverId: context?.caregiverId ?? DEFAULT_PARENT_ID,
      careSessionId: context?.careSessionId,
      message,
    }),
  });
}

export async function listAgentNotifications(
  childId = DEFAULT_CHILD_ID,
): Promise<AgentNotification[]> {
  const res = await requestJson<{ notifications: AgentNotification[] }>(
    `/api/children/${encodeURIComponent(childId)}/agent-notifications`,
  );
  return res.notifications;
}

export async function evaluateAgentNotifications(
  caregiverId = DEFAULT_PARENT_ID,
  childId = DEFAULT_CHILD_ID,
): Promise<{ notifications: AgentNotification[] }> {
  return requestJson<{ notifications: AgentNotification[] }>('/api/agent-notifications/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      familyId: DEFAULT_FAMILY_ID,
      childId,
      caregiverId,
    }),
  });
}

export async function updateAgentNotificationStatus(
  id: string,
  status: string,
): Promise<{ id: string; status: string }> {
  return requestJson<{ id: string; status: string }>(
    `/api/agent-notifications/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export async function listChecklistItems(childId = DEFAULT_CHILD_ID): Promise<ChecklistItem[]> {
  const res = await requestJson<{ checklists: ChecklistItem[] }>(
    `/api/checklists?childId=${encodeURIComponent(childId)}`,
  );
  return res.checklists;
}

export async function createChecklistItem(
  item: ChecklistItem,
  childId = DEFAULT_CHILD_ID,
  actorId = item.createdBy,
): Promise<ChecklistItem> {
  return requestJson<ChecklistItem>('/api/checklists', {
    method: 'POST',
    body: JSON.stringify({
      actorId,
      id: item.id,
      familyId: item.familyId ?? DEFAULT_FAMILY_ID,
      childId: item.childId ?? childId,
      date: item.date,
      time: item.time,
      label: item.label,
      kind: item.kind,
      createdBy: item.createdBy,
      createdByRole: item.createdByRole,
    }),
  });
}

export async function updateChecklistItem(
  id: string,
  patch: ChecklistPatch,
  actorId = DEFAULT_PARENT_ID,
): Promise<ChecklistItem> {
  return requestJson<ChecklistItem>(`/api/checklists/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ actorId, ...patch }),
  });
}

export async function deleteChecklistItem(id: string, actorId = DEFAULT_PARENT_ID): Promise<boolean> {
  const res = await requestJson<{ id: string; deleted: boolean }>(
    `/api/checklists/${encodeURIComponent(id)}?actorId=${encodeURIComponent(actorId)}`,
    { method: 'DELETE' },
  );
  return res.deleted;
}

export async function createChecklistNotification(
  checklistId: string,
  phase: 'due' | 'followup',
): Promise<AgentNotification> {
  return requestJson<AgentNotification>(
    `/api/checklists/${encodeURIComponent(checklistId)}/notifications`,
    {
      method: 'POST',
      body: JSON.stringify({ phase }),
    },
  );
}

export async function getChatSuggestions(
  caregiverId = DEFAULT_PARENT_ID,
  childId = DEFAULT_CHILD_ID,
): Promise<string[]> {
  const res = await requestJson<{ suggestions: string[] }>(
    `/api/children/${encodeURIComponent(childId)}/chat-suggestions?caregiverId=${encodeURIComponent(caregiverId)}`,
  );
  return res.suggestions;
}
