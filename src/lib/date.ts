import { kstParts } from './kst';

export function formatTime(iso: string): string {
  const { hour: h, minute: m } = kstParts(new Date(iso));
  const period = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hh}:${String(m).padStart(2, '0')}`;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatDuration(startISO: string, endISO?: string): string {
  const end = endISO ? new Date(endISO).getTime() : Date.now();
  const mins = Math.floor((end - new Date(startISO).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}분`;
  return `${h}시간 ${m}분`;
}
