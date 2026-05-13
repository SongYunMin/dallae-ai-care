import type { AgentNotification, CareRecord, Child, FamilyMember } from './types';

export const MOCK_FAMILY = {
  id: 'family_1',
  name: '하린이 가족',
};

export const MOCK_CHILD: Child = {
  id: 'child_1',
  name: '하린',
  ageInMonths: 6,
  birthDate: '2025-11-07',
  feedingType: 'FORMULA',
};

export const DEFAULT_RULES = [
  '영상은 부모가 허용한 경우에만 보여줘요.',
  '약은 부모가 등록한 내용이 있을 때만 먹여요.',
  '열, 호흡 이상, 심한 울음이 있으면 보호자에게 바로 확인해요.',
];

export const PARENT_RULES = [
  '영상보다 장난감으로 달래기',
  '자기 전에는 조명을 어둡게 해요',
];

export const MOCK_FAMILY_MEMBERS: FamilyMember[] = [
  { id: 'user_parent_1', name: '엄마', relationship: '부모', role: 'PARENT_ADMIN' },
  { id: 'user_parent_2', name: '아빠', relationship: '부모', role: 'PARENT_EDITOR' },
  { id: 'user_grandma_1', name: '할머니', relationship: '외할머니', role: 'CAREGIVER_EDITOR' },
];

export const MOCK_RECORDS: CareRecord[] = [
  { id: 'r1', type: 'FEEDING', at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), amountMl: 160, memo: '분유 잘 먹음', recordedBy: '엄마', source: 'MANUAL' },
  { id: 'r2', type: 'SLEEP_END', at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), memo: '낮잠 종료', recordedBy: '엄마', source: 'MANUAL' },
  { id: 'r3', type: 'DIAPER', at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), memo: '정상', recordedBy: '엄마', source: 'MANUAL' },
  { id: 'r4', type: 'SLEEP_START', at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), memo: '낮잠 시작', recordedBy: '엄마', source: 'MANUAL' },
];

export const MOCK_NOTIFICATIONS: AgentNotification[] = [
  {
    id: 'noti_1',
    type: 'ROUTINE_SUGGESTION',
    title: '수면 준비를 조금 앞당겨보세요',
    message: '최근 3일 동안 취침 시간이 평소보다 늦어지고 있어요. 오늘은 8시 30분 전에 수면 준비를 시작해보세요.',
    priority: 'MEDIUM',
    status: 'UNREAD',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'noti_2',
    type: 'MISSED_RECORD',
    title: '낮잠 기록이 빠져 있어요',
    message: '이번 주 낮잠 기록이 2번 빠져 있어요. 돌봄 기록을 확인해볼까요?',
    priority: 'LOW',
    status: 'UNREAD',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'noti_3',
    type: 'RULE_REMINDER',
    title: '영상 규칙 안내',
    message: '영상은 부모가 허용한 경우가 아니면 보여주지 않는 규칙이 있어요. 장난감으로 먼저 달래보세요.',
    priority: 'HIGH',
    status: 'UNREAD',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'noti_4',
    type: 'SCHEDULE',
    title: '내일 일정이 평소보다 일러요',
    message: '내일 오전 일정이 평소보다 이릅니다. 오늘은 취침 준비를 조금 앞당기는 것을 추천해요.',
    priority: 'MEDIUM',
    status: 'UNREAD',
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

export const CHAT_SUGGESTIONS = [
  '아이가 지금 보채는데 어떻게 할까?',
  '유튜브 보여줘도 돼?',
  '오늘 약 먹여야 해?',
  '마지막 수유는 언제였어?',
  '잠들기 전 루틴 알려줘',
  '오늘 낮잠 잤어?',
];
