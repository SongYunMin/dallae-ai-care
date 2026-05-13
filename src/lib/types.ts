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
};

export type Child = {
  id: string;
  name: string;
  ageInMonths: number;
  birthDate: string;
  feedingType: 'BREAST' | 'FORMULA' | 'MIXED' | 'SOLID';
};

export type CareRecord = {
  id: string;
  type: CareRecordType;
  at: string; // ISO
  amountMl?: number;
  memo?: string;
  recordedBy: string;
  source: RecordSource;
};

export type FamilyMember = {
  id: string;
  name: string;
  relationship: string;
  role: UserRole;
};

export type AgentNotification = {
  id: string;
  type: 'ROUTINE_SUGGESTION' | 'MISSED_RECORD' | 'SCHEDULE' | 'RULE_REMINDER' | 'CARE_TIP';
  title: string;
  message: string;
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
  caregiverId: string;
  caregiverName: string;
  startedAt: string;
  endedAt?: string;
  status: 'ACTIVE' | 'ENDED';
};

export type Invite = {
  token: string;
  familyId: string;
  childName: string;
  relationship: string;
  role: UserRole;
  status: 'ACTIVE' | 'ACCEPTED';
};
