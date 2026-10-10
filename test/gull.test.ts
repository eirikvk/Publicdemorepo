/* Tester for src/data/gull: andeler, avrunding, kommunebildene og regnskapet. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { andel, arealFraRuter, bildetall, tiDekar } from '../src/data/gull/felles.ts';
import { byggInon } from '../src/data/gull/inon.ts';
import { byggEndring, byggUtbredelse, landOgVann } from '../src/data/gull/regnskap.ts';

const rutebilde = { u: [0, 0, 1, 1], res: 1, w: 1, h: 1 };

test('andel og avrunding til nærmeste 10 dekar', () => {
  assert.equal(andel(1, 4), 25);
  assert.equal(andel(1, 0), null);
  assert.equal(tiDekar(0.125), 0.13);
  assert.deepEqual(arealFraRuter([100, 300], 10, 1e6), { km2: [0.01, 0.03], sum: 0.04 });
});

test('kommunebildet: henter, feil, ingen eller ok', () => {
  const ok = (sum: number) => ({
    nr: '1',
    tilstand: 'ok' as const,
    sum,
    ...rutebilde,
    soner: [sum, 0, 0],
    sone: new Uint8Array(1)
  });
  assert.deepEqual(
    bildetall(null, () => ({})),
    { tilstand: 'henter' }
  );
  assert.deepEqual(byggInon({ nr: '1', tilstand: 'feil' }, 10), { tilstand: 'feil' });
  assert.deepEqual(byggInon(ok(0), 10), { tilstand: 'ingen' });
  assert.deepEqual(byggInon(ok(2), 10), { tilstand: 'ok', sum: 2, soner: [2, 0, 0], andelLand: 20 });
});

test('regnskapet: natur først, og ingen sammenligning når grensen er flyttet', () => {
  const U = byggUtbredelse({ tilstand: 'ok', a: [1, 2, 3], aar: '2025' })!;
  assert.equal(U.land, 6);
  assert.deepEqual(
    U.klasser.map(k => [k.id, k.km2]),
    [
      ['nat', 3],
      ['jor', 2],
      ['beb', 1]
    ]
  );
  assert.deepEqual(byggEndring({ nr: '1', fra: '2017', til: '2025', a0: [], a1: [], endret: true }), {
    fra: '2017',
    til: '2025',
    endret: true
  });
});

test('land og vann: en liten rest regnes ikke som hav', () => {
  assert.equal(landOgVann(100, 90, { inn: 5, elv: 4.9 })!.hav, 0);
  assert.equal(landOgVann(100, 80, { inn: 5, elv: 5 })!.hav, 10);
});
