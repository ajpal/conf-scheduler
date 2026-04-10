import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { sampleAgenda, sampleProposals, sampleSessions } from './sampleData';
import { buildSchedule, formatTime, getScheduledProposalIds, moveItem, TARGET_END } from './schedule';
import { AgendaItem, SessionItem, TalkProposal } from './types';

type NewProposalForm = {
  speakerName: string;
  speakerAffiliation: string;
  title: string;
  abstract: string;
  preferredTalkDuration: '5' | '10' | '15';
};

const initialForm: NewProposalForm = {
  speakerName: '',
  speakerAffiliation: '',
  title: '',
  abstract: '',
  preferredTalkDuration: '10',
};

const STORAGE_KEY = 'pnwplse-scheduler-state';

type PersistedState = {
  proposals: TalkProposal[];
  sessions: SessionItem[];
  agenda: AgendaItem[];
  defaultQa: number;
  defaultBuffer: number;
  targetEnd: number;
};

function loadInitialState(): PersistedState {
  const fallback: PersistedState = {
    proposals: sampleProposals,
    sessions: sampleSessions,
    agenda: sampleAgenda,
    defaultQa: 0,
    defaultBuffer: 5,
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
      sessions: parsed.sessions ?? fallback.sessions,
      agenda: parsed.agenda ?? fallback.agenda,
      defaultQa: parsed.defaultQa ?? fallback.defaultQa,
      defaultBuffer: parsed.defaultBuffer ?? fallback.defaultBuffer,
      targetEnd: parsed.targetEnd ?? fallback.targetEnd,
    };
  } catch {
    return fallback;
  }
}

function App() {
  const initialState = useMemo(() => loadInitialState(), []);
  const [proposals, setProposals] = useState<TalkProposal[]>(initialState.proposals);
  const [sessions, setSessions] = useState<SessionItem[]>(initialState.sessions);
  const [agenda, setAgenda] = useState<AgendaItem[]>(initialState.agenda);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<NewProposalForm>(initialForm);
  const [defaultQa, setDefaultQa] = useState(initialState.defaultQa);
  const [defaultBuffer, setDefaultBuffer] = useState(initialState.defaultBuffer);
  const [targetEnd, setTargetEnd] = useState(initialState.targetEnd);

  const schedule = useMemo(
    () => buildSchedule(agenda, sessions, proposals),
    [agenda, proposals, sessions],
  );

  const scheduledProposalIds = useMemo(() => getScheduledProposalIds(sessions), [sessions]);

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
  const totalTalkMinutes = sessions.reduce((total, session) => total + session.talkDuration, 0);
  const totalQaMinutes = sessions.reduce((total, session) => total + session.qaDuration, 0);
  const totalBufferMinutes = sessions.reduce((total, session) => total + session.bufferDuration, 0);

  useEffect(() => {
    const nextState: PersistedState = {
      proposals,
      sessions,
      agenda,
      defaultQa,
      defaultBuffer,
      targetEnd,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }, [agenda, defaultBuffer, defaultQa, proposals, sessions, targetEnd]);

  function updateForm<K extends keyof NewProposalForm>(key: K, value: NewProposalForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleAddProposal() {
    const speakerName = form.speakerName.trim();
    const title = form.title.trim();
    const abstract = form.abstract.trim();

    if (!speakerName || !title || !abstract) {
      return;
    }

    const proposal: TalkProposal = {
      id: `talk-${crypto.randomUUID()}`,
      speakerName,
      speakerAffiliation: form.speakerAffiliation.trim(),
      title,
      abstract,
      preferredTalkDuration: Number(form.preferredTalkDuration) as 5 | 10 | 15,
    };

    setProposals((current) => [proposal, ...current]);
    setForm(initialForm);
  }

  function handleAddToAgenda(proposal: TalkProposal) {
    const sessionId = `session-${crypto.randomUUID()}`;
    const agendaId = `agenda-${crypto.randomUUID()}`;

    const nextSession: SessionItem = {
      id: sessionId,
      proposalId: proposal.id,
      talkDuration: proposal.preferredTalkDuration,
      qaDuration: defaultQa,
      bufferDuration: defaultBuffer,
    };

    const wrapUpIndex = agenda.findIndex(
      (item) => item.type === 'static' && item.kind === 'wrapUp',
    );
    const insertIndex = wrapUpIndex >= 0 ? wrapUpIndex : agenda.length;
    const nextAgenda = [...agenda];
    nextAgenda.splice(insertIndex, 0, {
      id: agendaId,
      type: 'talk',
      sessionId,
    });

    setSessions((current) => [...current, nextSession]);
    setAgenda(nextAgenda);
  }

  function handleSessionChange(
    sessionId: string,
    field: keyof Pick<SessionItem, 'talkDuration' | 'qaDuration' | 'bufferDuration'>,
    value: number,
  ) {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    );
  }

  function handleStaticDurationChange(itemId: string, duration: number) {
    setAgenda((current) =>
      current.map((item) =>
        item.id === itemId && item.type === 'static' ? { ...item, duration } : item,
      ),
    );
  }

  function handleMoveAgendaItem(index: number, direction: -1 | 1) {
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

  function canMoveAgendaItem(index: number, direction: -1 | 1): boolean {
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

  function handleRemoveSession(sessionId: string) {
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    setAgenda((current) =>
      current.filter((item) => !(item.type === 'talk' && item.sessionId === sessionId)),
    );
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
              type: 'talk',
              title: item.proposal.title,
              speakerName: item.proposal.speakerName,
              speakerAffiliation: item.proposal.speakerAffiliation,
              start: formatTime(item.start),
              end: formatTime(item.end),
              talkDuration: item.session.talkDuration,
              qaDuration: item.session.qaDuration,
              bufferDuration: item.session.bufferDuration,
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

  function handleImportProposals(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file
      .text()
      .then((text) => {
        const imported = JSON.parse(text) as TalkProposal[];
        const normalized = imported.map((proposal) => ({
          ...proposal,
          id: proposal.id || `talk-${crypto.randomUUID()}`,
        }));
        setProposals(normalized);
        setSessions([]);
        setAgenda(
          sampleAgenda.filter(
            (item) => item.type === 'static',
          ),
        );
      })
      .catch(() => {
        window.alert('Unable to import proposals. Expected a JSON array of talk objects.');
      })
      .finally(() => {
        event.target.value = '';
      });
  }

  function handleResetDemo() {
    setProposals(sampleProposals);
    setSessions(sampleSessions);
    setAgenda(sampleAgenda);
    setDefaultQa(0);
    setDefaultBuffer(5);
    setTargetEnd(TARGET_END);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Single-track conference planner</p>
          <h1>Build a one-day agenda from short talk proposals.</h1>
          <p className="hero-copy">
            Add proposals, place them into the timeline, and tune talk, Q&amp;A, and
            transition time until the day fits.
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
                  value={form.speakerName}
                  onChange={(event) => updateForm('speakerName', event.target.value)}
                />
              </label>
              <label>
                Affiliation
                <input
                  value={form.speakerAffiliation}
                  onChange={(event) =>
                    updateForm('speakerAffiliation', event.target.value)
                  }
                />
              </label>
              <label className="wide">
                Title
                <input
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                />
              </label>
              <label className="wide">
                Abstract
                <textarea
                  rows={4}
                  value={form.abstract}
                  onChange={(event) => updateForm('abstract', event.target.value)}
                />
              </label>
              <label>
                Preferred talk length
                <select
                  value={form.preferredTalkDuration}
                  onChange={(event) =>
                    updateForm(
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
                Import proposals JSON
                <input type="file" accept="application/json" onChange={handleImportProposals} />
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
                <article className="proposal-card" key={proposal.id}>
                  <div className="proposal-meta">
                    <span className="duration-pill">
                      {proposal.preferredTalkDuration} min preferred
                    </span>
                    {isScheduled ? (
                      <span className="scheduled-pill">On agenda</span>
                    ) : (
                      <button
                        className="secondary-button"
                        onClick={() => handleAddToAgenda(proposal)}
                      >
                        Add to agenda
                      </button>
                    )}
                  </div>
                  <h3>{proposal.title}</h3>
                  <p className="speaker-line">
                    {proposal.speakerName}
                    {proposal.speakerAffiliation
                      ? `, ${proposal.speakerAffiliation}`
                      : ''}
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
              <h2>Single-track timeline</h2>
            </div>
            <button className="primary-button" onClick={handleExport}>
              Export schedule
            </button>
          </div>

          <div className="settings-row">
            <label>
              Default Q&amp;A
              <input
                type="number"
                min={0}
                step={5}
                value={defaultQa}
                onChange={(event) => setDefaultQa(Number(event.target.value))}
              />
            </label>
            <label>
              Default buffer
              <input
                type="number"
                min={0}
                step={5}
                value={defaultBuffer}
                onChange={(event) => setDefaultBuffer(Number(event.target.value))}
              />
            </label>
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

          <div className="timeline">
            {schedule.map((item, index) => {
              if (item.type === 'static') {
                const staticAgendaItem = agenda[index];
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
                            onClick={() => handleMoveAgendaItem(index, -1)}
                            disabled={!canMoveAgendaItem(index, -1)}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMoveAgendaItem(index, 1)}
                            disabled={!canMoveAgendaItem(index, 1)}
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
                              staticAgendaItem.id,
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

              return (
                <article className="timeline-card talk-card" key={item.id}>
                  <div className="time-column">
                    <strong>{formatTime(item.start)}</strong>
                    <span>{formatTime(item.end)}</span>
                  </div>
                  <div className="timeline-body">
                    <div className="timeline-heading">
                      <div>
                        <p className="item-tag">Talk session</p>
                        <h3>{item.proposal.title}</h3>
                        <p className="speaker-line">
                          {item.proposal.speakerName}
                          {item.proposal.speakerAffiliation
                            ? `, ${item.proposal.speakerAffiliation}`
                            : ''}
                        </p>
                      </div>
                      <div className="move-controls">
                        <button
                          onClick={() => handleMoveAgendaItem(index, -1)}
                          disabled={!canMoveAgendaItem(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveAgendaItem(index, 1)}
                          disabled={!canMoveAgendaItem(index, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    <div className="session-grid">
                      <label className="inline-field">
                        Talk
                        <select
                          value={item.session.talkDuration}
                          onChange={(event) =>
                            handleSessionChange(
                              item.session.id,
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
                          value={item.session.qaDuration}
                          onChange={(event) =>
                            handleSessionChange(
                              item.session.id,
                              'qaDuration',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label className="inline-field">
                        Buffer
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={item.session.bufferDuration}
                          onChange={(event) =>
                            handleSessionChange(
                              item.session.id,
                              'bufferDuration',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="session-footer">
                      <span>Total session: {item.duration} min</span>
                      <button
                        className="secondary-button danger-button"
                        onClick={() => handleRemoveSession(item.session.id)}
                      >
                        Remove
                      </button>
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
            <Stat label="Scheduled talks" value={String(sessions.length)} />
            <Stat label="Talk minutes" value={`${totalTalkMinutes} min`} />
            <Stat label="Q&A minutes" value={`${totalQaMinutes} min`} />
            <Stat label="Buffer minutes" value={`${totalBufferMinutes} min`} />
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
            <h3>Unscheduled proposals</h3>
            {unscheduledProposals.length === 0 ? (
              <p>All proposals are currently on the agenda.</p>
            ) : (
              unscheduledProposals.map((proposal) => (
                <article className="unscheduled-card" key={proposal.id}>
                  <div>
                    <h4>{proposal.title}</h4>
                    <p className="speaker-line">
                      {proposal.speakerName}
                      {proposal.speakerAffiliation
                        ? `, ${proposal.speakerAffiliation}`
                        : ''}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => handleAddToAgenda(proposal)}
                  >
                    Schedule
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

export default App;
