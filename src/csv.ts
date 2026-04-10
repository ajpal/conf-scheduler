import {
  AgendaItem,
  DurationMinutes,
  DurationPreference,
  DurationPreferenceMap,
  SessionGroup,
  StaticBlockKind,
  TalkProposal,
} from './types';

type CsvRecord = Record<string, string>;

const DURATION_COLUMNS = [
  { duration: 5 as const, keyFragment: '[5 minutes]' },
  { duration: 10 as const, keyFragment: '[10 minutes]' },
  { duration: 15 as const, keyFragment: '[15 minutes]' },
];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function rowsToRecords(rows: string[][]): CsvRecord[] {
  if (rows.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      record[header] = dataRow[index] ?? '';
    });
    return record;
  });
}

function findHeader(headers: string[], matcher: (header: string) => boolean): string | undefined {
  return headers.find(matcher);
}

function normalizePreference(value: string): string {
  return value.trim().toLowerCase();
}

function parsePreference(value: string): DurationPreference {
  const normalized = normalizePreference(value);
  if (normalized === 'top preference') {
    return 'top';
  }
  if (normalized === 'acceptable') {
    return 'acceptable';
  }
  return 'not_interested';
}

function getDurationPreferences(
  record: CsvRecord,
  headers: string[],
): DurationPreferenceMap {
  const preferences: DurationPreferenceMap = {
    5: 'not_interested',
    10: 'not_interested',
    15: 'not_interested',
  };

  for (const column of DURATION_COLUMNS) {
    const header = headers.find((candidate) => candidate.includes(column.keyFragment));
    if (!header) {
      continue;
    }

    preferences[column.duration] = parsePreference(record[header] ?? '');
  }

  return preferences;
}

function choosePreferredDuration(
  durationPreferences: DurationPreferenceMap,
): DurationMinutes {
  const topPreferences: Array<5 | 10 | 15> = [];
  const acceptablePreferences: Array<5 | 10 | 15> = [];

  for (const column of DURATION_COLUMNS) {
    const preference = durationPreferences[column.duration];
    if (preference === 'top') {
      topPreferences.push(column.duration);
    } else if (preference === 'acceptable') {
      acceptablePreferences.push(column.duration);
    }
  }

  if (topPreferences.length > 0) {
    return topPreferences[0];
  }

  if (acceptablePreferences.length > 0) {
    return acceptablePreferences[0];
  }

  return 10;
}

function mergePreference(
  left: DurationPreference,
  right: DurationPreference,
): DurationPreference {
  const rank: Record<DurationPreference, number> = {
    not_interested: 0,
    acceptable: 1,
    top: 2,
  };

  return rank[left] >= rank[right] ? left : right;
}

function condenseDuplicateProposals(proposals: TalkProposal[]): TalkProposal[] {
  const merged = new Map<string, TalkProposal>();

  for (const proposal of proposals) {
    const speakerKey = proposal.speakerName.trim().toLowerCase();
    const existing = merged.get(speakerKey);

    if (!existing) {
      merged.set(speakerKey, proposal);
      continue;
    }

    const titleParts = new Set(
      `${existing.title}|||${proposal.title}`
        .split('|||')
        .map((title) => title.trim())
        .filter(Boolean),
    );
    const affiliationParts = new Set(
      `${existing.speakerAffiliation}|||${proposal.speakerAffiliation}`
        .split('|||')
        .map((affiliation) => affiliation.trim())
        .filter(Boolean),
    );
    const abstractParts = [
      existing.abstract.trim(),
      proposal.abstract.trim(),
    ].filter(Boolean);
    const existingPreferences = existing.durationPreferences ?? {
      5: existing.preferredTalkDuration === 5 ? 'top' : 'not_interested',
      10: existing.preferredTalkDuration === 10 ? 'top' : 'not_interested',
      15: existing.preferredTalkDuration === 15 ? 'top' : 'not_interested',
    };
    const nextPreferences = proposal.durationPreferences ?? {
      5: proposal.preferredTalkDuration === 5 ? 'top' : 'not_interested',
      10: proposal.preferredTalkDuration === 10 ? 'top' : 'not_interested',
      15: proposal.preferredTalkDuration === 15 ? 'top' : 'not_interested',
    };
    const mergedPreferences: DurationPreferenceMap = {
      5: mergePreference(existingPreferences[5], nextPreferences[5]),
      10: mergePreference(existingPreferences[10], nextPreferences[10]),
      15: mergePreference(existingPreferences[15], nextPreferences[15]),
    };

    merged.set(speakerKey, {
      ...existing,
      speakerAffiliation: Array.from(affiliationParts).join(' / '),
      title: Array.from(titleParts).join(' / '),
      abstract: Array.from(new Set(abstractParts)).join('\n\n'),
      durationPreferences: mergedPreferences,
      preferredTalkDuration: choosePreferredDuration(mergedPreferences),
    });
  }

  return Array.from(merged.values());
}

export function proposalsFromCsv(text: string): TalkProposal[] {
  const rows = parseCsv(text);
  const records = rowsToRecords(rows);
  const headers = rows[0] ?? [];

  const nameHeader = findHeader(headers, (header) => header.trim() === 'Name');
  const affiliationHeader = findHeader(headers, (header) => header.trim() === 'Affiliation');
  const titleHeader = findHeader(headers, (header) => header.includes('Title of your presentation'));
  const abstractHeader = findHeader(
    headers,
    (header) => header.includes('Short description of your presentation'),
  );

  if (!nameHeader || !titleHeader || !abstractHeader) {
    throw new Error('Missing required proposal columns.');
  }

  const proposals = records
    .filter((record) => {
      const name = (record[nameHeader] ?? '').trim();
      const title = (record[titleHeader] ?? '').trim();
      return name !== '' && title !== '';
    })
    .map((record, index) => {
      const durationPreferences = getDurationPreferences(record, headers);

      return {
        id: `talk-import-${index + 1}`,
        speakerName: (record[nameHeader] ?? '').trim(),
        speakerAffiliation: affiliationHeader ? (record[affiliationHeader] ?? '').trim() : '',
        title: (record[titleHeader] ?? '').trim(),
        abstract: (record[abstractHeader] ?? '').trim(),
        preferredTalkDuration: choosePreferredDuration(durationPreferences),
        durationPreferences,
      };
    });

  return condenseDuplicateProposals(proposals);
}

function escapeCsvCell(value: string | number): string {
  const stringValue = String(value);
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

type ScheduleCsvRow = {
  rowType: 'static' | 'session';
  agendaId: string;
  sessionGroupId: string;
  title: string;
  kind: string;
  duration: number;
  fixedStart: string;
  transitionDuration: string;
  slotId: string;
  slotIndex: string;
  talkDuration: string;
  qaDuration: string;
  proposalId: string;
  proposalTitle: string;
  speakerName: string;
  targetEnd: string;
};

function matchProposal(
  record: CsvRecord,
  proposals: TalkProposal[],
): TalkProposal | null {
  const proposalId = (record.proposalId ?? '').trim();
  const title = (record.proposalTitle ?? '').trim();
  const speakerName = (record.speakerName ?? '').trim();

  if (proposalId) {
    const byId = proposals.find((proposal) => proposal.id === proposalId);
    if (byId) {
      return byId;
    }
  }

  if (title || speakerName) {
    const normalizedTitle = title.toLowerCase();
    const normalizedSpeaker = speakerName.toLowerCase();
    const byIdentity = proposals.find(
      (proposal) =>
        proposal.title.trim().toLowerCase() === normalizedTitle &&
        proposal.speakerName.trim().toLowerCase() === normalizedSpeaker,
    );
    if (byIdentity) {
      return byIdentity;
    }
  }

  return null;
}

export function serializeScheduleToCsv(
  agenda: AgendaItem[],
  sessionGroups: SessionGroup[],
  proposals: TalkProposal[],
  targetEnd: number,
): string {
  const sessionGroupsById = new Map(
    sessionGroups.map((sessionGroup) => [sessionGroup.id, sessionGroup]),
  );
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const headers: Array<keyof ScheduleCsvRow> = [
    'rowType',
    'agendaId',
    'sessionGroupId',
    'title',
    'kind',
    'duration',
    'fixedStart',
    'transitionDuration',
    'slotId',
    'slotIndex',
    'talkDuration',
    'qaDuration',
    'proposalId',
    'proposalTitle',
    'speakerName',
    'targetEnd',
  ];

  const rows: ScheduleCsvRow[] = [];

  for (const item of agenda) {
    if (item.type === 'static') {
      rows.push({
        rowType: 'static',
        agendaId: item.id,
        sessionGroupId: '',
        title: item.title,
        kind: item.kind,
        duration: item.duration,
        fixedStart: item.fixedStart !== undefined ? String(item.fixedStart) : '',
        transitionDuration: '',
        slotId: '',
        slotIndex: '',
        talkDuration: '',
        qaDuration: '',
        proposalId: '',
        proposalTitle: '',
        speakerName: '',
        targetEnd: String(targetEnd),
      });
      continue;
    }

    const sessionGroup = sessionGroupsById.get(item.sessionGroupId);
    if (!sessionGroup) {
      continue;
    }

    sessionGroup.slots.forEach((slot, slotIndex) => {
      const proposal = slot.proposalId ? proposalsById.get(slot.proposalId) : undefined;
      rows.push({
        rowType: 'session',
        agendaId: item.id,
        sessionGroupId: sessionGroup.id,
        title: sessionGroup.title,
        kind: '',
        duration: 0,
        fixedStart: '',
        transitionDuration: String(sessionGroup.transitionDuration),
        slotId: slot.id,
        slotIndex: String(slotIndex),
        talkDuration: String(slot.talkDuration),
        qaDuration: String(slot.qaDuration),
        proposalId: slot.proposalId ?? '',
        proposalTitle: proposal?.title ?? '',
        speakerName: proposal?.speakerName ?? '',
        targetEnd: String(targetEnd),
      });
    });
  }

  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvCell(row[header])).join(','),
    ),
  ].join('\n');
}

export function scheduleStateFromCsv(
  text: string,
  proposals: TalkProposal[],
): {
  agenda: AgendaItem[];
  sessionGroups: SessionGroup[];
  targetEnd: number | null;
} {
  const rows = parseCsv(text);
  const records = rowsToRecords(rows);
  const agenda: AgendaItem[] = [];
  const sessionGroups: SessionGroup[] = [];
  const sessionGroupIndex = new Map<string, number>();
  let targetEnd: number | null = null;

  for (const record of records) {
    if (targetEnd === null) {
      const parsedTargetEnd = Number(record.targetEnd ?? '');
      if (!Number.isNaN(parsedTargetEnd) && parsedTargetEnd > 0) {
        targetEnd = parsedTargetEnd;
      }
    }

    const rowType = (record.rowType ?? '').trim();
    if (rowType === 'static') {
      agenda.push({
        id: (record.agendaId ?? '').trim() || `agenda-static-${agenda.length + 1}`,
        type: 'static',
        kind: ((record.kind ?? 'break') as StaticBlockKind),
        title: (record.title ?? '').trim() || 'Block',
        duration: Number(record.duration ?? 0) || 0,
        fixedStart:
          (record.fixedStart ?? '').trim() !== ''
            ? Number(record.fixedStart)
            : undefined,
      });
      continue;
    }

    if (rowType !== 'session') {
      continue;
    }

    const sessionGroupId =
      (record.sessionGroupId ?? '').trim() || `session-group-${sessionGroups.length + 1}`;
    const agendaId = (record.agendaId ?? '').trim() || `agenda-session-${agenda.length + 1}`;
    let groupPosition = sessionGroupIndex.get(sessionGroupId);

    if (groupPosition === undefined) {
      groupPosition = sessionGroups.length;
      sessionGroupIndex.set(sessionGroupId, groupPosition);
      sessionGroups.push({
        id: sessionGroupId,
        title: (record.title ?? '').trim() || `Session ${sessionGroups.length + 1}`,
        transitionDuration: Number(record.transitionDuration ?? 0) || 0,
        slots: [],
      });
      agenda.push({
        id: agendaId,
        type: 'session',
        sessionGroupId,
      });
    }

    const matchedProposal = matchProposal(record, proposals);
    sessionGroups[groupPosition].slots.push({
      id: (record.slotId ?? '').trim() || `slot-${sessionGroups[groupPosition].slots.length + 1}`,
      proposalId: matchedProposal?.id ?? null,
      talkDuration: Number(record.talkDuration ?? 0) || 0,
      qaDuration: Number(record.qaDuration ?? 0) || 0,
    });
  }

  return { agenda, sessionGroups, targetEnd };
}
