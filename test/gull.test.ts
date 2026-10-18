/* Tester for src/data/gull: andeler, avrunding, kommunebildene og regnskapet. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { andel, arealFraRuter, bildetall, tiDekar } from '../src/data/gull/felles.ts';
import { byggInon } from '../src/data/gull/inon.ts';
import { byggEndring, byggLandOgVann, byggUtbredelse } from '../src/data/gull/regnskap.ts';
import {
  byggEndring as byggBebygdEndring,
  byggFordeling,
  byggHovedklasser,
  byggNorge,
  byggRegnskap,
  byggSammenligning
} from '../src/data/gull/syntetisk.ts';

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
  assert.equal(byggLandOgVann(100, 90, { inn: 5, elv: 4.9 })!.hav, 0);
  assert.equal(byggLandOgVann(100, 80, { inn: 5, elv: 5 })!.hav, 10);
});

const kl = (kode: string, klasse: string, km2: number[]) => ({ kode, navn: kode, klasse, km2 });
const D = {
  nr: '1',
  aar: ['2017', '2024'],
  endret: false,
  klasser: [
    kl('01', 'beb', [10, 14]),
    kl('15', 'jor', [6, 5]),
    kl('16', 'jor', [4, 3]),
    kl('17.01', 'nat', [50, 49]),
    kl('19', 'nat', [10, 10]),
    kl('22.01', 'vann', [5, 5])
  ]
};

test('syntetiske tabeller: fordeling på hovedøkosystemer og endring mellom bebygd og landklassene', () => {
  /* SSBs klasser for 2024 med nøkkelen, og havet som resten av flaten på 100 km² */
  const F = byggFordeling(D, '2024', 100),
    km2 = (kode: string) => F.find(r => r.kode === kode)!.km2;
  assert.deepEqual(
    ['bebygdOpparbeidetAreal', 'dyrketmark', 'grasmark', 'skog', 'vatmark', 'innsjoerVannmagasiner', 'hav'].map(km2),
    [14, 5, 3, 49, 10, 5, 14]
  );
  /* uten hei og lite vegetert mark er det ingenting å ta kyststrendene fra */
  assert.equal(km2('kyststrenderSvabergDyner'), 0);
  /* bebygd opp 4: først fra jordbruket som gikk ned (dyrket mark 1, grasmark 1), resten fra naturen etter arealet i 2017 */
  const E = byggBebygdEndring(D, '2017', '2024'),
    til = (kode: string) => E.klasser.find(r => r.kode === kode)!.tilBebygd;
  assert.deepEqual([til('dyrketmark'), til('grasmark'), til('skog'), til('vatmark')], [1, 1, 1.67, 0.33]);
  assert.equal(E.uforklart, 0);
  const K = byggHovedklasser(F, E.klasser);
  assert.deepEqual(
    K.map(k => [k.id, k.endring]),
    [
      ['beb', 4],
      ['jor', -2],
      ['nat', -2]
    ]
  );
  /* regnskapet: 2017 er 2024 med endringen lagt tilbake, og summen for land er den samme begge år */
  const R = byggRegnskap(F, E.klasser),
    rad = (kode: string) => R.find(r => r.kode === kode)!,
    sum = (f: (r: (typeof R)[number]) => number) => Math.round(R.reduce((a, r) => a + f(r), 0) * 1000) / 1000;
  assert.deepEqual([rad('bebygdOpparbeidetAreal').inngaende, rad('bebygdOpparbeidetAreal').endring], [10, 4]);
  assert.deepEqual([rad('skog').inngaende, rad('skog').endring], [50.67, -1.67]);
  assert.equal(
    sum(r => r.inngaende),
    sum(r => r.utgaende)
  );
});

test('syntetiske tabeller: en nedgang i en bebygd klasse gir ikke natur tilbake', () => {
  /* boliger opp 1, transport ned 1: bebygd samlet er uendret, men økningen er 1 */
  const D3 = { ...D, klasser: [kl('01', 'beb', [10, 11]), kl('08-09', 'beb', [5, 4]), kl('17.01', 'nat', [50, 49])] },
    E = byggBebygdEndring(D3, '2017', '2024'),
    skog = E.klasser.find(r => r.kode === 'skog')!;
  assert.deepEqual([skog.tilBebygd, skog.fraBebygd], [1, 0]);
});

test('syntetiske tabeller: kyststrender er en fast andel av havet, tatt fra hei og lite vegetert mark', () => {
  const D2 = { ...D, klasser: [kl('18', 'nat', [5, 5]), kl('20', 'nat', [5, 5])] },
    F = byggFordeling(D2, '2024', 1000),
    km2 = (kode: string) => F.find(r => r.kode === kode)!.km2;
  /* hav 990 km², kyst 0,1 % av det, tatt likt fra de to (avrundet til 10 dekar) */
  assert.deepEqual(
    ['hav', 'kyststrenderSvabergDyner', 'heiBuskmark', 'liteVegetertMark'].map(km2),
    [990, 0.99, 4.51, 4.51]
  );
});

test('syntetiske tabeller for Norge: summen tar bare med kommunene som kan sammenlignes', () => {
  const B = {
      ...D,
      nr: '2',
      klasser: [kl('01', 'beb', [5, 6]), kl('15', 'jor', [10, 10]), kl('17.01', 'nat', [20, 19])]
    },
    C = { ...D, nr: '3', endret: true, klasser: [kl('01', 'beb', [0, 8]), kl('17.01', 'nat', [0, 30])] },
    N = byggNorge({ 1: D, 2: B, 3: C }, { 1: 100, 2: 35, 3: 38 }),
    S = byggSammenligning(N, '1')!;
  assert.equal(N.sammenlignbare, 2);
  /* natur bygget ned: 2 km² i kommune 1 og 1 km² i kommune 2. Kommune 3 har flyttet grense. */
  assert.equal(Math.round(S.naturtap.andelAvNorge! * 100) / 100, 66.67);
  assert.equal(S.naturtap.snitt, 50);
  assert.deepEqual([S.jordbruk.km2, S.jordbruk.plass, S.jordbruk.av], [2, 1, 2]);
  assert.equal(byggSammenligning(N, '3')!.jordbruk.plass, null);
});

test('planlagt utbygging i kartet: rutene på nivå 10, og zoomet ut bare innenfor dagens klasse i pikselen', async () => {
  const { glissent, leggInnDelt } = await import('../src/data/generelt/glissen.ts');
  const { STYRKER, planPaaNivaa10, planUt } = await import('../src/data/gull/planflis.ts');
  const { JOR, NAT } = await import('../src/data/solv/klasser.ts');
  /* rutenettet er blokken [10, 4, 6]: ruta 0 er natur satt av og ruta 1 jordbruk satt av, i samme piksel to nivåer ut */
  const D = glissent({ cx0: 4 * 512, cy0: 6 * 512, w: 512, h: 512 }),
    B = new Uint8Array(512 * 512);
  B[0] = 1;
  B[1] = 2;
  leggInnDelt(D, 4, 6, B);
  const P = planPaaNivaa10(D, [10, 4, 6]);
  assert.deepEqual([P[0], P[1], P[2]], [STYRKER, 2 * STYRKER, 0]); /* full styrke, natur og så jordbruk */
  /* nivå 8: én piksel er 4 x 4 ruter, og blokken [10, 4, 6] er kolonne 0–127 og rad 256–383 i flisen [8, 1, 1] */
  const K = new Uint8Array(512 * 512),
    p = 256 * 512;
  K[p] = NAT + 1;
  assert.equal(planUt(D, K, [8, 1, 1])[p], 1); /* natur: én av 16 ruter, svakeste styrke */
  K[p] = JOR + 1;
  assert.equal(planUt(D, K, [8, 1, 1])[p], STYRKER + 1); /* jordbruk i en jordbrukspiksel */
  K[p] = 1; /* bebygd: ingenting vises */
  assert.equal(planUt(D, K, [8, 1, 1])[p], 0);
});
