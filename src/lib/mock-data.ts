import type { AgentNotification, CareRecord, Child, FamilyMember } from './types';
import { nowKstIso } from './kst';

const kstIsoAgo = (ms: number) => nowKstIso(new Date(Date.now() - ms));

export const MOCK_FAMILY = {
  id: 'family_1',
  name: '하린이 가족',
};

export const MOCK_CHILD: Child = {
  id: 'child_1',
  familyId: 'family_1',
  name: '하린',
  ageInMonths: 6,
  birthDate: '2025-11-07',
  feedingType: 'FORMULA',
  allergies: '없음',
  medicalNotes: '해열제는 부모 확인 후 복용',
  careNotes: '영상보다 장난감으로 달래기',
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
  {
    id: 'r1',
    familyId: 'family_1',
    childId: 'child_1',
    type: 'FEEDING',
    recordedAt: kstIsoAgo(1000 * 60 * 60 * 2),
    amountMl: 160,
    memo: '분유 잘 먹음',
    recordedBy: 'user_parent_1',
    recordedByName: '엄마',
    source: 'MANUAL',
  },
  {
    id: 'r2',
    familyId: 'family_1',
    childId: 'child_1',
    type: 'SLEEP_END',
    recordedAt: kstIsoAgo(1000 * 60 * 60 * 4),
    memo: '낮잠 종료',
    recordedBy: 'user_parent_1',
    recordedByName: '엄마',
    source: 'MANUAL',
  },
  {
    id: 'r3',
    familyId: 'family_1',
    childId: 'child_1',
    type: 'DIAPER',
    recordedAt: kstIsoAgo(1000 * 60 * 60 * 5),
    memo: '정상',
    recordedBy: 'user_parent_1',
    recordedByName: '엄마',
    source: 'MANUAL',
  },
  {
    id: 'r4',
    familyId: 'family_1',
    childId: 'child_1',
    type: 'SLEEP_START',
    recordedAt: kstIsoAgo(1000 * 60 * 60 * 6),
    memo: '낮잠 시작',
    recordedBy: 'user_parent_1',
    recordedByName: '엄마',
    source: 'MANUAL',
  },
];

export const MOCK_NOTIFICATIONS: AgentNotification[] = [
  {
    id: 'noti_1',
    type: 'ROUTINE_SUGGESTION',
    title: '오늘은 수면 준비를 30분 앞당겨보세요',
    message:
      '하린이의 평소 취침 루틴이 흐트러지고 있어요. 오늘은 8시 30분 전부터 조명을 낮추고 자장가를 시작해보세요.',
    evidence: '최근 7일 평균 취침 21:45 → 어제 22:30, 그제 22:20 (수면 기록 기반)',
    priority: 'MEDIUM',
    status: 'UNREAD',
    createdAt: nowKstIso(),
  },
  {
    id: 'noti_2',
    type: 'MISSED_RECORD',
    title: '낮잠 기록이 2번 빠져 있어요',
    message:
      '이번 주 화·목 낮잠 종료 기록이 빠져 있어요. 돌봐주신 분께 확인해서 채워두면 다음 분이 이어받기 쉬워요.',
    evidence: '최근 7일 낮잠 기록 5/7회 (이상치: 화 12:00 시작 후 종료 누락)',
    priority: 'LOW',
    status: 'UNREAD',
    createdAt: kstIsoAgo(1000 * 60 * 60),
  },
  {
    id: 'noti_5',
    type: 'CARE_PATTERN',
    title: '최근 보채는 시간이 오후 5시에 몰려 있어요',
    message:
      '최근 4일 동안 보채는 기록이 오후 4:50~5:30에 집중되고 있어요. 그 시간 직전에 간식이나 안기 시간을 두면 도움이 될 수 있어요.',
    evidence: '최근 4일 CRYING 기록 7건 중 5건이 16:50–17:30 사이',
    priority: 'MEDIUM',
    status: 'UNREAD',
    createdAt: kstIsoAgo(1000 * 60 * 45),
  },
  {
    id: 'noti_3',
    type: 'RULE_REMINDER',
    title: '돌봄자에게 영상 규칙을 다시 안내했어요',
    message:
      '할머니 기기에서 영상 시청 요청이 감지될 가능성이 있어, 가족 규칙을 미리 안내해두었어요. 부모 허용이 필요해요.',
    evidence: '가족 규칙 #1 · 돌봄자 역할 CAREGIVER_EDITOR',
    priority: 'HIGH',
    status: 'UNREAD',
    createdAt: kstIsoAgo(1000 * 60 * 30),
  },
  {
    id: 'noti_4',
    type: 'SCHEDULE',
    title: '내일 외출 일정 — 오늘 수유 시간 조정 추천',
    message:
      '내일 오전 9시 검진이 있어요. 오늘은 마지막 수유를 30분 앞당겨두면 내일 아침 컨디션이 안정돼요.',
    evidence: '내일 일정: 9시 영유아 검진 · 평소 기상 8:10',
    priority: 'MEDIUM',
    status: 'UNREAD',
    createdAt: kstIsoAgo(1000 * 60 * 90),
  },
];

// 돌봄자(할머니/베이비시터)가 기록을 바탕으로 자주 묻는 질문
export const CHAT_SUGGESTIONS = [
  '하린이 마지막으로 분유 언제 먹었어요?',
  '오늘 낮잠 얼마나 잤어요?',
  '지금 보채는데 뭐부터 확인할까요?',
  '약 먹여도 되나요?',
  '유튜브 보여줘도 돼요?',
  '잠들기 전 루틴 알려주세요',
  '기저귀 마지막으로 언제 갈았어요?',
  '오늘 컨디션 어때요?',
];

// 돌봄자가 데이터 기반으로 가장 먼저 묻는 핵심 질문 (대시보드 노출용)
export const QUICK_CAREGIVER_QUESTIONS = [
  '마지막 수유 언제예요?',
  '오늘 낮잠 얼마나 잤어요?',
  '지금 보채는데 어떡해요?',
];
