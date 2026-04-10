import { AgendaItem, SessionGroup, TalkProposal } from './types';

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

export const sampleSessions: SessionGroup[] = [
  {
    id: 'session-group-1',
    title: 'Research Session A',
    transitionDuration: 5,
    slots: [
      {
        id: 'slot-1',
        proposalId: 'talk-1',
        talkDuration: 10,
        qaDuration: 5,
      },
      {
        id: 'slot-2',
        proposalId: 'talk-2',
        talkDuration: 15,
        qaDuration: 0,
      },
    ],
  },
  {
    id: 'session-group-2',
    title: 'Lightning Session',
    transitionDuration: 2,
    slots: [
      {
        id: 'slot-3',
        proposalId: null,
        talkDuration: 5,
        qaDuration: 0,
      },
      {
        id: 'slot-4',
        proposalId: null,
        talkDuration: 5,
        qaDuration: 0,
      },
    ],
  },
];

export const sampleAgenda: AgendaItem[] = [
  {
    id: 'block-breakfast',
    type: 'static',
    kind: 'breakfast',
    title: 'Check In + Breakfast',
    duration: 60,
    fixedStart: 9 * 60,
  },
  {
    id: 'block-opening',
    type: 'static',
    kind: 'opening',
    title: 'Opening Remarks',
    duration: 10,
    fixedStart: 10 * 60,
  },
  {
    id: 'agenda-session-group-1',
    type: 'session',
    sessionGroupId: 'session-group-1',
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
    id: 'block-wrap-up',
    type: 'static',
    kind: 'wrapUp',
    title: 'Wrap Up',
    duration: 10,
    flexiblePlacement: 'end',
  },
];
