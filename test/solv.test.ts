/* Tester for src/data/solv: flisnettet, rutenettene, målestokken, tolking av farger og SSB-svar, og planflater. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fliserI, flisUtsnitt, m2PerKm2, rutenett } from '../src/data/solv/felles.ts';
import { BEB, DATAFARGE, JOR, NAT, klasseAv } from '../src/data/solv/klasser.ts';
import { INONSONER, UTENFOR, inonSone, tolkInon } from '../src/data/solv/inon.ts';
import { graaTrinn } from '../src/data/solv/graa.ts';
import { tolkAreal } from '../src/data/solv/ssb.ts';
import { planType } from '../src/data/solv/egne.ts';
import { tilUTM } from '../src/data/solv/projeksjoner.ts';

test('flisnettet: en flis og flisene i utsnittet dens', () => {
  const u = flisUtsnitt([0, 0, 0]);
  assert.deepEqual(u, [-2500000, 3500000, 3045984, 9045984]);
  assert.deepEqual(fliserI(u, 0), [[0, 0, 0]]);
  assert.equal(fliserI(flisUtsnitt([9, 300, 200]), 9).length, 1);
});

test('rutenett og målestokk', () => {
  assert.deepEqual(rutenett([0, 0, 100, 50], 10), { res: 10, w: 10, h: 5, u: [0, 0, 100, 50] });
  assert.equal(Math.round(m2PerKm2([499000, 0, 501000, 1])), 999200); /* på midtlinjen er målestokken 0,9996 */
});

test('klassene leses av de rene fargene', () => {
  assert.equal(klasseAv(...(DATAFARGE.beb as [number, number, number])), BEB);
  assert.equal(klasseAv(...(DATAFARGE.jor as [number, number, number])), JOR);
  assert.equal(klasseAv(...(DATAFARGE.nat as [number, number, number])), NAT);
});

test('inngrepsfri natur: sone per farge og per rute', () => {
  const [r, g, b] = INONSONER[2][2];
  assert.equal(inonSone(r, g, b), 2);
  const S = tolkInon([r, g, b, 255, 0, 0, 0, 0], [0, 0, 0, 255, 0, 0, 0, 255]);
  assert.deepEqual([...S.sone], [2, UTENFOR]);
  assert.deepEqual(S.n, [0, 0, 1]);
});

test('grått areal: trinn etter rødfargen', () => {
  assert.equal(graaTrinn(255, 0), 0); /* for lite dekket */
  assert.equal(graaTrinn(10, 255), 6); /* uten oppgitt andel */
  assert.equal(graaTrinn(51, 255), 1);
  assert.equal(graaTrinn(255, 255), 5);
});

test('SSB: arealklassene summert til bebygd, jordbruk og natur', () => {
  const T = tolkAreal({
    dimension: {
      ArealKlasse: { category: { index: ['01', '15-16', '17', '22.01', '22.02'] } },
      Tid: { category: { index: ['2025'] } }
    },
    value: [2, 3, 5, 0.5, 0.25]
  });
  assert.deepEqual(T, { a: [2, 3, 5], land: 10, aar: '2025', ferskvann: { inn: 0.5, elv: 0.25 } });
});

test('planflater: utbygging er framtidig bebyggelse og samferdsel', () => {
  assert.equal(planType('1110', '2', true), 'bygg');
  assert.equal(planType('1110', '1', true), 'fri'); /* nåværende */
  assert.equal(planType('5100', '2', true), 'fri');
  assert.equal(planType('', '', false), 'bygg'); /* uten arealformål er alt utbygging */
});

test('projeksjon: 15 grader øst er midtlinjen i UTM33', () => {
  assert.ok(Math.abs(tilUTM('EPSG:4326')([15, 65])[0] - 500000) < 1e-6);
});
