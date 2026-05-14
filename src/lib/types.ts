export type UserRole =
  | 'PARENT_ADMIN'
  | 'PARENT_EDITOR'
  | 'CAREGIVER_EDITOR'
  | 'CAREGIVER_VIEWER';

export type CareRecordType =
  | 'FEEDING'
  | 'SLEEP_START'
  | 'SLEEP_END'
  | 'DIAPER'
  | 'MEDICINE'
  | 'CRYING'
  | 'NOTE';

export type RecordSource = 'MANUAL' | 'VOICE' | 'CHATBOT';

export type AgentEscalation = 'NONE' | 'ASK_PARENT' | 'MEDICAL_CHECK';

export type AgentNotificationStatus = 'UNREAD' | 'ACKED' | 'DISMISSED';

export type AgentNotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type AgentCareResponse = {
  answer: string;
  nextActions: string[];
  ruleReminders: string[];
  recordSuggestions: string[];
  proactiveNotifications: string[];
  escalation: AgentEscalation;
  agentKind?: string;
  fallbackUsed?: boolean;
  evidence?: string[];
};

export type Child = {
  id: string;
  familyId?: string;
  name: string;
  ageInMonths: number;
  birthDate: string;
  feedingType: 'BREAST' | 'FORMULA' | 'MIXED' | 'SOLID';
  allergies?: string;
  medicalNotes?: string;
  routineNotes?: string;
  careNotes?: string;
};

export type ChildPatch = Partial<
  Pick<Child, 'name' | 'birthDate' | 'feedingType' | 'allergies' | 'medicalNotes' | 'routineNotes' | 'careNotes'>
>;

export type CareRecord = {
  id: string;
  familyId: string;
  childId: string;
  careSessionId?: string;
  type: CareRecordType;
  value?: string;
  amountMl?: number;
  recordedAt: string; // ISO
  memo?: string;
  recordedBy: string; // 사용자 ID
  recordedByName: string;
  source: RecordSource;
  photoUrl?: string;
};

export type CareRecordPatch = {
  careSessionId?: string | null;
  type?: CareRecordType;
  value?: string | null;
  amountMl?: number | null;
  memo?: string | null;
  photoUrl?: string | null;
};

export type FamilyMember = {
  id: string;
  name: string;
  relationship: string;
  role: UserRole;
};

export type FamilyMemberPatch = Partial<Pick<FamilyMember, 'name' | 'relationship' | 'role'>>;

export type ThankYouTone = 'WARM' | 'FRIENDLY' | 'POLITE' | 'CHEERFUL' | 'CONCISE';

export type ThankYouReport = {
  id: string;
  sessionId: string;
  fromUserId: string;
  fromUserName: string;
  toCaregiverName: string;
  message: string;
  tone?: ThankYouTone;
  durationLabel: string;
  counts: { feeding: number; diaper: number; sleep: number; medicine: number };
  sentAt: string;
};

export type AgentNotification = {
  id: string;
  type:
    | 'ROUTINE_SUGGESTION'
    | 'MISSED_RECORD'
    | 'SCHEDULE'
    | 'CHECKLIST'
    | 'RULE_REMINDER'
    | 'CARE_TIP'
    | 'CARE_PATTERN'
    | 'THANK_YOU';
  title: string;
  message: string;
  evidence?: string; // 근거 데이터 (예: "최근 7일 수면 기록 평균 21:45 → 어제 22:30")
  priority: AgentNotificationPriority;
  status: AgentNotificationStatus;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  text?: string;
  response?: AgentCareResponse;
  at: string;
};

export type CareSession = {
  id: string;
  familyId: string;
  childId: string;
  caregiverId: string;
  caregiverName: string;
  relationship: string;
  inviteToken?: string;
  thankYouMessage?: string | null;
  startedAt: string;
  endedAt?: string;
  status: 'ACTIVE' | 'ENDED';
};

export type ChecklistKind = 'FEEDING' | 'DIAPER' | 'SLEEP' | 'MEDICINE' | 'BATH' | 'OTHER';

export type ChecklistItem = {
  id: string;
  familyId?: string;
  childId?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  label: string;
  kind: ChecklistKind;
  completed: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  notifiedDue?: boolean;
  notifiedFollowup?: boolean;
  createdBy: string;
  createdByRole?: UserRole;
};

export type Invite = {
  token: string;
  familyId: string;
  childName: string;
  relationship: string;
  role: UserRole;
  status: 'ACTIVE' | 'ACCEPTED';
  memo?: string | null;
  thankYouMessage?: string | null;
};
