import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  decodeCsvBytes,
  detectImportFormat,
  fileChecksum,
  parseCsvText,
  parseImportFile,
  sniffDelimiter,
} from './files';
import { suggestTargetField } from './mapping';

/* ------------------------------------------------------------------ */
/* Aides : construction d'un vrai fichier XLSX (zip) en mémoire         */
/* ------------------------------------------------------------------ */

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const compressed = new Uint8Array(deflateRawSync(data));
    const checksum = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true); // deflate
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of [...locals, ...centrals, eocd]) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

function buildXlsx(sheetName: string, rows: string[][]): Uint8Array {
  const sheetXmlRows = rows
    .map(
      (cells, rowIndex) =>
        `<row r="${rowIndex + 1}">` +
        cells
          .map((value, colIndex) => {
            const ref = `${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`;
            if (/^-?\d+(\.\d+)?$/.test(value)) {
              return `<c r="${ref}"><v>${value}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')}</t></is></c>`;
          })
          .join('') +
        '</row>',
    )
    .join('');

  return buildZip({
    'xl/workbook.xml':
      '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0"?><Relationships>' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '</Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet><sheetData>${sheetXmlRows}</sheetData></worksheet>`,
  });
}

/* ------------------------------------------------------------------ */

describe('detectImportFormat', () => {
  it('reconnaît CSV et XLSX, refuse le reste', () => {
    expect(detectImportFormat('annuaire.CSV')).toBe('csv');
    expect(detectImportFormat('annuaire.xlsx')).toBe('xlsx');
    expect(detectImportFormat('annuaire.xls')).toBeNull();
    expect(detectImportFormat('annuaire.pdf')).toBeNull();
  });
});

describe('decodeCsvBytes', () => {
  it('décode l’UTF-8 avec BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Prénom')]);
    expect(decodeCsvBytes(bytes)).toBe('Prénom');
  });

  it('replie sur Windows-1252 quand le flux n’est pas de l’UTF-8', () => {
    // « Prénom » encodé Windows-1252 : é = 0xE9, invalide en UTF-8.
    const bytes = new Uint8Array([0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d]);
    expect(decodeCsvBytes(bytes)).toBe('Prénom');
  });
});

describe('sniffDelimiter', () => {
  it('détecte le point-virgule des exports Excel français', () => {
    expect(sniffDelimiter('Nom;Prénom;Email')).toBe(';');
    expect(sniffDelimiter('Nom,Prénom,Email')).toBe(',');
    expect(sniffDelimiter('Nom\tPrénom\tEmail')).toBe('\t');
  });

  it('ignore les séparateurs entre guillemets', () => {
    expect(sniffDelimiter('"Nom, complet";Email')).toBe(';');
  });
});

describe('parseCsvText', () => {
  it('gère guillemets doublés, retours à la ligne cités et CRLF', () => {
    const grid = parseCsvText('a;"b;""c"""\r\n"multi\nligne";d\r\n', ';');
    expect(grid).toEqual([
      ['a', 'b;"c"'],
      ['multi\nligne', 'd'],
    ]);
  });
});

describe('parseImportFile — CSV', () => {
  it('produit des enregistrements en-tête -> valeur, lignes vides exclues', () => {
    const csv = 'Nom;Prénom;Promotion\nDiallo;Aïcha;2003\n;;\nNdiaye;Moussa;1998\n';
    const parsed = parseImportFile('annuaire.csv', new TextEncoder().encode(csv));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.headers).toEqual(['Nom', 'Prénom', 'Promotion']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({
      n: 1,
      d: { Nom: 'Diallo', Prénom: 'Aïcha', Promotion: '2003' },
    });
    expect(parsed.rows[1]?.d['Nom']).toBe('Ndiaye');
  });

  it('refuse un fichier sans ligne de données', () => {
    const parsed = parseImportFile('vide.csv', new TextEncoder().encode('Nom;Prénom\n'));
    expect(parsed).toEqual({ ok: false, error: 'file_empty' });
  });

  it('nomme les en-têtes vides et dédouble les en-têtes répétées', () => {
    const csv = 'Nom;;Nom\nA;B;C\n';
    const parsed = parseImportFile('t.csv', new TextEncoder().encode(csv));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.headers).toEqual(['Nom', 'colonne_2', 'Nom_2']);
  });
});

describe('parseImportFile — XLSX', () => {
  it('lit une feuille ISE_IMPORT avec chaînes en ligne et nombres', () => {
    const bytes = buildXlsx('ISE_IMPORT', [
      ['Nom', 'Prénom', 'Promotion'],
      ['Diallo', 'Aïcha', '2003'],
      ['Ndiaye', 'Moussa', '1998'],
    ]);
    const parsed = parseImportFile('annuaire.xlsx', bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.format).toBe('xlsx');
    expect(parsed.headers).toEqual(['Nom', 'Prénom', 'Promotion']);
    expect(parsed.rows).toEqual([
      { n: 1, d: { Nom: 'Diallo', Prénom: 'Aïcha', Promotion: '2003' } },
      { n: 2, d: { Nom: 'Ndiaye', Promotion: '1998', Prénom: 'Moussa' } },
    ]);
  });

  it('refuse un fichier qui n’est pas une archive valide', () => {
    const parsed = parseImportFile('annuaire.xlsx', new TextEncoder().encode('pas un zip'));
    expect(parsed).toEqual({ ok: false, error: 'file_unreadable' });
  });
});

describe('fileChecksum', () => {
  it('est stable pour un même contenu — support de l’idempotence du lot', () => {
    const a = fileChecksum(new TextEncoder().encode('même contenu'));
    const b = fileChecksum(new TextEncoder().encode('même contenu'));
    const c = fileChecksum(new TextEncoder().encode('autre contenu'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('suggestTargetField', () => {
  it('propose les champs cibles depuis des en-têtes françaises variées', () => {
    expect(suggestTargetField('Prénom')).toBe('first_name');
    expect(suggestTargetField('NOM')).toBe('last_name');
    expect(suggestTargetField('Année de promotion')).toBe('promotion_year');
    expect(suggestTargetField('E-mail')).toBe('email');
    expect(suggestTargetField('Téléphone')).toBe('phone');
    expect(suggestTargetField('Employeur')).toBe('organization');
    expect(suggestTargetField('Colonne inconnue')).toBeNull();
  });
});
