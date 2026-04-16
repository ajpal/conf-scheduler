import { AgendaItem, SessionGroup } from './types';

function createSlot(
  id: string,
  talkDuration: number,
  qaDuration: number,
  proposalId: string | null = null,
) {
  return {
    id,
    proposalId,
    talkDuration,
    qaDuration,
  };
}

export function createDefaultScheduleState(): {
  sessionGroups: SessionGroup[];
  agenda: AgendaItem[];
} {
  const sessionGroups: SessionGroup[] = [
    {
      id: 'session-group-1',
      title: 'Session 1',
      sessionTitle: '',
      transitionDuration: 2,
      slots: [
        createSlot('slot-1', 15, 3),
        createSlot('slot-2', 10, 3),
        createSlot('slot-3', 10, 3),
      ],
    },
    {
      id: 'session-group-2',
      title: 'Session 2',
      sessionTitle: '',
      transitionDuration: 2,
      slots: [
        createSlot('slot-4', 15, 3),
        createSlot('slot-5', 10, 3),
        createSlot('slot-6', 10, 3),
      ],
    },
    {
      id: 'session-group-3',
      title: 'Session 3',
      sessionTitle: '',
      transitionDuration: 2,
      slots: [
        createSlot('slot-7', 15, 3),
        createSlot('slot-8', 10, 3),
        createSlot('slot-9', 10, 3),
      ],
    },
    {
      id: 'session-group-4',
      title: 'Session 4',
      sessionTitle: '',
      transitionDuration: 2,
      slots: [
        createSlot('slot-10', 15, 3),
        createSlot('slot-11', 10, 3),
        createSlot('slot-12', 10, 3),
      ],
    },
    {
      id: 'session-group-5',
      title: 'Session 5',
      sessionTitle: '',
      transitionDuration: 1,
      slots: [
        createSlot('slot-13', 5, 1),
        createSlot('slot-14', 5, 1),
        createSlot('slot-15', 5, 1),
        createSlot('slot-16', 5, 1),
        createSlot('slot-17', 5, 1),
        createSlot('slot-18', 5, 1),
      ],
    },
  ];

  const agenda: AgendaItem[] = [
    {
      id: 'block-welcome',
      type: 'static',
      kind: 'opening',
      title: 'Welcome',
      duration: 60,
      fixedStart: 9 * 60,
    },
    {
      id: 'agenda-session-group-1',
      type: 'session',
      sessionGroupId: 'session-group-1',
    },
    {
      id: 'block-break-1',
      type: 'static',
      kind: 'break',
      title: 'Break',
      duration: 15,
    },
    {
      id: 'agenda-session-group-2',
      type: 'session',
      sessionGroupId: 'session-group-2',
    },
    {
      id: 'block-lunch',
      type: 'static',
      kind: 'lunch',
      title: 'Lunch',
      duration: 60,
      flexiblePlacement: 'midday',
    },
    {
      id: 'agenda-session-group-3',
      type: 'session',
      sessionGroupId: 'session-group-3',
    },
    {
      id: 'block-break-2',
      type: 'static',
      kind: 'break',
      title: 'Break',
      duration: 15,
    },
    {
      id: 'agenda-session-group-4',
      type: 'session',
      sessionGroupId: 'session-group-4',
    },
    {
      id: 'block-break-3',
      type: 'static',
      kind: 'break',
      title: 'Break',
      duration: 15,
    },
    {
      id: 'agenda-session-group-5',
      type: 'session',
      sessionGroupId: 'session-group-5',
    },
    {
      id: 'block-wrap-up',
      type: 'static',
      kind: 'wrapUp',
      title: 'Wrap Up',
      duration: 15,
      flexiblePlacement: 'end',
    },
  ];

  return { sessionGroups, agenda };
}
