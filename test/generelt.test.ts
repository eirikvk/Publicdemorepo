/* Tester for src/data/generelt: geometri, tall, farger, PNG og glisne rutenett. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  areal,
  flerflate,
  motKlokka,
  omriss,
  overlapper,
  snitt,
  tomt,
  utsnitt
} from '../src/data/generelt/geometri.ts';
import { summen } from '../src/data/generelt/tall.ts';
import { naermesteFarge } from '../src/data/generelt/farge.ts';
import { palettPng, pngBit, pngBiter } from '../src/data/generelt/png.ts';
import { finn, glissent, leggInnDelt, sett, verdi } from '../src/data/generelt/glissen.ts';
import { deflateSync } from 'node:zlib';

const kvadrat = (x: number, y: number, s: number) => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
  [x, y]
];

test('areal: ytterkant minus hull, uavhengig av omløpsretning', () => {
  assert.equal(areal([[kvadrat(0, 0, 10), kvadrat(4, 4, 2)]]), 96);
  assert.equal(areal([[kvadrat(0, 0, 10).reverse()]]), 100);
});

test('omløpsretning', () => {
  assert.equal(motKlokka(kvadrat(0, 0, 1)), true);
  assert.equal(motKlokka(kvadrat(0, 0, 1).reverse()), false);
});

test('utsnitt, omriss, snitt og overlapp', () => {
  const f = [[kvadrat(0, 0, 10), kvadrat(20, 20, 1)]];
  assert.deepEqual(utsnitt(f), [0, 0, 21, 21]);
  assert.deepEqual(omriss(f), [0, 0, 10, 10]);
  assert.deepEqual(snitt([0, 0, 10, 10], [5, 5, 20, 20]), [5, 5, 10, 10]);
  assert.equal(tomt(snitt([0, 0, 1, 1], [2, 2, 3, 3])), true);
  assert.equal(overlapper([0, 0, 1, 1], [1, 1, 2, 2]), true);
  assert.equal(flerflate({ type: 'Polygon', coordinates: [kvadrat(0, 0, 1)] }).length, 1);
});

test('summen og nærmeste farge', () => {
  assert.equal(summen([1, 2, 3.5]), 6.5);
  assert.equal(summen(new Int32Array([4, 5])), 9);
  assert.equal(
    naermesteFarge(250, 10, 0, [
      [0, 0, 0],
      [255, 0, 0]
    ]),
    1
  );
  assert.equal(
    naermesteFarge(5, 5, 5, [
      [0, 0, 0],
      [10, 10, 10]
    ]),
    0
  ); /* likt: den første vinner */
});

test('PNG: biter med kontrollsum, og bilde med fargetabell', () => {
  assert.deepEqual([...pngBit('IEND', new Uint8Array(0)).subarray(8)], [0xae, 0x42, 0x60, 0x82]);
  const png = palettPng(
    2,
    1,
    new Uint8Array([0, 1]),
    [
      [0, 0, 0],
      [255, 0, 0]
    ],
    [0, 255],
    d => deflateSync(d)
  );
  assert.deepEqual(
    pngBiter(png).map(b => b.type),
    ['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']
  );
});

test('glissent rutenett: som et vanlig rutenett, og en delt blokk kopieres før den endres', () => {
  const L = glissent({ cx0: 510, cy0: 0, w: 4, h: 2 }, 3),
    delt = new Uint8Array(512 * 512);
  leggInnDelt(L, 0, 0, delt); /* rutene 510 og 511: kolonne 0 og 1 */
  sett(L, 5, 1); /* rad 1, kolonne 1 */
  sett(L, 2, 2); /* kolonne 2 ligger i neste blokk */
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => verdi(L, i)),
    [0, 0, 2, 3, 0, 1, 3, 3]
  );
  assert.equal(verdi(L, 8), undefined);
  assert.equal(delt[512 + 511], 0);
  assert.deepEqual(
    finn(L, v => v === 1 || v === 2),
    [2, 5]
  );
});
