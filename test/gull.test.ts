/* Tester for src/data/gull: andeler, avrunding, kommunebildene og regnskapet. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { andel, arealFraRuter, bildetall, tiDekar } from '../src/data/gull/felles.ts';
import { byggInon, byggUtvikling } from '../src/data/gull/inon.ts';
import { byggEndring, byggLandOgVann, byggUtbredelse, historieAv, klasseareal } from '../src/data/gull/regnskap.ts';
import {
  byggHovedklasser,
  byggNorge,
  byggRegnskap,
  byggSammenligning,
  endringAv,
  fordelingAv
} from '../src/data/gull/naturregnskap.ts';
import { lagEndring, lagFordeling, lagOkosystemareal, lagOkosystemendring } from '../src/data/solv/naturregnskap.ts';
import type { Arealdetaljer } from '../src/data/solv/ssb.ts';
import { byggTemaet } from '../src/data/gull/temaer.ts';
import { NATURTEMA, type Temaomrader } from '../src/data/solv/temaer.ts';

/* De syntetiske tabellene lages i sølv med kodene hos SSB, og leses i gull med hovedøkosystemene i grunnkartet */
const byggFordeling = (D: Arealdetaljer, aar: string, flate: number) => fordelingAv(lagFordeling(D, aar, flate));
const byggBebygdEndring = (D: Arealdetaljer, fra: string, til: string) => {
  const E = lagEndring(D, fra, til);
  return { ...E, klasser: endringAv(E) };
};

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

test('utbredelsesregnskapet på hovedsiden av de syntetiske tabellene: 2024 summert, og 2017 med endringen lagt tilbake', () => {
  const F = { kommune: '1', aar: '2024', syntetisk: true, kilde: '', klasser: byggFordeling(D, '2024', 100) },
    E0 = byggBebygdEndring(D, '2017', '2024'),
    E = { ...E0, kommune: '1', syntetisk: true, kilde: '' },
    T = klasseareal(F);
  /* bebygd 14, jordbruk 5 + 3, natur skog 49 og myr 10, og innsjø 5 */
  assert.deepEqual(T, { a: [14, 8, 59], land: 81, aar: '2024', ferskvann: { inn: 5, elv: 0 } });
  /* bebygd opp 4, jordbruk ned 2 og natur ned 2 */
  assert.deepEqual(historieAv(F, E), {
    nr: '1',
    fra: '2017',
    til: '2024',
    a0: [10, 10, 61],
    a1: [14, 8, 59],
    endret: false
  });
  assert.deepEqual(historieAv(F, { ...E, endret: true }).a0, [14, 8, 59]);
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
    alle = { 1: D, 2: B, 3: C },
    N = byggNorge(lagOkosystemareal(alle, { 1: 100, 2: 35, 3: 38 }), lagOkosystemendring(alle)),
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

test('utbyggingen: planen alene og planen med egne planer telles hver av sitt rutenett', async () => {
  const { byggUtbygging } = await import('../src/data/gull/utbygging.ts');
  const { finn } = await import('../src/data/generelt/glissen.ts');
  /* én blokk med natur overalt og et felt på 10 x 10 ruter natur satt av */
  const d = new Uint8Array(512 * 512),
    kl = new Uint8Array(512 * 512).fill(3);
  for (let y = 100; y < 110; y++) d.fill(1, y * 512 + 100, y * 512 + 110);
  const blokk = {
    d,
    kl,
    pl: d.slice(),
    n: { beb: 0, nat: 512 * 512, jor: 0, pnat: 100, pjor: 0 },
    andel: null,
    faktor: 1
  };
  /* en egen plan som ikke er utbygging (2), over de fem første kolonnene i feltet, i sitt eget utsnitt */
  const plan = new Uint8Array(5 * 10).fill(2);
  const E = [{ z: 10, cx0: 100, cy0: 100, w: 5, h: 10, plan, id: 1 }];
  const R = byggUtbygging('1', 10, [[0, 0]], new Map([['10/0/0', blokk]]), E, 10.6);
  assert.equal(R.basisSum!.rn, 100); /* planen alene: hele feltet */
  assert.equal(R.sum.rn, 50); /* med det egne området: halve feltet */
  assert.equal(finn(R.basis!.ryddet, v => v === 1).length, 100); /* tallet er det samme som rutenettet */
  assert.equal(finn(R.ryddet, v => v === 1).length, 50);
  /* utvalgene: radene i utbyggingen og verdiene står ved hver rute, og et eget område har bare sine ruter */
  const { byggUtvalg } = await import('../src/data/gull/utbygging.ts');
  for (const [plan, omrade, antall] of [
    ['gammel', null, 100],
    ['ny', null, 50],
    ['gammel', 1, 50],
    ['ny', 1, 0]
  ] as const) {
    const U = byggUtvalg(R, plan, omrade);
    assert.equal(U.celler.length, antall, `${plan} ${omrade}`);
    U.celler.forEach((i, k) => {
      assert.equal(R.rader[U.rader[k]], i);
      assert.equal(U.ryddetV[k], 1);
      assert.equal(U.alleV[k], 1);
    });
  }
});

test('smale striper: smale deler inntil bebygd areal faller bort, smale deler ute i naturen telles', async () => {
  const { ryddStriper } = await import('../src/data/gull/utbygging.ts');
  const { glissent, leggInnDelt, finn, verdi } = await import('../src/data/generelt/glissen.ts');
  /* én blokk med natur overalt (3), og et rutenett med planlagt utbygging på natur (1) */
  const lag = (
    felt: [x0: number, y0: number, w: number, h: number][],
    bebygd: [number, number, number, number][] = []
  ) => {
    const G = { cx0: 0, cy0: 0, w: 512, h: 512 },
      d = new Uint8Array(512 * 512),
      k = new Uint8Array(512 * 512).fill(3);
    for (const [x0, y0, w, h] of felt) for (let y = y0; y < y0 + h; y++) d.fill(1, y * 512 + x0, y * 512 + x0 + w);
    for (const [x0, y0, w, h] of bebygd) for (let y = y0; y < y0 + h; y++) k.fill(1, y * 512 + x0, y * 512 + x0 + w);
    const D = glissent(G),
      K = glissent(G);
    leggInnDelt(D, 0, 0, d);
    leggInnDelt(K, 0, 0, k);
    return { R: ryddStriper(D, K), K };
  };
  const beholdt = (R: ReturnType<typeof lag>['R']) => finn(R.ryddet, v => v === 1).length;
  /* en stripe på to ruter ute i naturen, som en ny vei: beholdes */
  assert.equal(beholdt(lag([[100, 100, 40, 2]]).R), 80);
  /* den samme stripen inntil bebygd areal: faller bort */
  assert.equal(beholdt(lag([[100, 100, 40, 2]], [[100, 102, 40, 3]]).R), 0);
  /* et felt på 10 x 10 med bebygd areal langs den ene siden: hele feltet beholdes, også rutene nærmest det bebygde */
  assert.equal(beholdt(lag([[100, 100, 10, 10]], [[100, 110, 10, 3]]).R), 100);
  /* et felt med en arm på to ruter langs bebygd areal: armen faller bort, men ikke ruta rett inntil en kjerne */
  const A = lag(
    [
      [100, 100, 10, 10],
      [110, 108, 20, 2]
    ],
    [[110, 110, 20, 3]]
  );
  assert.equal(beholdt(A.R), 100 + 2); /* feltet, og de to armrutene rett ved siden av kjernene i kanten av feltet */
  /* en arm på to ruter fra bebygd areal og ut i naturen: bare rutene innenfor to ruter fra det bebygde faller bort */
  const B = lag([[200, 100, 2, 30]], [[195, 97, 12, 3]]);
  assert.equal(beholdt(B.R), 2 * 28);
  assert.equal(verdi(B.R.ryddet, 101 * 512 + 200), 0);
  assert.equal(verdi(B.R.ryddet, 102 * 512 + 200), 1);
  /* to ruter bebygd bort på skrå teller også: firkanten er 5 x 5 ruter */
  assert.equal(beholdt(lag([[300, 300, 1, 1]], [[302, 302, 1, 1]]).R), 0);
  assert.equal(beholdt(lag([[300, 300, 1, 1]], [[303, 302, 1, 1]]).R), 1);
});

test('egne planer: der planer overlapper, gjelder den siste', async () => {
  const { byggUtbygging, byggUtvalg } = await import('../src/data/gull/utbygging.ts');
  /* natur overalt og ingen kommuneplan */
  const blokk = {
    d: new Uint8Array(512 * 512),
    kl: new Uint8Array(512 * 512).fill(3),
    pl: new Uint8Array(512 * 512),
    n: { beb: 0, nat: 512 * 512, jor: 0, pnat: 0, pjor: 0 },
    andel: null,
    faktor: 1
  };
  /* plan 1 er utbygging i kolonnene 100–119, plan 2 ikke utbygging i kolonnene 110–129, begge i radene 100–109 */
  const A = { z: 10, cx0: 100, cy0: 100, w: 20, h: 10, plan: new Uint8Array(200).fill(1), id: 1 },
    B = { z: 10, cx0: 110, cy0: 100, w: 20, h: 10, plan: new Uint8Array(200).fill(2), id: 2 },
    bygg = (E: (typeof A)[]) => byggUtbygging('1', 10, [[0, 0]], new Map([['10/0/0', blokk]]), E, 10.6);
  const R = bygg([A, B]);
  assert.equal(R.sum.rn, 100); /* plan 2 tar overlappet: bare kolonnene 100–109 er utbygging */
  assert.equal(byggUtvalg(R, 'ny', 1).celler.length, 100);
  assert.equal(bygg([B, A]).sum.rn, 200); /* omvendt rekkefølge: plan 1 tar overlappet */
});

test('inngrepsfri natur over tid: endringen per periode, og inngrepsnær natur får det inngrepsfri natur mister', () => {
  const U = byggUtvikling(
    [
      { km2: [3, 2, 5], sum: 10 },
      { km2: [2, 2, 5], sum: 9 },
      { km2: [2, 1.5, 5.5], sum: 9 },
      { km2: [2, 1.5, 5], sum: 8.5 },
      { km2: [1, 2, 5], sum: 8 }
    ],
    40
  );
  assert.deepEqual(U.aar, [1988, 2008, 2013, 2018, 2023]);
  assert.deepEqual(U.sum, [10, 9, 9, 8.5, 8]);
  assert.deepEqual(U.andel, [25, 22.5, 22.5, 21.25, 20]);
  assert.deepEqual(U.perioder[0], { fra: 1988, til: 2008, soner: [-1, 0, 0], naer: 1 });
  /* sone 1 kan krympe mens sone 2 vokser: sonene flytter seg, og summen er den samme */
  assert.deepEqual(U.perioder[1], { fra: 2008, til: 2013, soner: [0, -0.5, 0.5], naer: 0 });
  assert.deepEqual(U.perioder[3], { fra: 2018, til: 2023, soner: [-1, 0.5, 0], naer: 0.5 });
});

test('verdsatt natur: det som telles mer enn én gang, er summen av lokalitetene minus arealet, og små avvik er 0', () => {
  const VERDI = NATURTEMA.find(t => t.id === 'verdi')!,
    O = (...km2: number[]) => ({ omrader: km2.map((k, i) => ({ km2: k, v: i % 4 })) }) as unknown as Temaomrader,
    A = { sum: 1.2, klasser: [1, 0.2, 0, 0] };
  /* to lokaliteter på 1 og 0,5 km² som dekker 1,2 km² til sammen: 0,3 km² er telt to ganger */
  assert.ok(Math.abs(byggTemaet(VERDI, '5001', O(1, 0.5), A, 10).flere - 0.3) < 1e-12);
  /* uten overlapp skiller arealet av flatene og av rutene litt: under én dekar er 0 */
  assert.equal(byggTemaet(VERDI, '5001', O(1, 0.2009), A, 10).flere, 0);
  /* og under 0,02 % av arealet er 0, også når det er mer enn én dekar */
  assert.equal(byggTemaet(VERDI, '5001', O(10000, 1.2), { sum: 10001, klasser: [] }, 10).flere, 0);
});
