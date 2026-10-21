/* Kommunen mot Norge fra tallene for alle kommunene (src/data/gull/landstall.ts): plassen blant kommunene, andelen av Norge som
   summen av tellerne delt på summen av nevnerne, og arealet av naturtypene i Norge */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { andelAvNorge, byggLandssammenligning, plassFor } from '../src/data/gull/landstall.ts';
import type { Landstallrad } from '../src/data/solv/landstall.ts';

const rad = (nr: string, x: Partial<Landstallrad>): Landstallrad => ({
  nr,
  navn: nr,
  land: 100,
  grunnkartLand: 100,
  vern: 0,
  vernLand: 0,
  villrein: 0,
  verdsatt: 0,
  kartlagt: null,
  kartlagtAndel: null,
  inon: 0,
  graa: 0,
  ...x
});

test('plassen: 1 har mest, like tall får samme plass, og kommuner uten tall er ikke med', () => {
  const R = [
    { nr: 'a', v: 5 },
    { nr: 'b', v: 9 },
    { nr: 'c', v: 5 },
    { nr: 'd', v: null },
    { nr: 'e', v: 1 }
  ];
  const p = (nr: string) =>
    plassFor(
      R,
      nr,
      r => r.nr,
      r => r.v
    );
  assert.deepEqual(p('b'), { plass: 1, av: 4 });
  assert.deepEqual(p('a'), { plass: 2, av: 4 });
  assert.deepEqual(p('c'), { plass: 2, av: 4 });
  assert.deepEqual(p('e'), { plass: 4, av: 4 });
  assert.equal(p('d'), null);
  assert.equal(p('x'), null);
});

test('andelen av Norge er summen av tellerne delt på summen av nevnerne, ikke snittet av andelene', () => {
  const R = [
    { t: 10, n: 100 },
    { t: 90, n: 900 },
    { t: 50, n: 100 },
    { t: null, n: 1000 }
  ];
  /* (10 + 90 + 50) / (100 + 900 + 100) = 13,6 %, mens snittet av andelene ville vært 23,3 % */
  assert.ok(
    Math.abs(
      andelAvNorge(
        R,
        r => r.t,
        r => r.n
      )! -
        (150 / 1100) * 100
    ) < 1e-9
  );
  assert.equal(
    andelAvNorge(
      [{ t: 1, n: 0 }],
      r => r.t,
      r => r.n
    ),
    null
  );
});

test('kommunen mot Norge: villreinandelen, plassene, gjennomsnittene og naturtypene', () => {
  const L = {
    beregnet: '2026-10-22',
    rader: [
      rad('1', { villrein: 30, kartlagtAndel: 20, inon: 50, vernLand: 10, grunnkartLand: 100, graa: 5 }),
      rad('2', { villrein: 70, kartlagtAndel: 40, inon: 10, vernLand: 30, grunnkartLand: 100, graa: 15 }),
      rad('3', { villrein: 0, kartlagtAndel: null, inon: 0, vernLand: 0, grunnkartLand: 200, graa: 0, land: 200 })
    ]
  };
  const N = [
    { nr: '1', navn: 'Kalkskog', km2: 2, antall: 1 },
    { nr: '2', navn: 'Kalkskog', km2: 6, antall: 3 },
    { nr: '2', navn: 'Slåttemark', km2: 1, antall: 2 }
  ];
  const S = byggLandssammenligning(L, N, '1');
  assert.equal(S.kommuner, 3);
  assert.equal(S.kommune!.villreinAndel, 30);
  assert.deepEqual(S.kommune!.villrein, { plass: 2, av: 2 });
  assert.deepEqual(S.kommune!.kartlegging, { plass: 2, av: 2 });
  assert.deepEqual(S.kommune!.inon, { plass: 1, av: 3 });
  assert.equal(S.snitt.vern, 10); /* (10 + 30 + 0) / (100 + 100 + 200) */
  assert.equal(S.snitt.villrein, 25); /* 100 / 400 */
  assert.equal(S.snitt.graa, 5); /* 20 / 400 */
  assert.deepEqual(S.naturtyper, { Kalkskog: 8, Slåttemark: 1 });
  /* en kommune uten villreinområder har ingen andel og ingen plass for dem */
  const T = byggLandssammenligning(L, N, '3');
  assert.equal(T.kommune!.villreinAndel, null);
  assert.equal(T.kommune!.villrein, null);
  assert.equal(T.kommune!.kartlegging, null);
  /* en kommune som ikke er med */
  assert.equal(byggLandssammenligning(L, N, '9').kommune, null);
});
