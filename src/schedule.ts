import {
  AgendaItem,
  ScheduledAgendaItem,
  SessionItem,
  TalkProposal,
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

export function getSessionDuration(session: SessionItem): number {
  return session.talkDuration + session.qaDuration + session.bufferDuration;
}

export function buildSchedule(
  agenda: AgendaItem[],
  sessions: SessionItem[],
  proposals: TalkProposal[],
): ScheduledAgendaItem[] {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const scheduled: ScheduledAgendaItem[] = [];
  let cursor = DAY_START;

  for (const item of agenda) {
    if (item.type === 'static') {
      const start = item.fixedStart ?? cursor;
      const end = start + item.duration;
      cursor = end;
      scheduled.push({
        id: item.id,
        type: 'static',
        title: item.title,
        start,
        end,
        duration: item.duration,
        kind: item.kind,
      });
      continue;
    }

    const session = sessionsById.get(item.sessionId);
    if (!session) {
      continue;
    }

    const proposal = proposalsById.get(session.proposalId);
    if (!proposal) {
      continue;
    }

    const duration = getSessionDuration(session);
    const start = cursor;
    const end = start + duration;
    cursor = end;

    scheduled.push({
      id: item.id,
      type: 'talk',
      start,
      end,
      duration,
      session,
      proposal,
    });
  }

  return scheduled;
}

export function getScheduledProposalIds(sessions: SessionItem[]): Set<string> {
  return new Set(sessions.map((session) => session.proposalId));
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
