import {
  AgendaItem,
  ScheduledAgendaItem,
  SessionGroup,
  SessionSlot,
} from './types';

export const DAY_START = 9 * 60;
export const TARGET_END = 17 * 60;

export function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

export function getSlotDuration(slot: SessionSlot): number {
  return slot.talkDuration + slot.qaDuration;
}

export function getSessionGroupDuration(sessionGroup: SessionGroup): number {
  const talkTime = sessionGroup.slots.reduce(
    (total, slot) => total + getSlotDuration(slot),
    0,
  );
  const transitions =
    sessionGroup.slots.length > 1
      ? (sessionGroup.slots.length - 1) * sessionGroup.transitionDuration
      : 0;
  return talkTime + transitions;
}

export function roundUpToQuarterHour(totalMinutes: number): number {
  return Math.ceil(totalMinutes / 15) * 15;
}

export function buildSchedule(
  agenda: AgendaItem[],
  sessionGroups: SessionGroup[],
): ScheduledAgendaItem[] {
  const sessionGroupsById = new Map(
    sessionGroups.map((sessionGroup) => [sessionGroup.id, sessionGroup]),
  );
  const scheduled: ScheduledAgendaItem[] = [];
  let cursor = DAY_START;

  for (const item of agenda) {
    if (item.type === 'static') {
      const start = item.fixedStart ?? roundUpToQuarterHour(cursor);
      const end = start + item.duration;
      const bufferBefore = Math.max(0, start - cursor);
      cursor = end;
      scheduled.push({
        id: item.id,
        type: 'static',
        title: item.title,
        start,
        end,
        duration: item.duration,
        bufferBefore,
        kind: item.kind,
      });
      continue;
    }

    const sessionGroup = sessionGroupsById.get(item.sessionGroupId);
    if (!sessionGroup) {
      continue;
    }

    const duration = getSessionGroupDuration(sessionGroup);
    const start = roundUpToQuarterHour(cursor);
    const end = start + duration;
    const bufferBefore = Math.max(0, start - cursor);
    cursor = end;

    scheduled.push({
      id: item.id,
      type: 'session',
      start,
      end,
      duration,
      bufferBefore,
      sessionGroup,
    });
  }

  return scheduled;
}

export function getScheduledProposalIds(sessionGroups: SessionGroup[]): Set<string> {
  return new Set(
    sessionGroups
      .flatMap((sessionGroup) => sessionGroup.slots)
      .map((slot) => slot.proposalId)
      .filter((proposalId): proposalId is string => proposalId !== null),
  );
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
