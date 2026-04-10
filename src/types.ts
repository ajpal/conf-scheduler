export type DurationMinutes = 5 | 10 | 15;

export type DurationPreference = 'top' | 'acceptable' | 'not_interested';

export type DurationPreferenceMap = Record<DurationMinutes, DurationPreference>;

export type TalkProposal = {
  id: string;
  speakerName: string;
  speakerAffiliation: string;
  title: string;
  abstract: string;
  preferredTalkDuration: DurationMinutes;
  durationPreferences?: DurationPreferenceMap;
};

export type SessionSlot = {
  id: string;
  proposalId: string | null;
  talkDuration: number;
  qaDuration: number;
};

export type SessionGroup = {
  id: string;
  title: string;
  transitionDuration: number;
  slots: SessionSlot[];
};

export type StaticBlockKind = 'breakfast' | 'opening' | 'lunch' | 'wrapUp' | 'break';

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
  type: 'session';
  sessionGroupId: string;
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
      type: 'session';
      start: number;
      end: number;
      duration: number;
      sessionGroup: SessionGroup;
    };
