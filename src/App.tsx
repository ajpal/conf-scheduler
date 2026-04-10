import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { proposalsFromCsv } from './csv';
import {
  createDefaultScheduleState,
  sampleAgenda,
  sampleProposals,
  sampleSessions,
} from './sampleData';
import {
  buildSchedule,
  formatTime,
  getScheduledProposalIds,
  getSessionGroupDuration,
  getSlotDuration,
  moveItem,
  TARGET_END,
} from './schedule';
import {
  AgendaItem,
  DurationMinutes,
  DurationPreference,
  DurationPreferenceMap,
  SessionGroup,
  SessionSlot,
  TalkProposal,
} from './types';

type NewProposalForm = {
  speakerName: string;
  speakerAffiliation: string;
  title: string;
  abstract: string;
  preferredTalkDuration: '5' | '10' | '15';
};

type NewSessionTemplateForm = {
  title: string;
  shortCount: number;
  mediumCount: number;
  longCount: number;
  transitionDuration: number;
  defaultQaDuration: number;
};

type PersistedState = {
  proposals: TalkProposal[];
  sessionGroups: SessionGroup[];
  agenda: AgendaItem[];
  targetEnd: number;
};

const STORAGE_KEY = 'pnwplse-scheduler-state';

const initialProposalForm: NewProposalForm = {
  speakerName: '',
  speakerAffiliation: '',
  title: '',
  abstract: '',
  preferredTalkDuration: '10',
};

const initialSessionForm: NewSessionTemplateForm = {
  title: '',
  shortCount: 2,
  mediumCount: 0,
  longCount: 1,
  transitionDuration: 2,
  defaultQaDuration: 0,
};

function loadInitialState(): PersistedState {
  const fallback: PersistedState = {
    proposals: sampleProposals,
    sessionGroups: sampleSessions,
    agenda: sampleAgenda,
    targetEnd: TARGET_END,
  };

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<PersistedState>;
    return {
      proposals: parsed.proposals ?? fallback.proposals,
      sessionGroups: parsed.sessionGroups ?? fallback.sessionGroups,
      agenda: parsed.agenda ?? fallback.agenda,
      targetEnd: parsed.targetEnd ?? fallback.targetEnd,
    };
  } catch {
    return fallback;
  }
}

function App() {
  const initialState = useMemo(() => loadInitialState(), []);
  const [proposals, setProposals] = useState<TalkProposal[]>(initialState.proposals);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>(initialState.sessionGroups);
  const [agenda, setAgenda] = useState<AgendaItem[]>(initialState.agenda);
  const [query, setQuery] = useState('');
  const [proposalForm, setProposalForm] = useState(initialProposalForm);
  const [sessionForm, setSessionForm] = useState(initialSessionForm);
  const [targetEnd, setTargetEnd] = useState(initialState.targetEnd);

  const schedule = useMemo(() => buildSchedule(agenda, sessionGroups), [agenda, sessionGroups]);
  const proposalsById = useMemo(
    () => new Map(proposals.map((proposal) => [proposal.id, proposal])),
    [proposals],
  );
  const scheduledProposalIds = useMemo(
    () => getScheduledProposalIds(sessionGroups),
    [sessionGroups],
  );

  const unscheduledProposals = useMemo(
    () => proposals.filter((proposal) => !scheduledProposalIds.has(proposal.id)),
    [proposals, scheduledProposalIds],
  );

  const filteredProposals = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return proposals;
    }

    return proposals.filter((proposal) =>
      [proposal.speakerName, proposal.speakerAffiliation, proposal.title, proposal.abstract]
        .join(' ')
        .toLowerCase()
        .includes(trimmed),
    );
  }, [proposals, query]);

  const projectedEnd = schedule.length > 0 ? schedule[schedule.length - 1].end : 9 * 60;
  const overflow = projectedEnd - targetEnd;
  const totalTalkMinutes = sessionGroups.reduce(
    (total, sessionGroup) =>
      total +
      sessionGroup.slots.reduce((slotTotal, slot) => slotTotal + slot.talkDuration, 0),
    0,
  );
  const totalQaMinutes = sessionGroups.reduce(
    (total, sessionGroup) =>
      total + sessionGroup.slots.reduce((slotTotal, slot) => slotTotal + slot.qaDuration, 0),
    0,
  );
  const totalTransitionMinutes = sessionGroups.reduce(
    (total, sessionGroup) =>
      total +
      (sessionGroup.slots.length > 1
        ? (sessionGroup.slots.length - 1) * sessionGroup.transitionDuration
        : 0),
    0,
  );

  useEffect(() => {
    const nextState: PersistedState = {
      proposals,
      sessionGroups,
      agenda,
      targetEnd,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }, [agenda, proposals, sessionGroups, targetEnd]);

  function updateProposalForm<K extends keyof NewProposalForm>(
    key: K,
    value: NewProposalForm[K],
  ) {
    setProposalForm((current) => ({ ...current, [key]: value }));
  }

  function updateSessionForm<K extends keyof NewSessionTemplateForm>(
    key: K,
    value: NewSessionTemplateForm[K],
  ) {
    setSessionForm((current) => ({ ...current, [key]: value }));
  }

  function handleAddProposal() {
    const speakerName = proposalForm.speakerName.trim();
    const title = proposalForm.title.trim();
    const abstract = proposalForm.abstract.trim();

    if (!speakerName || !title || !abstract) {
      return;
    }

    const proposal: TalkProposal = {
      id: `talk-${crypto.randomUUID()}`,
      speakerName,
      speakerAffiliation: proposalForm.speakerAffiliation.trim(),
      title,
      abstract,
      preferredTalkDuration: Number(proposalForm.preferredTalkDuration) as 5 | 10 | 15,
      durationPreferences: createDefaultDurationPreferences(
        Number(proposalForm.preferredTalkDuration) as DurationMinutes,
      ),
    };

    setProposals((current) => [proposal, ...current]);
    setProposalForm(initialProposalForm);
  }

  function buildSlotsFromTemplate(form: NewSessionTemplateForm): SessionSlot[] {
    const slots: SessionSlot[] = [];

    for (let count = 0; count < form.longCount; count += 1) {
      slots.push({
        id: `slot-${crypto.randomUUID()}`,
        proposalId: null,
        talkDuration: 15,
        qaDuration: form.defaultQaDuration,
      });
    }

    for (let count = 0; count < form.mediumCount; count += 1) {
      slots.push({
        id: `slot-${crypto.randomUUID()}`,
        proposalId: null,
        talkDuration: 10,
        qaDuration: form.defaultQaDuration,
      });
    }

    for (let count = 0; count < form.shortCount; count += 1) {
      slots.push({
        id: `slot-${crypto.randomUUID()}`,
        proposalId: null,
        talkDuration: 5,
        qaDuration: form.defaultQaDuration,
      });
    }

    return slots;
  }

  function handleAddSessionGroup() {
    const slots = buildSlotsFromTemplate(sessionForm);
    if (slots.length === 0) {
      return;
    }

    const sessionGroupId = `session-group-${crypto.randomUUID()}`;
    const agendaId = `agenda-${crypto.randomUUID()}`;
    const nextSessionGroup: SessionGroup = {
      id: sessionGroupId,
      title: sessionForm.title.trim() || `Session ${sessionGroups.length + 1}`,
      transitionDuration: sessionForm.transitionDuration,
      slots,
    };

    const wrapUpIndex = agenda.findIndex(
      (item) => item.type === 'static' && item.kind === 'wrapUp',
    );
    const insertIndex = wrapUpIndex >= 0 ? wrapUpIndex : agenda.length;
    const nextAgenda = [...agenda];
    nextAgenda.splice(insertIndex, 0, {
      id: agendaId,
      type: 'session',
      sessionGroupId,
    });

    setSessionGroups((current) => [...current, nextSessionGroup]);
    setAgenda(nextAgenda);
  }

  function handleAddBreak() {
    const breakItem: AgendaItem = {
      id: `block-break-${crypto.randomUUID()}`,
      type: 'static',
      kind: 'break',
      title: 'Break',
      duration: 15,
    };

    const wrapUpIndex = agenda.findIndex(
      (item) => item.type === 'static' && item.kind === 'wrapUp',
    );
    const insertIndex = wrapUpIndex >= 0 ? wrapUpIndex : agenda.length;
    const nextAgenda = [...agenda];
    nextAgenda.splice(insertIndex, 0, breakItem);
    setAgenda(nextAgenda);
  }

  function handleAssignProposal(
    sessionGroupId: string,
    slotId: string,
    proposalId: string | null,
  ) {
    setSessionGroups((current) =>
      current.map((sessionGroup) => {
        if (sessionGroup.id !== sessionGroupId) {
          return sessionGroup;
        }

        return {
          ...sessionGroup,
          slots: sessionGroup.slots.map((slot) => {
            if (slot.id !== slotId) {
              return slot;
            }

            if (proposalId === null) {
              return { ...slot, proposalId: null };
            }

            const proposal = proposals.find((candidate) => candidate.id === proposalId);
            if (!proposal) {
              return slot;
            }

            return {
              ...slot,
              proposalId,
              talkDuration: proposal.preferredTalkDuration,
            };
          }),
        };
      }),
    );
  }

  function handleAssignToOpenSlot(proposal: TalkProposal) {
    for (const sessionGroup of sessionGroups) {
      const openSlot = sessionGroup.slots.find((slot) => slot.proposalId === null);
      if (openSlot) {
        handleAssignProposal(sessionGroup.id, openSlot.id, proposal.id);
        return;
      }
    }
  }

  function handleSessionGroupChange(
    sessionGroupId: string,
    field: keyof Pick<SessionGroup, 'title' | 'transitionDuration'>,
    value: string | number,
  ) {
    setSessionGroups((current) =>
      current.map((sessionGroup) =>
        sessionGroup.id === sessionGroupId
          ? { ...sessionGroup, [field]: value }
          : sessionGroup,
      ),
    );
  }

  function handleSlotChange(
    sessionGroupId: string,
    slotId: string,
    field: keyof Pick<SessionSlot, 'talkDuration' | 'qaDuration'>,
    value: number,
  ) {
    setSessionGroups((current) =>
      current.map((sessionGroup) =>
        sessionGroup.id === sessionGroupId
          ? {
              ...sessionGroup,
              slots: sessionGroup.slots.map((slot) =>
                slot.id === slotId ? { ...slot, [field]: value } : slot,
              ),
            }
          : sessionGroup,
      ),
    );
  }

  function handleAddSlot(
    sessionGroupId: string,
    talkDuration: 5 | 10 | 15,
  ) {
    setSessionGroups((current) =>
      current.map((sessionGroup) =>
        sessionGroup.id === sessionGroupId
          ? {
              ...sessionGroup,
              slots: [
                ...sessionGroup.slots,
                {
                  id: `slot-${crypto.randomUUID()}`,
                  proposalId: null,
                  talkDuration,
                  qaDuration: 0,
                },
              ],
            }
          : sessionGroup,
      ),
    );
  }

  function handleRemoveSlot(sessionGroupId: string, slotId: string) {
    setSessionGroups((current) =>
      current.map((sessionGroup) => {
        if (sessionGroup.id !== sessionGroupId) {
          return sessionGroup;
        }

        return {
          ...sessionGroup,
          slots: sessionGroup.slots.filter((slot) => slot.id !== slotId),
        };
      }),
    );
  }

  function findAgendaIndex(itemId: string): number {
    return agenda.findIndex((item) => item.id === itemId);
  }

  function handleMoveAgendaItem(itemId: string, direction: -1 | 1) {
    const index = findAgendaIndex(itemId);
    if (index < 0) {
      return;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= agenda.length) {
      return;
    }

    const current = agenda[index];
    const target = agenda[nextIndex];

    if (current.type === 'static' && current.fixedStart !== undefined) {
      return;
    }

    if (target.type === 'static' && target.fixedStart !== undefined) {
      return;
    }

    setAgenda((items) => moveItem(items, index, nextIndex));
  }

  function canMoveAgendaItem(itemId: string, direction: -1 | 1): boolean {
    const index = findAgendaIndex(itemId);
    if (index < 0) {
      return false;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= agenda.length) {
      return false;
    }

    const current = agenda[index];
    const target = agenda[nextIndex];

    if (current.type === 'static' && current.fixedStart !== undefined) {
      return false;
    }

    if (target.type === 'static' && target.fixedStart !== undefined) {
      return false;
    }

    return true;
  }

  function handleStaticDurationChange(itemId: string, duration: number) {
    setAgenda((current) =>
      current.map((item) =>
        item.id === itemId && item.type === 'static' ? { ...item, duration } : item,
      ),
    );
  }

  function handleRemoveSessionGroup(sessionGroupId: string) {
    setSessionGroups((current) =>
      current.filter((sessionGroup) => sessionGroup.id !== sessionGroupId),
    );
    setAgenda((current) =>
      current.filter(
        (item) => !(item.type === 'session' && item.sessionGroupId === sessionGroupId),
      ),
    );
  }

  function handleImportProposals(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file
      .text()
      .then((text) => {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const imported = isCsv
          ? proposalsFromCsv(text)
          : (JSON.parse(text) as TalkProposal[]).map((proposal) => ({
              ...proposal,
              id: proposal.id || `talk-${crypto.randomUUID()}`,
              durationPreferences:
                proposal.durationPreferences ??
                createDefaultDurationPreferences(proposal.preferredTalkDuration),
            }));

        setProposals(imported);
        setSessionGroups([]);
        setAgenda(sampleAgenda.filter((item) => item.type === 'static'));
      })
      .catch(() => {
        window.alert(
          'Unable to import proposals. Expected either the conference CSV export or a JSON array of talk objects.',
        );
      })
      .finally(() => {
        event.target.value = '';
      });
  }

  function handleResetDemo() {
    setProposals(sampleProposals);
    const defaultScheduleState = createDefaultScheduleState();
    setSessionGroups(defaultScheduleState.sessionGroups);
    setAgenda(defaultScheduleState.agenda);
    setTargetEnd(TARGET_END);
    setSessionForm(initialSessionForm);
    setProposalForm(initialProposalForm);
  }

  function handleResetDefaultSchedule() {
    const defaultScheduleState = createDefaultScheduleState();
    setSessionGroups(defaultScheduleState.sessionGroups);
    setAgenda(defaultScheduleState.agenda);
  }

  function handleTargetEndChange(event: ChangeEvent<HTMLInputElement>) {
    const [hours, minutes] = event.target.value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return;
    }
    setTargetEnd(hours * 60 + minutes);
  }

  function handleExport() {
    const exportPayload = {
      metadata: {
        targetEnd: formatTime(targetEnd),
      },
      proposals,
      agenda: schedule.map((item) =>
        item.type === 'static'
          ? {
              type: 'static',
              title: item.title,
              start: formatTime(item.start),
              end: formatTime(item.end),
              duration: item.duration,
            }
          : {
              type: 'session',
              title: item.sessionGroup.title,
              start: formatTime(item.start),
              end: formatTime(item.end),
              transitionDuration: item.sessionGroup.transitionDuration,
              slots: item.sessionGroup.slots.map((slot) => {
                const proposal = slot.proposalId ? proposalsById.get(slot.proposalId) : null;
                return {
                  title: proposal ? proposal.title : 'Unassigned session slot',
                  speakerName: proposal ? proposal.speakerName : '',
                  speakerAffiliation: proposal ? proposal.speakerAffiliation : '',
                  talkDuration: slot.talkDuration,
                  qaDuration: slot.qaDuration,
                };
              }),
            },
      ),
      unscheduledProposals,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'conference-schedule.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Single-track conference planner</p>
          <h1>Compose sessions first, then assign talks into them.</h1>
          <p className="hero-copy">
            Define a session shape like one long talk and two short talks, tune shared
            transitions, and fill each blank slot from the proposal pool.
          </p>
        </div>
        <div className="hero-card">
          <Stat label="Projected end" value={formatTime(projectedEnd)} />
          <Stat label="Target end" value={formatTime(targetEnd)} />
          <Stat
            label="Status"
            value={
              overflow > 0 ? `${overflow} min over` : `${Math.abs(overflow)} min remaining`
            }
            tone={overflow > 0 ? 'warning' : 'ok'}
          />
        </div>
      </header>

      <main className="layout">
        <section className="panel proposals-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Proposals</p>
              <h2>Talk pool</h2>
            </div>
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search speakers, titles, abstracts"
            />
          </div>

          <div className="proposal-form">
            <h3>Add proposal</h3>
            <div className="form-grid">
              <label>
                Speaker name
                <input
                  value={proposalForm.speakerName}
                  onChange={(event) => updateProposalForm('speakerName', event.target.value)}
                />
              </label>
              <label>
                Affiliation
                <input
                  value={proposalForm.speakerAffiliation}
                  onChange={(event) =>
                    updateProposalForm('speakerAffiliation', event.target.value)
                  }
                />
              </label>
              <label className="wide">
                Title
                <input
                  value={proposalForm.title}
                  onChange={(event) => updateProposalForm('title', event.target.value)}
                />
              </label>
              <label className="wide">
                Abstract
                <textarea
                  rows={4}
                  value={proposalForm.abstract}
                  onChange={(event) => updateProposalForm('abstract', event.target.value)}
                />
              </label>
              <label>
                Preferred talk length
                <select
                  value={proposalForm.preferredTalkDuration}
                  onChange={(event) =>
                    updateProposalForm(
                      'preferredTalkDuration',
                      event.target.value as NewProposalForm['preferredTalkDuration'],
                    )
                  }
                >
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                </select>
              </label>
            </div>
            <button className="primary-button" onClick={handleAddProposal}>
              Add proposal
            </button>
            <div className="import-row">
              <label className="file-input-label">
                Import CSV or JSON
                <input
                  type="file"
                  accept=".csv,application/json,text/csv"
                  onChange={handleImportProposals}
                />
              </label>
              <button className="secondary-button" onClick={handleResetDemo}>
                Restore sample data
              </button>
            </div>
          </div>

          <div className="proposal-list">
            {filteredProposals.map((proposal) => {
              const isScheduled = scheduledProposalIds.has(proposal.id);

              return (
                <article
                  className={`proposal-card ${getSlotLengthClass(
                    proposal.preferredTalkDuration,
                  )}`}
                  key={proposal.id}
                >
                  <div className="proposal-meta">
                    <span className="duration-pill">
                      {proposal.preferredTalkDuration} min preferred
                    </span>
                    {isScheduled ? (
                      <span className="scheduled-pill">Assigned</span>
                    ) : (
                      <button
                        className="secondary-button"
                        onClick={() => handleAssignToOpenSlot(proposal)}
                        disabled={
                          !sessionGroups.some((sessionGroup) =>
                            sessionGroup.slots.some((slot) => slot.proposalId === null),
                          )
                        }
                      >
                        Fill open slot
                      </button>
                    )}
                  </div>
                  <h3>{proposal.title}</h3>
                  <p className="speaker-line">
                    {proposal.speakerName}
                    {proposal.speakerAffiliation ? `, ${proposal.speakerAffiliation}` : ''}
                  </p>
                  <p className="abstract-copy">{proposal.abstract}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel agenda-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Agenda Builder</p>
              <h2>Session-based timeline</h2>
            </div>
            <button className="primary-button" onClick={handleExport}>
              Export schedule
            </button>
          </div>

          <div className="settings-row">
            <label>
              Target end time
              <input
                type="time"
                value={`${String(Math.floor(targetEnd / 60)).padStart(2, '0')}:${String(
                  targetEnd % 60,
                ).padStart(2, '0')}`}
                onChange={handleTargetEndChange}
              />
            </label>
          </div>

          <div className="session-template-card">
            <h3>Create session template</h3>
            <div className="form-grid session-template-grid">
              <label className="wide">
                Session title
                <input
                  value={sessionForm.title}
                  onChange={(event) => updateSessionForm('title', event.target.value)}
                  placeholder="Research Session B"
                />
              </label>
              <label>
                Long talks (15)
                <input
                  type="number"
                  min={0}
                  value={sessionForm.longCount}
                  onChange={(event) =>
                    updateSessionForm('longCount', Number(event.target.value))
                  }
                />
              </label>
              <label>
                Medium talks (10)
                <input
                  type="number"
                  min={0}
                  value={sessionForm.mediumCount}
                  onChange={(event) =>
                    updateSessionForm('mediumCount', Number(event.target.value))
                  }
                />
              </label>
              <label>
                Short talks (5)
                <input
                  type="number"
                  min={0}
                  value={sessionForm.shortCount}
                  onChange={(event) =>
                    updateSessionForm('shortCount', Number(event.target.value))
                  }
                />
              </label>
              <label>
                Transition between talks
                <input
                  type="number"
                  min={0}
                  value={sessionForm.transitionDuration}
                  onChange={(event) =>
                    updateSessionForm('transitionDuration', Number(event.target.value))
                  }
                />
              </label>
              <label>
                Default Q&amp;A per talk
                <input
                  type="number"
                  min={0}
                  value={sessionForm.defaultQaDuration}
                  onChange={(event) =>
                    updateSessionForm('defaultQaDuration', Number(event.target.value))
                  }
                />
              </label>
            </div>
            <button className="primary-button" onClick={handleAddSessionGroup}>
              Add session
            </button>
            <button className="secondary-button break-button" onClick={handleAddBreak}>
              Add 15-minute break
            </button>
            <button
              className="secondary-button break-button"
              onClick={handleResetDefaultSchedule}
            >
              Reset to conference default
            </button>
          </div>

          <div className="timeline">
            {schedule.map((item) => {
              if (item.type === 'static') {
                return (
                  <article className="timeline-card static-card" key={item.id}>
                    <div className="time-column">
                      <strong>{formatTime(item.start)}</strong>
                      <span>{formatTime(item.end)}</span>
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-heading">
                        <div>
                          <p className="item-tag">Agenda block</p>
                          <h3>{item.title}</h3>
                        </div>
                        <div className="move-controls">
                          <button
                            onClick={() => handleMoveAgendaItem(item.id, -1)}
                            disabled={!canMoveAgendaItem(item.id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMoveAgendaItem(item.id, 1)}
                            disabled={!canMoveAgendaItem(item.id, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      <label className="inline-field">
                        Duration
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={item.duration}
                          onChange={(event) =>
                            handleStaticDurationChange(
                              item.id,
                              Number(event.target.value),
                            )
                          }
                          disabled={item.kind === 'breakfast'}
                        />
                      </label>
                    </div>
                  </article>
                );
              }

              const sessionStart = item.start;
              let slotCursor = sessionStart;

              return (
                <article className="timeline-card session-card" key={item.id}>
                  <div className="time-column">
                    <strong>{formatTime(item.start)}</strong>
                    <span>{formatTime(item.end)}</span>
                  </div>
                  <div className="timeline-body">
                    <div className="timeline-heading">
                      <div>
                        <p className="item-tag">Session</p>
                        <h3>{item.sessionGroup.title}</h3>
                        <p className="speaker-line">
                          {item.sessionGroup.slots.length} talks, {item.sessionGroup.transitionDuration}
                          {' '}min transition between talks
                        </p>
                      </div>
                      <div className="move-controls">
                        <button
                          onClick={() => handleMoveAgendaItem(item.id, -1)}
                          disabled={!canMoveAgendaItem(item.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveAgendaItem(item.id, 1)}
                          disabled={!canMoveAgendaItem(item.id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    <div className="session-group-controls">
                      <label>
                        Session title
                        <input
                          value={item.sessionGroup.title}
                          onChange={(event) =>
                            handleSessionGroupChange(
                              item.sessionGroup.id,
                              'title',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="inline-field">
                        Transition
                        <input
                          type="number"
                          min={0}
                          value={item.sessionGroup.transitionDuration}
                          onChange={(event) =>
                            handleSessionGroupChange(
                              item.sessionGroup.id,
                              'transitionDuration',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="nested-slot-list">
                      {item.sessionGroup.slots.map((slot, slotIndex) => {
                        const slotStart = slotCursor;
                        const slotEnd = slotStart + getSlotDuration(slot);
                        slotCursor =
                          slotEnd +
                          (slotIndex < item.sessionGroup.slots.length - 1
                            ? item.sessionGroup.transitionDuration
                            : 0);
                        const proposal = slot.proposalId
                          ? proposalsById.get(slot.proposalId) ?? null
                          : null;
                        const slotLengthLabel = getSlotLengthLabel(slot.talkDuration);
                        const topPreferenceOptions = proposals.filter((proposalOption) =>
                          getProposalPreference(
                            proposalOption,
                            slot.talkDuration as DurationMinutes,
                          ) === 'top',
                        );
                        const acceptableOptions = proposals.filter((proposalOption) =>
                          getProposalPreference(
                            proposalOption,
                            slot.talkDuration as DurationMinutes,
                          ) === 'acceptable',
                        );

                        return (
                          <div
                            className={`nested-slot-card ${getSlotLengthClass(
                              slot.talkDuration,
                            )}`}
                            key={slot.id}
                          >
                            <div className="nested-slot-time">
                              <strong>{formatTime(slotStart)}</strong>
                              <span>{formatTime(slotEnd)}</span>
                            </div>
                            <div className="nested-slot-body">
                              <div className="slot-header">
                                <label className="assignment-field">
                                  {slotLengthLabel}
                                  <select
                                    value={slot.proposalId ?? ''}
                                    onChange={(event) =>
                                      handleAssignProposal(
                                        item.sessionGroup.id,
                                        slot.id,
                                        event.target.value === '' ? null : event.target.value,
                                      )
                                    }
                                  >
                                    <option value="">Unassigned</option>
                                    {topPreferenceOptions.length > 0 ? (
                                      <optgroup label="Top Preference">
                                        {topPreferenceOptions.map((proposalOption) => {
                                          const assignedElsewhere =
                                            proposalOption.id !== slot.proposalId &&
                                            scheduledProposalIds.has(proposalOption.id);

                                          return (
                                            <option
                                              key={proposalOption.id}
                                              value={proposalOption.id}
                                              disabled={assignedElsewhere}
                                            >
                                              {proposalOption.title} - {proposalOption.speakerName}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    ) : null}
                                    {acceptableOptions.length > 0 ? (
                                      <optgroup label="Acceptable">
                                        {acceptableOptions.map((proposalOption) => {
                                          const assignedElsewhere =
                                            proposalOption.id !== slot.proposalId &&
                                            scheduledProposalIds.has(proposalOption.id);

                                          return (
                                            <option
                                              key={proposalOption.id}
                                              value={proposalOption.id}
                                              disabled={assignedElsewhere}
                                            >
                                              {proposalOption.title} - {proposalOption.speakerName}
                                            </option>
                                          );
                                        })}
                                      </optgroup>
                                    ) : null}
                                  </select>
                                </label>
                                <button
                                  className="slot-remove-button"
                                  onClick={() => handleRemoveSlot(item.sessionGroup.id, slot.id)}
                                  aria-label={`Remove ${slotLengthLabel.toLowerCase()} talk`}
                                >
                                  X
                                </button>
                              </div>
                              <div className="slot-meta-grid">
                                <label className="inline-field">
                                  Talk
                                  <select
                                    value={slot.talkDuration}
                                    onChange={(event) =>
                                      handleSlotChange(
                                        item.sessionGroup.id,
                                        slot.id,
                                        'talkDuration',
                                        Number(event.target.value),
                                      )
                                    }
                                  >
                                    <option value={5}>5 min</option>
                                    <option value={10}>10 min</option>
                                    <option value={15}>15 min</option>
                                  </select>
                                </label>
                                <label className="inline-field">
                                  Q&amp;A
                                  <input
                                    type="number"
                                    min={0}
                                    step={5}
                                    value={slot.qaDuration}
                                    onChange={(event) =>
                                      handleSlotChange(
                                        item.sessionGroup.id,
                                        slot.id,
                                        'qaDuration',
                                        Number(event.target.value),
                                      )
                                    }
                                  />
                                </label>
                              </div>
                              <p className="speaker-line">
                                {proposal
                                  ? `${proposal.speakerName}${
                                      proposal.speakerAffiliation
                                        ? `, ${proposal.speakerAffiliation}`
                                        : ''
                                    }`
                                  : 'Blank slot'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="session-footer">
                      <span>Total session: {getSessionGroupDuration(item.sessionGroup)} min</span>
                      <div className="slot-actions">
                        <button
                          className="secondary-button"
                          onClick={() => handleAddSlot(item.sessionGroup.id, 5)}
                        >
                          Add short
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => handleAddSlot(item.sessionGroup.id, 10)}
                        >
                          Add medium
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => handleAddSlot(item.sessionGroup.id, 15)}
                        >
                          Add long
                        </button>
                        <button
                          className="secondary-button danger-button"
                          onClick={() => handleRemoveSessionGroup(item.sessionGroup.id)}
                        >
                          Remove session
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel summary-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Summary</p>
              <h2>Fit and coverage</h2>
            </div>
          </div>

          <div className="summary-grid">
            <Stat label="Sessions" value={`${sessionGroups.length}`} />
            <Stat label="Talk minutes" value={`${totalTalkMinutes} min`} />
            <Stat label="Q&A minutes" value={`${totalQaMinutes} min`} />
            <Stat label="Transition minutes" value={`${totalTransitionMinutes} min`} />
          </div>

          <div className="summary-callout">
            <h3>{overflow > 0 ? 'Day runs long' : 'Schedule fits target'}</h3>
            <p>
              {overflow > 0
                ? `The current agenda ends ${overflow} minutes after the target end time.`
                : `The current agenda ends ${Math.abs(overflow)} minutes before the target end time.`}
            </p>
          </div>

          <div className="unscheduled-list">
            <h3>Unassigned proposals</h3>
            {unscheduledProposals.length === 0 ? (
              <p>All proposals are currently assigned to session slots.</p>
            ) : (
              unscheduledProposals.map((proposal) => (
                <article
                  className={`unscheduled-card ${getSlotLengthClass(
                    proposal.preferredTalkDuration,
                  )}`}
                  key={proposal.id}
                >
                  <div>
                    <h4>{proposal.title}</h4>
                    <p className="speaker-line">
                      {proposal.speakerName}
                      {proposal.speakerAffiliation ? `, ${proposal.speakerAffiliation}` : ''}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => handleAssignToOpenSlot(proposal)}
                    disabled={
                      !sessionGroups.some((sessionGroup) =>
                        sessionGroup.slots.some((slot) => slot.proposalId === null),
                      )
                    }
                  >
                    Fill open slot
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

type StatProps = {
  label: string;
  value: string;
  tone?: 'ok' | 'warning';
};

function Stat({ label, value, tone }: StatProps) {
  return (
    <div className={`stat-card ${tone ?? ''}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getSlotLengthLabel(talkDuration: number): 'Short' | 'Medium' | 'Long' {
  if (talkDuration <= 5) {
    return 'Short';
  }

  if (talkDuration <= 10) {
    return 'Medium';
  }

  return 'Long';
}

function getSlotLengthClass(talkDuration: number): string {
  if (talkDuration <= 5) {
    return 'slot-short';
  }

  if (talkDuration <= 10) {
    return 'slot-medium';
  }

  return 'slot-long';
}

function createDefaultDurationPreferences(
  preferredTalkDuration: DurationMinutes,
): DurationPreferenceMap {
  return {
    5: preferredTalkDuration === 5 ? 'top' : 'not_interested',
    10: preferredTalkDuration === 10 ? 'top' : 'not_interested',
    15: preferredTalkDuration === 15 ? 'top' : 'not_interested',
  };
}

function getProposalPreference(
  proposal: TalkProposal,
  talkDuration: DurationMinutes,
): DurationPreference {
  if (proposal.durationPreferences) {
    return proposal.durationPreferences[talkDuration];
  }

  return proposal.preferredTalkDuration === talkDuration ? 'top' : 'not_interested';
}

export default App;
