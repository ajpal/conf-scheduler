import { TalkProposal } from './types';

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

function choosePreferredDuration(record: CsvRecord, headers: string[]): 5 | 10 | 15 {
  const topPreferences: Array<5 | 10 | 15> = [];
  const acceptablePreferences: Array<5 | 10 | 15> = [];

  for (const column of DURATION_COLUMNS) {
    const header = headers.find((candidate) => candidate.includes(column.keyFragment));
    if (!header) {
      continue;
    }

    const preference = normalizePreference(record[header] ?? '');
    if (preference === 'top preference') {
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

  return records
    .filter((record) => {
      const name = (record[nameHeader] ?? '').trim();
      const title = (record[titleHeader] ?? '').trim();
      return name !== '' && title !== '';
    })
    .map((record, index) => ({
      id: `talk-import-${index + 1}`,
      speakerName: (record[nameHeader] ?? '').trim(),
      speakerAffiliation: affiliationHeader ? (record[affiliationHeader] ?? '').trim() : '',
      title: (record[titleHeader] ?? '').trim(),
      abstract: (record[abstractHeader] ?? '').trim(),
      preferredTalkDuration: choosePreferredDuration(record, headers),
    }));
}
