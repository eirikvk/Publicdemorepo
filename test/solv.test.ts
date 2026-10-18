/* Tester for src/data/solv: flisnettet, rutenettene, målestokken, tolking av farger og SSB-svar, og planflater. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fliserI, flisUtsnitt, m2PerKm2, rutenett } from '../src/data/solv/felles.ts';
import {
  BEB,
  DATAFARGE,
  DETALJFARGE,
  DETALJKLASSER,
  DETALJTABELL,
  JOR,
  NAT,
  detaljfilIFlis,
  detaljIKlassen,
  detaljklasseAv,
  klasseAv
} from '../src/data/solv/klasser.ts';
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
  const S = tolkInon([r, g, b, 255, 0, 0, 0, 0]);
  assert.deepEqual([...S], [2, UTENFOR]);
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

test('punkt: feltene fra GetFeatureInfo hos NIBIO og DiBK, med navn på koder og datoer', async () => {
  const { grunnkartIPunkt, planIPunkt } = await import('../src/data/solv/punkt.ts'),
    ekte = globalThis.fetch;
  globalThis.fetch = (async (adresse: string) =>
    new Response(
      /nibio/.test(adresse)
        ? '<x><okosystemtype_feature><gml:boundedBy>…</gml:boundedBy><arealdekkeniva1>skog</arealdekkeniva1><kystsone></kystsone></okosystemtype_feature></x>'
        : JSON.stringify({
            features: [
              {
                properties: {
                  arealformål: '1170',
                  eierform: '3',
                  beskrivelse: null,
                  oppdateringsdato: '2023-03-29T00:00:00Z'
                }
              }
            ]
          })
    )) as typeof fetch;
  try {
    assert.deepEqual(await grunnkartIPunkt([1, 2]), [{ felt: [['arealdekkeniva1', 'skog']] }]);
    assert.deepEqual((await planIPunkt([1, 2]))[0].felt, [
      ['arealformål', '1170 Fritids- og turistformål'],
      ['eierform', '3 Annen eierform'],
      ['oppdateringsdato', '29.03.2023']
    ]);
  } finally {
    globalThis.fetch = ekte;
  }
});

test('SSB: arealklassene hver for seg, fra 2017', async () => {
  const { tolkDetaljer } = await import('../src/data/solv/ssb.ts');
  /* To klasser (barskog og myr) og tre år, der 2016 skal tas bort */
  const D = tolkDetaljer(
    {
      dimension: {
        ArealKlasse: { category: { index: ['17.01', '19'] } },
        Tid: { category: { index: ['2016', '2017', '2018'] } }
      },
      value: [9, 10, 11, 5, 6, 6]
    },
    '5001'
  );
  assert.deepEqual(D.aar, ['2017', '2018']);
  assert.deepEqual(D.klasser.find(k => k.kode === '17.01')!.km2, [10, 11]);
  assert.deepEqual(D.klasser.find(k => k.kode === '19')!.km2, [6, 6]);
  assert.deepEqual(D.klasser.find(k => k.kode === '01')!.km2, [0, 0]);
});

test('detaljklassene: de rene fargene, og en blanding gir klassen det er mest av', () => {
  const F = DETALJFARGE,
    blanding = (a: number, b: number, t: number) =>
      F[a].map((v, k) => Math.round(t * v + (1 - t) * F[b][k])) as [number, number, number];
  assert.equal(DETALJKLASSER.filter(k => !k.rest).length, 19);
  assert.equal(F.length, 19);
  F.forEach((f, i) => assert.equal(detaljklasseAv(f[0], f[1], f[2]), i));
  const skog = DETALJKLASSER.findIndex(k => k.id === 'skog-bar-vanlig'),
    myr = DETALJKLASSER.findIndex(k => k.id === 'skog-bar-myr');
  assert.equal(detaljklasseAv(...blanding(skog, myr, 0.7)), skog);
  assert.equal(detaljklasseAv(...blanding(skog, myr, 0.3)), myr);
});

test('detaljklassene: lest innenfor dagens klasse, med restklasse, og lagret med eksakte farger', () => {
  const d = (id: string) => DETALJKLASSER.findIndex(k => k.id === id) + 1,
    /* dagens klasse: 0 ukjent, 1 bebygd, 2 jordbruk, 3 natur, 4 hav, 5 innsjø, 6 elv */
    K = Uint8Array.from([0, BEB + 1, JOR + 1, JOR + 1, NAT + 1, NAT + 1, NAT + 1, 4, 5]),
    D = Uint8Array.from([d('hei'), d('hei'), d('dyrket'), d('hei'), d('hei'), d('dyrket'), 0, d('inn'), d('hav')]);
  assert.deepEqual(Array.from(detaljIKlassen(D, K)), [
    0,
    d('beb'),
    d('dyrket'),
    d('jor-rest'),
    d('hei'),
    d('nat-rest'),
    d('nat-rest'),
    d('hav'),
    d('inn')
  ]);
  /* hver plass i fargetabellen leses tilbake som seg selv */
  const P = new Uint8Array(4 * DETALJTABELL.length);
  DETALJTABELL.forEach(([r, g, b], i) => P.set([r, g, b, i ? 255 : 0], 4 * i));
  assert.deepEqual(
    Array.from(detaljfilIFlis(P)),
    DETALJTABELL.map((_, i) => i)
  );
  assert.equal(new Set(DETALJTABELL.map(f => f.join())).size, DETALJTABELL.length);
});
