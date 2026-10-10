/* Tester for src/data/generelt: geometri, minne, tall og farger. Kjør: npm test */
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
import { husk } from '../src/data/generelt/minne.ts';
import { summen } from '../src/data/generelt/tall.ts';
import { naermesteFarge } from '../src/data/generelt/farge.ts';
import { palettPng, pngBit, pngBiter } from '../src/data/generelt/png.ts';
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

test('husk: det eldste går ut, og det som legges inn på nytt, blir nytt', () => {
  const m = new Map<string, number>();
  for (const k of ['a', 'b', 'c']) husk(m, k, 1, 2);
  assert.deepEqual([...m.keys()], ['b', 'c']);
  husk(m, 'b', 2, 2);
  assert.deepEqual([...m.keys()], ['c', 'b']);
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
