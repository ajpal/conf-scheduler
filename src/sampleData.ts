import { AgendaItem, SessionGroup, TalkProposal } from './types';

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

export const sampleProposals: TalkProposal[] = [
  {
    id: 'talk-1',
    speakerName: 'Avery Chen',
    speakerAffiliation: 'University of Cascadia',
    title: 'Type Systems as Everyday Design Tools',
    abstract:
      'A short practical talk on using type system thinking to sharpen interfaces, surface ambiguity early, and make engineering discussions more concrete.',
    preferredTalkDuration: 10,
  },
  {
    id: 'talk-2',
    speakerName: 'Priya Nair',
    speakerAffiliation: 'Northwest Research Lab',
    title: 'What We Learned From Shipping Interactive Program Visualizations',
    abstract:
      'Lessons from building visual tools for programming languages education, with an emphasis on failure modes and iteration strategy.',
    preferredTalkDuration: 15,
  },
  {
    id: 'talk-3',
    speakerName: 'Mateo Silva',
    speakerAffiliation: 'Rain City Tech',
    title: 'Five Minutes on Fast Feedback Loops',
    abstract:
      'A compact lightning talk about keeping local developer feedback loops short enough to support exploratory work.',
    preferredTalkDuration: 5,
  },
  {
    id: 'talk-4',
    speakerName: 'Samira Haddad',
    speakerAffiliation: 'Open Systems Collective',
    title: 'Maintaining Research Software With Tiny Teams',
    abstract:
      'Concrete maintenance patterns for research codebases that have few maintainers, inconsistent funding, and changing contributors.',
    preferredTalkDuration: 10,
  },
  {
    id: 'talk-5',
    speakerName: 'Jon Park',
    speakerAffiliation: 'Harbor University',
    title: 'Teaching Semantics Through Small Executable Models',
    abstract:
      'A case for pairing concise semantics with runnable artifacts so that students can test and refine their mental models quickly.',
    preferredTalkDuration: 15,
  },
  {
    id: 'talk-6',
    speakerName: 'Lina Romero',
    speakerAffiliation: 'Blue Pine Labs',
    title: 'Talk Proposals That Survive Program Committee Triage',
    abstract:
      'A speaker-focused look at what makes short-format conference proposals easy to schedule and easy for organizers to present.',
    preferredTalkDuration: 5,
  },
];

const defaultScheduleState = createDefaultScheduleState();
export const sampleSessions: SessionGroup[] = defaultScheduleState.sessionGroups;
export const sampleAgenda: AgendaItem[] = defaultScheduleState.agenda;
