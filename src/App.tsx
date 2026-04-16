import { ChangeEvent, useMemo, useState } from 'react';
import {
  proposalsFromCsv,
  scheduleStateFromCsv,
  serializeScheduleToCsv,
} from './csv';
import { createDefaultScheduleState } from './defaultSchedule';
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
  sessionTitle: string;
  shortCount: number;
  mediumCount: number;
  longCount: number;
  transitionDuration: number;
  defaultQaDuration: number;
};

const initialProposalForm: NewProposalForm = {
  speakerName: '',
  speakerAffiliation: '',
  title: '',
  abstract: '',
  preferredTalkDuration: '10',
};

const initialSessionForm: NewSessionTemplateForm = {
  sessionTitle: '',
  shortCount: 2,
  mediumCount: 0,
  longCount: 1,
  transitionDuration: 2,
  defaultQaDuration: 0,
};

const defaultScheduleState = createDefaultScheduleState();

function App() {
  const [proposals, setProposals] = useState<TalkProposal[]>([]);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>(
    defaultScheduleState.sessionGroups,
  );
  const [agenda, setAgenda] = useState<AgendaItem[]>(defaultScheduleState.agenda);
  const [proposalForm, setProposalForm] = useState(initialProposalForm);
  const [sessionForm, setSessionForm] = useState(initialSessionForm);
  const [targetEnd, setTargetEnd] = useState(TARGET_END);
  const [isScheduleViewOpen, setIsScheduleViewOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposalError, setProposalError] = useState('');

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
  const totalBufferMinutes = schedule.reduce(
    (total, item) => total + item.bufferBefore,
    0,
  );
  const shortTalkCount = sessionGroups.reduce(
    (total, sessionGroup) =>
      total + sessionGroup.slots.filter((slot) => slot.talkDuration <= 5).length,
    0,
  );
  const mediumTalkCount = sessionGroups.reduce(
    (total, sessionGroup) =>
      total +
      sessionGroup.slots.filter(
        (slot) => slot.talkDuration > 5 && slot.talkDuration <= 10,
      ).length,
    0,
  );
  const longTalkCount = sessionGroups.reduce(
    (total, sessionGroup) =>
      total + sessionGroup.slots.filter((slot) => slot.talkDuration > 10).length,
    0,
  );

  function getSessionLabel(sessionGroupId: string): string {
    const sessionIndex = agenda
      .filter((item): item is Extract<AgendaItem, { type: 'session' }> => item.type === 'session')
      .findIndex((item) => item.sessionGroupId === sessionGroupId);
    return `Session ${sessionIndex >= 0 ? sessionIndex + 1 : 1}`;
  }

  function getSessionDisplayTitle(sessionGroup: SessionGroup): string {
    const sessionLabel = getSessionLabel(sessionGroup.id);
    const sessionTitle = sessionGroup.sessionTitle.trim();
    if (!sessionTitle) {
      return sessionLabel;
    }
    return `${sessionLabel}: ${sessionTitle}`;
  }

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

    if (!speakerName || !title) {
      setProposalError('Speaker name and title are required.');
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
    setProposalError('');
    setIsProposalModalOpen(false);
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
      title: `Session ${sessionGroups.length + 1}`,
      sessionTitle: sessionForm.sessionTitle.trim(),
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
    field: keyof Pick<SessionGroup, 'sessionTitle' | 'transitionDuration'>,
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
                  qaDuration: talkDuration === 5 ? 0 : 3,
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
        const imported = proposalsFromCsv(text);
        setProposals(imported);
        setSessionGroups([]);
        setAgenda(defaultScheduleState.agenda.filter((item) => item.type === 'static'));
      })
      .catch(() => {
        window.alert('Unable to import proposals. Expected the conference CSV export.');
      })
      .finally(() => {
        event.target.value = '';
      });
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

  function handleExportSchedule() {
    const csv = serializeScheduleToCsv(agenda, sessionGroups, proposals, targetEnd);
    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'conference-schedule.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleExportScheduleHtml() {
    const rows = schedule
      .map((item, index) => {
        const nextItem = index < schedule.length - 1 ? schedule[index + 1] : null;
        const displayEnd =
          item.type === 'session' && nextItem ? nextItem.start : item.end;

        if (item.type === 'static') {
          return `
            <tr>
              <td>${escapeHtml(formatTime(item.start))}</td>
              <td>${escapeHtml(formatTime(displayEnd))}</td>
              <td>${escapeHtml(item.title)}</td>
              <td></td>
            </tr>
          `;
        }

        const details = item.sessionGroup.slots
          .map((slot) => {
            const proposal = slot.proposalId ? proposalsById.get(slot.proposalId) ?? null : null;
            const slotClass = getSlotLengthClass(slot.talkDuration);
            const label = proposal
              ? `${proposal.speakerName}: ${proposal.title}`
              : 'Unassigned';
            return `<div class="chip ${slotClass}"><span>${escapeHtml(
              label,
            )}</span><span class="chip-duration">${slot.talkDuration}+${slot.qaDuration}</span></div>`;
          })
          .join('');

        return `
          <tr>
            <td>${escapeHtml(formatTime(item.start))}</td>
            <td>${escapeHtml(formatTime(displayEnd))}</td>
            <td>${escapeHtml(getSessionDisplayTitle(item.sessionGroup))}</td>
            <td><div class="details">${details}</div></td>
          </tr>
        `;
      })
      .join('');

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Conference Schedule</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        font-family: "IBM Plex Sans", sans-serif;
        color: #1e1d1b;
        background: #f7f2e8;
      }
      h1 {
        margin: 0 0 16px;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
      }
      p {
        margin: 0 0 24px;
        color: #5e4f40;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: rgba(255, 251, 245, 0.95);
        border: 1px solid rgba(50, 43, 36, 0.12);
        border-radius: 16px;
        overflow: hidden;
      }
      th, td {
        padding: 12px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid rgba(85, 68, 53, 0.12);
      }
      th {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #7a6a5a;
      }
      .details {
        display: grid;
        gap: 8px;
      }
      .chip {
        display: inline-block;
        border-radius: 999px;
        padding: 6px 10px;
        color: #5e4f40;
      }
      .slot-short {
        background: rgba(230, 244, 233, 0.98);
        border: 1px solid rgba(73, 123, 80, 0.24);
      }
      .slot-medium {
        background: rgba(251, 243, 205, 0.98);
        border: 1px solid rgba(173, 139, 44, 0.24);
      }
      .slot-long {
        background: rgba(248, 226, 204, 0.98);
        border: 1px solid rgba(183, 108, 43, 0.24);
      }
    </style>
  </head>
  <body>
    <h1>Conference Schedule</h1>
    <p>Projected end: ${escapeHtml(formatTime(projectedEnd))} | Target end: ${escapeHtml(
      formatTime(targetEnd),
    )}</p>
    <table>
      <thead>
        <tr>
          <th>Start</th>
          <th>End</th>
          <th>Item</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
</html>`;

    const blob = new Blob([html], {
      type: 'text/html;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'conference-schedule.html';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImportSchedule(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file
      .text()
      .then((text) => {
        const imported = scheduleStateFromCsv(text, proposals);
        setAgenda(imported.agenda);
        setSessionGroups(imported.sessionGroups);
        if (imported.targetEnd !== null) {
          setTargetEnd(imported.targetEnd);
        }
        setIsScheduleViewOpen(false);
      })
      .catch(() => {
        window.alert('Unable to import schedule. Expected a schedule CSV exported by this app.');
      })
      .finally(() => {
        event.target.value = '';
      });
  }

  return (
    <div className="app-shell">
      <main className="layout">
        <section className="panel agenda-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Agenda Builder</p>
              <h2>Session-based timeline</h2>
            </div>
            <div className="panel-actions">
              <label className="secondary-button file-button">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportProposals}
                />
              </label>
              <button
                className="secondary-button"
                onClick={() => {
                  setProposalError('');
                  setIsProposalModalOpen(true);
                }}
              >
                Add Proposal
              </button>
              <label className="secondary-button file-button">
                Import Schedule
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportSchedule}
                />
              </label>
              <button
                className="secondary-button"
                onClick={() => setIsScheduleViewOpen((current) => !current)}
              >
                {isScheduleViewOpen ? 'Edit Schedule' : 'View Schedule'}
              </button>
              <button className="secondary-button" onClick={handleExportScheduleHtml}>
                Export HTML
              </button>
              <button className="primary-button" onClick={handleExportSchedule}>
                Export schedule
              </button>
            </div>
          </div>

          {isScheduleViewOpen ? (
            <div className="schedule-table-wrapper">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>Start</th>
                    <th>End</th>
                    <th>Item</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((item) => {
                    const currentIndex = schedule.findIndex((candidate) => candidate.id === item.id);
                    const nextItem =
                      currentIndex >= 0 && currentIndex < schedule.length - 1
                        ? schedule[currentIndex + 1]
                        : null;
                    const displayEnd =
                      item.type === 'session' && nextItem ? nextItem.start : item.end;

                    if (item.type === 'static') {
                      return (
                        <tr key={item.id}>
                          <td>{formatTime(item.start)}</td>
                          <td>{formatTime(displayEnd)}</td>
                          <td>{item.title}</td>
                          <td />
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.id}>
                        <td>{formatTime(item.start)}</td>
                        <td>{formatTime(displayEnd)}</td>
                        <td>{getSessionDisplayTitle(item.sessionGroup)}</td>
                        <td>
                          <div className="schedule-session-details">
                            {item.sessionGroup.slots.map((slot) => {
                              const proposal = slot.proposalId
                                ? proposalsById.get(slot.proposalId) ?? null
                                : null;
                              return (
                                <span
                                  className={`session-detail-chip ${getSlotLengthClass(
                                    slot.talkDuration,
                                  )}`}
                                  key={slot.id}
                                >
                                  <span>
                                    {proposal
                                      ? `${proposal.speakerName}: ${proposal.title}`
                                      : 'Unassigned'}
                                  </span>
                                  <span className="chip-duration">
                                    {slot.talkDuration}+{slot.qaDuration}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!isScheduleViewOpen ? (
            <>
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
                      value={sessionForm.sessionTitle}
                      onChange={(event) =>
                        updateSessionForm('sessionTitle', event.target.value)
                      }
                      placeholder="title"
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
                  <div key={item.id}>
                    {item.bufferBefore > 0 ? (
                      <div className="buffer-note">
                        Buffer: {item.bufferBefore} min before {item.title}
                      </div>
                    ) : null}
                    <article className="timeline-card static-card">
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
                  </div>
                );
              }

              const sessionStart = item.start;
              let slotCursor = sessionStart;

              return (
                <div key={item.id}>
                  {item.bufferBefore > 0 ? (
                    <div className="buffer-note">
                      Buffer: {item.bufferBefore} min before {getSessionDisplayTitle(item.sessionGroup)}
                    </div>
                  ) : null}
                  <article className="timeline-card session-card">
                    <div className="time-column">
                      <strong>{formatTime(item.start)}</strong>
                      <span>{formatTime(item.end)}</span>
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-heading">
                        <div>
                          <p className="item-tag">Session</p>
                          <h3>{getSessionDisplayTitle(item.sessionGroup)}</h3>
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
                            value={item.sessionGroup.sessionTitle}
                            onChange={(event) =>
                              handleSessionGroupChange(
                                item.sessionGroup.id,
                                'sessionTitle',
                                event.target.value,
                              )
                            }
                            placeholder="title"
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
                </div>
              );
                })}
              </div>
            </>
          ) : null}
        </section>

        <section className="panel summary-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Summary</p>
              <h2>Fit and coverage</h2>
            </div>
          </div>

          <div className="summary-grid">
            <SummaryBubble
              rows={[{ label: 'Sessions', value: `${sessionGroups.length}` }]}
            />
            <SummaryBubble
              rows={[
                { label: 'Short Talks', value: `${shortTalkCount}` },
                { label: 'Medium Talks', value: `${mediumTalkCount}` },
                { label: 'Long Talks', value: `${longTalkCount}` },
              ]}
            />
            <SummaryBubble
              rows={[
                { label: 'Talk Mins', value: `${totalTalkMinutes}` },
                { label: 'Q&A Mins', value: `${totalQaMinutes}` },
                { label: 'Transition Mins', value: `${totalTransitionMinutes}` },
                { label: 'Buffer Mins', value: `${totalBufferMinutes}` },
              ]}
            />
            <SummaryBubble
              tone={overflow > 0 ? 'warning' : 'ok'}
              rows={[
                { label: 'Projected End', value: formatTime(projectedEnd) },
                { label: 'Target End', value: formatTime(targetEnd) },
                {
                  label: 'Status',
                  value:
                    overflow > 0
                      ? `${overflow} min over`
                      : `${Math.abs(overflow)} min remaining`,
                },
              ]}
            />
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

      {isProposalModalOpen ? (
        <div className="modal-backdrop" onClick={() => setIsProposalModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Proposal</h3>
              <button
                className="slot-remove-button"
                onClick={() => {
                  setProposalError('');
                  setIsProposalModalOpen(false);
                }}
                aria-label="Close add proposal modal"
              >
                X
              </button>
            </div>
            {proposalError ? <p className="form-error">{proposalError}</p> : null}
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
                  rows={5}
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
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setProposalError('');
                  setIsProposalModalOpen(false);
                }}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={handleAddProposal}>
                Add proposal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SummaryBubbleProps = {
  rows: Array<{ label: string; value: string }>;
  tone?: 'ok' | 'warning';
};

function SummaryBubble({ rows, tone }: SummaryBubbleProps) {
  return (
    <div className={`stat-card summary-bubble ${tone ?? ''}`.trim()}>
      {rows.map((row) => (
        <div className="summary-row" key={row.label}>
          <span>{row.label}:</span>
          <strong>{row.value}</strong>
        </div>
      ))}
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default App;
