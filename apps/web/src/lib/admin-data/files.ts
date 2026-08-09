import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

/**
 * Lecture serveur des fichiers d'annuaire (SA-039, MASTER PROMPT §37).
 *
 * CSV  : décodage UTF-8 strict avec repli Windows-1252 (les exports
 *        d'annuaire historiques viennent d'Excel français), détection du
 *        séparateur (`;`, `,`, tabulation), guillemets RFC 4180.
 * XLSX : lecteur minimal ZIP + XML écrit ici même — aucune dépendance
 *        externe. Il lit les cellules texte, nombre et chaînes partagées
 *        de la feuille « ISE_IMPORT » (ou de la première feuille). Les
 *        dates Excel non typées restent des numéros de série : la
 *        validation serveur les signale plutôt que de les deviner.
 *
 * Dans tous les cas, la valeur BRUTE de chaque cellule est conservée :
 * aucune normalisation ici, elle appartient aux étapes SQL du protocole
 * (validation, normalisation sans perte).
 */

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
/** Garde-fou serveur : au-delà, le fichier doit être découpé. */
export const MAX_IMPORT_ROWS = 20000;

export type ImportFileFormat = 'csv' | 'xlsx';

export interface ParsedImportRow {
  /** Numéro de ligne de DONNÉES (1 = première ligne sous les en-têtes). */
  n: number;
  d: Record<string, string>;
}

export type ParsedImportFile =
  | { ok: true; format: ImportFileFormat; headers: string[]; rows: ParsedImportRow[] }
  | { ok: false; error: string };

export function detectImportFormat(filename: string): ImportFileFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return null;
}

export function fileChecksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function parseImportFile(filename: string, bytes: Uint8Array): ParsedImportFile {
  const format = detectImportFormat(filename);
  if (format === null) return { ok: false, error: 'file_format_unsupported' };
  if (bytes.length === 0) return { ok: false, error: 'file_empty' };
  try {
    const table = format === 'csv' ? parseCsvBytes(bytes) : parseXlsxBytes(bytes);
    if (!table.ok) return table;
    return toRecords(format, table.grid);
  } catch {
    return { ok: false, error: 'file_unreadable' };
  }
}

/* ------------------------------------------------------------------ */
/* Grille -> enregistrements                                           */
/* ------------------------------------------------------------------ */

type GridResult = { ok: true; grid: string[][] } | { ok: false; error: string };

function toRecords(format: ImportFileFormat, grid: string[][]): ParsedImportFile {
  const nonEmpty = grid.filter((row) => row.some((cell) => cell.trim().length > 0));
  const headerRow = nonEmpty[0];
  if (headerRow === undefined) return { ok: false, error: 'file_empty' };

  const headers = dedupeHeaders(headerRow);
  if (headers.every((h) => h.startsWith('colonne_'))) {
    // Aucune en-tête nommée : impossible de mapper quoi que ce soit.
    return { ok: false, error: 'file_no_headers' };
  }

  const dataRows = nonEmpty.slice(1);
  if (dataRows.length === 0) return { ok: false, error: 'file_empty' };
  if (dataRows.length > MAX_IMPORT_ROWS) return { ok: false, error: 'file_too_large' };

  // Chaque enregistrement porte TOUTES les en-têtes, y compris à vide :
  // l'étape de mapping serveur exige une décision pour chaque colonne du
  // fichier, et la détecte sur les clés réellement présentes en staging.
  const rows: ParsedImportRow[] = dataRows.map((cells, index) => {
    const record: Record<string, string> = {};
    headers.forEach((header, col) => {
      record[header] = (cells[col] ?? '').trim();
    });
    return { n: index + 1, d: record };
  });

  return { ok: true, format, headers, rows };
}

/** En-têtes vides ou en double : nommées explicitement, jamais écrasées. */
function dedupeHeaders(headerRow: string[]): string[] {
  const seen = new Map<string, number>();
  return headerRow.map((rawHeader, index) => {
    const base = rawHeader.trim() === '' ? `colonne_${index + 1}` : rawHeader.trim();
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

export function decodeCsvBytes(bytes: Uint8Array): string {
  // BOM UTF-8 : retiré. Sinon : UTF-8 strict, et si le flux n'est pas de
  // l'UTF-8 valide, l'export vient d'Excel Windows -> Windows-1252.
  const body =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return new TextDecoder('windows-1252').decode(body);
  }
}

export function sniffDelimiter(firstLine: string): string {
  const candidates = [';', ',', '\t'] as const;
  let best: string = ';';
  let bestCount = -1;
  for (const candidate of candidates) {
    let count = 0;
    let inQuotes = false;
    for (const char of firstLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === candidate && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function parseCsvBytes(bytes: Uint8Array): GridResult {
  const text = decodeCsvBytes(bytes);
  const firstLineEnd = text.indexOf('\n');
  const delimiter = sniffDelimiter(firstLineEnd === -1 ? text : text.slice(0, firstLineEnd));
  return { ok: true, grid: parseCsvText(text, delimiter) };
}

/** RFC 4180 : guillemets doublés, séparateurs et sauts de ligne cités. */
export function parseCsvText(text: string, delimiter: string): string[][] {
  const grid: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    grid.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i] as string;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
      continue;
    }
    if (char === '"' && cell.length === 0) {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      pushCell();
      i += 1;
      continue;
    }
    if (char === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    cell += char;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return grid;
}

/* ------------------------------------------------------------------ */
/* XLSX — lecteur ZIP + XML minimal                                    */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function readZipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // EOCD : signature 0x06054b50, cherchée depuis la fin (commentaire <= 64 Ko).
  const minEocd = 22;
  let eocd = -1;
  const scanStart = Math.max(0, bytes.length - minEocd - 65536);
  for (let i = bytes.length - minEocd; i >= scanStart; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('zip_eocd_not_found');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder('utf-8').decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    entries.set(name, { name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipFile(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error('zip_local_header');
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return new Uint8Array(inflateRawSync(data));
  throw new Error('zip_method_unsupported');
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Concatène tous les fragments `<t>` d'un bloc (texte riche compris). */
function textOf(xmlFragment: string): string {
  let out = '';
  const matcher = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(xmlFragment)) !== null) {
    out += decodeXmlEntities(match[1] ?? '');
  }
  return out;
}

function columnIndex(cellRef: string): number {
  let index = 0;
  for (const char of cellRef) {
    if (char < 'A' || char > 'Z') break;
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

const PREFERRED_SHEET = 'ISE_IMPORT';

function parseXlsxBytes(bytes: Uint8Array): GridResult {
  const entries = readZipEntries(bytes);
  const utf8 = new TextDecoder('utf-8');

  const workbookEntry = entries.get('xl/workbook.xml');
  if (workbookEntry === undefined) return { ok: false, error: 'xlsx_sheet_not_found' };
  const workbookXml = utf8.decode(readZipFile(bytes, workbookEntry));

  // Feuilles déclarées : nom + identifiant de relation.
  const sheets: { name: string; relId: string }[] = [];
  const sheetMatcher = /<sheet\s[^>]*?>/g;
  let sheetTag: RegExpExecArray | null;
  while ((sheetTag = sheetMatcher.exec(workbookXml)) !== null) {
    const tag = sheetTag[0];
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    const relId = /r:id="([^"]*)"/.exec(tag)?.[1];
    if (name !== undefined && relId !== undefined) {
      sheets.push({ name: decodeXmlEntities(name), relId });
    }
  }
  if (sheets.length === 0) return { ok: false, error: 'xlsx_sheet_not_found' };

  const chosen =
    sheets.find((s) => s.name.trim().toUpperCase() === PREFERRED_SHEET) ??
    (sheets[0] as {
      name: string;
      relId: string;
    });

  // Relations : rId -> chemin de la feuille dans l'archive.
  const relsEntry = entries.get('xl/_rels/workbook.xml.rels');
  if (relsEntry === undefined) return { ok: false, error: 'xlsx_sheet_not_found' };
  const relsXml = utf8.decode(readZipFile(bytes, relsEntry));
  const relMatch = new RegExp(`<Relationship\\s[^>]*Id="${chosen.relId}"[^>]*?/?>`).exec(relsXml);
  const target = relMatch === null ? undefined : /Target="([^"]*)"/.exec(relMatch[0])?.[1];
  if (target === undefined) return { ok: false, error: 'xlsx_sheet_not_found' };
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;

  const sheetEntry = entries.get(sheetPath);
  if (sheetEntry === undefined) return { ok: false, error: 'xlsx_sheet_not_found' };
  const sheetXml = utf8.decode(readZipFile(bytes, sheetEntry));

  // Chaînes partagées (facultatives).
  const sharedStrings: string[] = [];
  const sharedEntry = entries.get('xl/sharedStrings.xml');
  if (sharedEntry !== undefined) {
    const sharedXml = utf8.decode(readZipFile(bytes, sharedEntry));
    const siMatcher = /<si>([\s\S]*?)<\/si>/g;
    let si: RegExpExecArray | null;
    while ((si = siMatcher.exec(sharedXml)) !== null) {
      sharedStrings.push(textOf(si[1] ?? ''));
    }
  }

  const grid: string[][] = [];
  const rowMatcher = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowMatcher.exec(sheetXml)) !== null) {
    const cells: string[] = [];
    const cellMatcher = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellMatcher.exec(rowMatch[1] ?? '')) !== null) {
      const attrs = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]*)"/.exec(attrs)?.[1] ?? 'n';
      const col = ref === undefined ? cells.length : columnIndex(ref);

      let value = '';
      if (type === 's') {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        const index = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
        value = Number.isNaN(index) ? '' : (sharedStrings[index] ?? '');
      } else if (type === 'inlineStr') {
        value = textOf(body);
      } else if (type === 'b') {
        value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] === '1' ? 'true' : 'false';
      } else {
        // 'n', 'str' et types datés : la valeur brute de <v>, sans
        // interprétation. Un numéro de série Excel restera visible tel
        // quel et sera signalé par la validation, pas converti au hasard.
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        value = raw === undefined ? '' : decodeXmlEntities(raw);
      }

      while (cells.length < col) cells.push('');
      cells[col] = value;
    }
    grid.push(cells);
  }

  return { ok: true, grid };
}
