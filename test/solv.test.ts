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
  detaljFlestIBlokk,
  detaljIKlassen,
  flestIBlokk,
  detaljklasseAv,
  klasseAv
} from '../src/data/solv/klasser.ts';
import { INONSONER, UTENFOR, inonINatur, inonSone, tolkInon } from '../src/data/solv/inon.ts';
import { GRONT, graaOgGront, graaTrinn } from '../src/data/solv/graa.ts';
import { biterIFlisen, flestIFlisen, graaHalvpart, rutenIFlis, soneHalvpart } from '../src/data/solv/nivaer.ts';
import { tolkDetaljerAlle } from '../src/data/solv/ssb.ts';
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

test('SSB: arealstatistikken for alle kommuner, per kommune og arealklasse', () => {
  /* to regioner (en kommune og resten), to klasser (barskog og myr) og to år */
  const [D, ...resten] = tolkDetaljerAlle({
    id: ['Region', 'ArealKlasse', 'ContentsCode', 'Tid'],
    size: [2, 2, 1, 2],
    dimension: {
      Region: { category: { index: ['K-5001', 'Rest'] } },
      ArealKlasse: { category: { index: ['17.01', '19'] } },
      ContentsCode: { category: { index: ['Areal'] } },
      Tid: { category: { index: ['2017', '2024'] } }
    },
    value: [10, 11, 6, 5, 1, 1, 1, 1]
  });
  assert.equal(resten.length, 0);
  assert.deepEqual([D.nr, D.aar, D.endret], ['5001', ['2017', '2024'], false]);
  assert.deepEqual(D.klasser.find(k => k.kode === '17.01')!.km2, [10, 11]);
  assert.deepEqual(D.klasser.find(k => k.kode === '19')!.km2, [6, 5]);
  assert.deepEqual(D.klasser.find(k => k.kode === '01')!.km2, [0, 0]);
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

test('zoomet ut: klassen flest ruter har, og detaljklassen innenfor den', () => {
  const d = (id: string) => DETALJKLASSER.findIndex(k => k.id === id) + 1;
  /* en blokk der de fire rutene øverst til venstre er natur (3), natur, jordbruk (2) og ukjent, og resten hav (4) */
  const K = new Uint8Array(512 * 512).fill(4),
    D = new Uint8Array(512 * 512).fill(d('hav'));
  K.set([NAT + 1, NAT + 1], 0);
  K.set([JOR + 1, 0], 512);
  D.set([d('hei'), d('skog-bar-vanlig')], 0);
  D.set([d('dyrket'), 0], 512);
  const ut = new Uint8Array(512 * 512);
  flestIBlokk(K, 2, ut, 0, 0, 6);
  assert.equal(ut[0], NAT + 1); /* to natur mot én jordbruk, og ukjent teller ikke */
  assert.equal(ut[1], 4);
  const ud = new Uint8Array(512 * 512);
  detaljFlestIBlokk(D, K, 2, ud, 0, 0);
  assert.equal(
    ud[0],
    d('skog-bar-vanlig') < d('hei') ? d('skog-bar-vanlig') : d('hei')
  ); /* likt: den laveste plassen */
  assert.equal(DETALJKLASSER[ud[0] - 1].gruppe, 'nat'); /* aldri jordbruk i en naturpiksel */
  /* forminsket fire ganger: pikselen (1, 0) i ut er rutene 4–7 i de fire første radene */
  const ut4 = new Uint8Array(512 * 512);
  flestIBlokk(K, 4, ut4, 0, 0, 6);
  assert.equal(ut4[0], 4); /* 13 av 16 er hav */
});

test('nivåene i kartet: rutene i en bit på nivå 10 og finere, og bitene i en flis', () => {
  /* biten [8, 1, 2] har rutene 2048–4095 bortover og 4096–6143 nedover på nivå 10. Ruta (5, 7) i biten har verdien 3. */
  const V = new Uint8Array(2048 * 2048);
  V[7 * 2048 + 5] = 3;
  const ut = new Uint8Array(512 * 512);
  rutenIFlis(V, [8, 1, 2], [10, 4, 8], ut); /* flisen øverst til venstre i biten: én rute per piksel */
  assert.equal(ut[7 * 512 + 5], 3);
  assert.equal(
    ut.reduce((a, v) => a + v, 0),
    3
  );
  const fin = new Uint8Array(512 * 512);
  rutenIFlis(V, [8, 1, 2], [11, 8, 16], fin); /* nivå 11: hver rute er 2 x 2 piksler */
  for (const [x, y] of [
    [10, 14],
    [11, 14],
    [10, 15],
    [11, 15]
  ])
    assert.equal(fin[y * 512 + x], 3);
  assert.equal(
    fin.reduce((a, v) => a + v, 0),
    12
  );
  const oversatt = new Uint8Array(512 * 512);
  rutenIFlis(V, [8, 1, 2], [10, 4, 8], oversatt, [9, 8, 7, 6]); /* med tabell: 0 blir 9, 3 blir 6 */
  assert.equal(oversatt[7 * 512 + 5], 6);
  assert.equal(oversatt[0], 9);
  assert.deepEqual(
    biterIFlisen(
      [
        [8, 1, 2],
        [8, 3, 2]
      ],
      [10, 4, 8]
    ),
    [[8, 1, 2]]
  );
  assert.deepEqual(
    biterIFlisen(
      [
        [8, 1, 2],
        [8, 3, 2],
        [8, 4, 2]
      ],
      [7, 1, 1]
    ),
    [[8, 3, 2]]
  ); /* nivå 7: bitene 2–3 bortover og 2–3 nedover */
});

test('nivåene i kartet: halvregelen zoomet ut for grått areal og inngrepsfri natur', () => {
  /* på nivå 9 er hver piksel 2 x 2 ruter. Biten [8, 0, 0] fyller flisen [9, 0, 0] til og med piksel 1023, her de to første. */
  const G = new Uint8Array(2048 * 2048);
  G.set([2, 0], 0); /* piksel 0: to grå (trinn 2 og 6) av fire */
  G.set([6, 0], 2048);
  G.set([0, 4], 2); /* piksel 1: én grå av fire */
  const ut = new Uint8Array(512 * 512);
  flestIFlisen(G, [8, 0, 0], [9, 0, 0], ut, 7, graaHalvpart);
  assert.equal(ut[0], 2); /* minst halvparten er grå, og likt mellom trinnene: det laveste */
  assert.equal(ut[1], 0);
  const S = new Uint8Array(2048 * 2048).fill(UTENFOR);
  S.set([0, 1], 0); /* piksel 0: villmarkspreget og sone 1 øverst, sone 2 og uten sone nederst */
  S.set([2, UTENFOR], 2048);
  S.set([0, 2], 2); /* piksel 1: én villmarkspreget og én i sone 2 */
  const us = new Uint8Array(512 * 512);
  flestIFlisen(S, [8, 0, 0], [9, 0, 0], us, 3, soneHalvpart);
  assert.equal(us[0], 2); /* halvparten er minst 3 km fra inngrep: sone 1 (pluss én) */
  assert.equal(us[1], 3); /* bare halvparten er minst 1 km fra inngrep: sone 2 (pluss én) */
  assert.equal(us[2], 0); /* uten sone */
  /* sammen med dagens klasser på samme nivå: grønt i bebygd område og sonene bare i naturen */
  assert.deepEqual([...graaOgGront([0, 3, 0, 0], [BEB + 1, BEB + 1, NAT + 1, 0])], [GRONT, 3, 0, 0]);
  assert.deepEqual([...inonINatur([1, 2, 3], [NAT + 1, JOR + 1, NAT + 1])], [1, 0, 3]);
});
