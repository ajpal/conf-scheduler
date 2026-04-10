export type DurationMinutes = 5 | 10 | 15;

export type TalkProposal = {
  id: string;
  speakerName: string;
  speakerAffiliation: string;
  title: string;
  abstract: string;
  preferredTalkDuration: DurationMinutes;
};

export type SessionItem = {
  id: string;
  proposalId: string;
  talkDuration: number;
  qaDuration: number;
  bufferDuration: number;
};

export type StaticBlockKind = 'breakfast' | 'opening' | 'lunch' | 'wrapUp';

export type StaticAgendaItem = {
  id: string;
  type: 'static';
  kind: StaticBlockKind;
  title: string;
  duration: number;
  fixedStart?: number;
  flexiblePlacement?: 'midday' | 'end';
};

export type TalkAgendaItem = {
  id: string;
  type: 'talk';
  sessionId: string;
};

export type AgendaItem = StaticAgendaItem | TalkAgendaItem;

export type ScheduledAgendaItem =
  | {
      id: string;
      type: 'static';
      title: string;
      start: number;
      end: number;
      duration: number;
      kind: StaticBlockKind;
    }
  | {
      id: string;
      type: 'talk';
      start: number;
      end: number;
      duration: number;
      session: SessionItem;
      proposal: TalkProposal;
    };
