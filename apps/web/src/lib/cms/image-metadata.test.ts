import { describe, expect, it } from 'vitest';
import {
  CMS_MEDIA_MAX_BYTES,
  CMS_MEDIA_USAGES,
  formatBytes,
  inspectImage,
  isCmsMediaUsage,
  mediaStoragePath,
} from './image-metadata';

/**
 * Tests du pipeline d'image (ADDENDUM §39, etapes 1 et 5).
 *
 * Ils portent sur ce que le code fait REELLEMENT : valider le format par
 * le contenu du fichier et lire les dimensions dans l'en-tete binaire. La
 * generation des variantes n'est pas testee parce qu'elle n'est pas
 * implementee — un test vert sur une fonctionnalite absente serait pire
 * qu'aucun test.
 */

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13); // longueur du chunk IHDR
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // « IHDR »
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0xff, 0xd8], 0); // SOI
  bytes.set([0xff, 0xc0], 2); // SOF0
  const view = new DataView(bytes.buffer);
  view.setUint16(4, 17); // longueur du segment
  bytes[6] = 8; // precision
  view.setUint16(7, height);
  view.setUint16(9, width);
  return bytes;
}

/** JPEG portant un DHT (0xC4) AVANT le SOF0 : le piege classique. */
function jpegWithHuffmanFirst(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xc4], 2); // DHT — surtout PAS un SOF
  view.setUint16(4, 10);
  bytes.set([0xff, 0xc0], 14); // SOF0 reel
  view.setUint16(16, 17);
  bytes[18] = 8;
  view.setUint16(19, height);
  view.setUint16(21, width);
  return bytes;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // « RIFF »
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // « WEBP »
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // « VP8X »
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  bytes.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return bytes;
}

function webpVp8(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x20], 12); // « VP8 »
  bytes.set([0x9d, 0x01, 0x2a], 23); // code de synchronisation
  bytes[26] = width & 0xff;
  bytes[27] = (width >> 8) & 0x3f;
  bytes[28] = height & 0xff;
  bytes[29] = (height >> 8) & 0x3f;
  return bytes;
}

describe('inspectImage', () => {
  it('lit les dimensions d’un PNG dans son chunk IHDR', () => {
    const result = inspectImage(png(1600, 900));
    expect(result).toEqual({
      ok: true,
      metadata: { mimeType: 'image/png', width: 1600, height: 900 },
    });
  });

  it('lit les dimensions d’un JPEG dans son marqueur SOF0', () => {
    const result = inspectImage(jpeg(1200, 628));
    expect(result).toEqual({
      ok: true,
      metadata: { mimeType: 'image/jpeg', width: 1200, height: 628 },
    });
  });

  it('ne confond pas un marqueur DHT (0xC4) avec un SOF', () => {
    const result = inspectImage(jpegWithHuffmanFirst(800, 600));
    expect(result).toEqual({
      ok: true,
      metadata: { mimeType: 'image/jpeg', width: 800, height: 600 },
    });
  });

  it('lit les dimensions d’un WebP étendu (VP8X)', () => {
    const result = inspectImage(webpVp8x(1440, 810));
    expect(result).toEqual({
      ok: true,
      metadata: { mimeType: 'image/webp', width: 1440, height: 810 },
    });
  });

  it('lit les dimensions d’un WebP simple (VP8 )', () => {
    const result = inspectImage(webpVp8(375, 500));
    expect(result).toEqual({
      ok: true,
      metadata: { mimeType: 'image/webp', width: 375, height: 500 },
    });
  });

  /**
   * AVIF est accepte par le bucket public depuis 0068. Fixture minimale :
   * une marque `ftypavif`, puis une boite `ispe` portant les dimensions.
   */
  it('lit les dimensions d’un AVIF dans sa boîte ispe', () => {
    const bytes = new Uint8Array(64);
    bytes.set([0x00, 0x00, 0x00, 0x20], 0);
    bytes.set([0x66, 0x74, 0x79, 0x70], 4); // « ftyp »
    bytes.set([0x61, 0x76, 0x69, 0x66], 8); // marque « avif »
    bytes.set([0x69, 0x73, 0x70, 0x65], 32); // boîte « ispe »
    bytes.set([0x00, 0x00, 0x05, 0xa0], 40); // largeur 1440
    bytes.set([0x00, 0x00, 0x03, 0x2a], 44); // hauteur 810
    expect(inspectImage(bytes)).toEqual({
      ok: true,
      metadata: { mimeType: 'image/avif', width: 1440, height: 810 },
    });
  });

  /**
   * Un SVG est un document XML capable de porter du script. Le bucket
   * `landing-media` etant PUBLIC, il serait servi sur le domaine Supabase,
   * donc dans son contexte d'origine. Refus categorique (0068).
   */
  it('refuse un SVG, même bien formé', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(inspectImage(svg)).toEqual({ ok: false, error: 'invalid_type' });
  });

  it('refuse un fichier qui n’est pas une image, quel que soit son nom', () => {
    const notAnImage = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // « %PDF- »
    expect(inspectImage(notAnImage)).toEqual({ ok: false, error: 'invalid_type' });
  });

  it('refuse un fichier vide', () => {
    expect(inspectImage(new Uint8Array(0))).toEqual({ ok: false, error: 'invalid_image' });
  });

  it('refuse un fichier au-delà de la borne du bucket', () => {
    const tooLarge = new Uint8Array(CMS_MEDIA_MAX_BYTES + 1);
    tooLarge.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    expect(inspectImage(tooLarge)).toEqual({ ok: false, error: 'invalid_size' });
  });

  it('refuse un PNG tronqué plutôt que d’inventer des dimensions', () => {
    const truncated = png(100, 100).slice(0, 20);
    expect(inspectImage(truncated)).toEqual({ ok: false, error: 'unreadable_dimensions' });
  });

  it('refuse un PNG déclarant une dimension nulle', () => {
    expect(inspectImage(png(0, 900))).toEqual({ ok: false, error: 'unreadable_dimensions' });
  });
});

describe('mediaStoragePath', () => {
  it('préfixe par l’usage, puis segmente par année et par mois', () => {
    const at = new Date('2026-08-08T10:00:00Z');
    expect(mediaStoragePath('carousel', 'abc', 'image/webp', at)).toBe('carousel/2026/08/abc.webp');
    expect(mediaStoragePath('news', 'abc', 'image/jpeg', at)).toBe('news/2026/08/abc.jpg');
    expect(mediaStoragePath('partners', 'abc', 'image/png', at)).toBe('partners/2026/08/abc.png');
    expect(mediaStoragePath('sections', 'abc', 'image/avif', at)).toBe('sections/2026/08/abc.avif');
  });

  /**
   * Le premier segment n'est pas decoratif : `ise_landing_media_insert`
   * (0068) refuse tout depot hors des quatre usages. Ce test verifie que le
   * chemin produit est bien accepte par cette regle.
   */
  it('produit un premier segment que la politique Storage accepte', () => {
    const at = new Date('2026-08-08T10:00:00Z');
    for (const usage of CMS_MEDIA_USAGES) {
      const path = mediaStoragePath(usage, 'id', 'image/png', at);
      expect(path.split('/')[0]).toBe(usage);
      expect(isCmsMediaUsage(path.split('/')[0])).toBe(true);
    }
  });

  it('utilise l’heure UTC, pas l’heure locale du serveur', () => {
    // 31 décembre 23:30 UTC : en Europe/Paris on serait déjà le 1er janvier.
    const at = new Date('2026-12-31T23:30:00Z');
    expect(mediaStoragePath('sections', 'x', 'image/png', at)).toBe('sections/2026/12/x.png');
  });
});

describe('formatBytes', () => {
  it('rend un poids lisible', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(2048)).toBe('2 ko');
    expect(formatBytes(1_572_864)).toBe('1,5 Mo');
  });
});
