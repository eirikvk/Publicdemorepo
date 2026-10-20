/* Tester for eksempelradene i katalogen (src/ui/eksempelrader.ts). Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEL } from '../src/data/generelt/dekning.ts';
import { celle, eksempelrader, flat, kolonnerI, plasser } from '../src/ui/eksempelrader.ts';

test('eksempelrader: radene som vises er spredt jevnt fra den første, eller alle når de er få', () => {
  assert.deepEqual(plasser(3), [0, 1, 2]);
  assert.deepEqual(plasser(40).slice(0, 4), [0, 2, 4, 6]);
  assert.equal(plasser(1e6).length, 20);
});

test('eksempelrader: ruter med verdi, med x og y i flisnettet, og ruter der alle verdiene er 0 utelatt', () => {
  const kl = new Uint8Array(4),
    detalj = new Uint8Array(4);
  kl[1] = 3;
  detalj[1] = 7;
  kl[3] = 1;
  const E = eksempelrader({ z: 10, cx0: 512, cy0: 1024, w: 2, h: 2, kl, detalj }, 'ruter')!;
  assert.equal(E.antall, 2);
  assert.deepEqual(E.rader, [
    { x: 513, y: 1024, kl: 3, detalj: 7 },
    { x: 513, y: 1025, kl: 1, detalj: 0 }
  ]);
  assert.deepEqual(E.plass, [1, 2]);
  assert.deepEqual(
    E.kolonner.map(k => [k.navn, k.type]),
    [
      ['x', 'tall'],
      ['y', 'tall'],
      ['kl', 'tall'],
      ['detalj', 'tall']
    ]
  );
  assert.ok(E.om.some(([k, v]) => k === 'z' && v === '10'));
  /* mange ruter: 20 spredt jevnt, og antallet er alle */
  const stor = new Uint8Array(100 * 100).fill(1),
    S = eksempelrader({ w: 100, h: 100, kl: stor }, 'ruter')!;
  assert.equal(S.antall, 10000);
  assert.equal(S.rader.length, 20);
  assert.deepEqual(S.rader[1], { x: 0, y: 5, kl: 1 }); /* rute 500 */
  assert.equal(S.plass[1], 501);
  assert.ok(S.spredt);
  /* flere rutenett får en id, og et rutenett uten tallrekker har ingen rader */
  const M = eksempelrader(
    [
      { id: 7, w: 1, h: 1, plan: Uint8Array.of(1) },
      { w: 1, h: 1, plan: Uint8Array.of(2) }
    ],
    'ruter'
  )!;
  assert.deepEqual(M.rader, [
    { id: 7, x: 0, y: 0, plan: 1 },
    { id: 2, x: 0, y: 0, plan: 2 }
  ]);
  assert.equal(eksempelrader({ w: 2, h: 2, sone: null }, 'ruter')!.antall, 0);
});

test('eksempelrader: andeler per rute i bitene, i flisnettet, også små andeler og hele biter', () => {
  /* en bit på 4 x 3 ruter: rad 0 har ett løp på to ruter fra x = 1, rad 1 ingenting, rad 2 én rute med en svært liten andel */
  const andel = {
      w: 4,
      h: 3,
      rad: Int32Array.from([0, 1, 1, 2]),
      x: Uint16Array.from([1, 3]),
      n: Uint16Array.from([2, 1]),
      a: Uint16Array.from([HEL, 2])
    },
    B = [{ tc: [8, 1, 2], antall: 3, hel: false, andel, faktor: 1 }];
  const E = eksempelrader(B, 'andeler')!;
  assert.equal(E.antall, 3);
  assert.deepEqual(E.rader[0], { bit: '8/1/2', x: 2048 + 1, y: 4096, andel: 1, faktor: 1 });
  assert.deepEqual(E.rader[2], { bit: '8/1/2', x: 2048 + 3, y: 4096 + 2, andel: 2 / HEL, faktor: 1 });
  assert.notEqual(celle(E.rader[2].andel).tekst, '0');
  /* temaene per rute har én liste per kategori, og en hel bit uten andel er dekket overalt */
  const T = eksempelrader(
    { nr: '5001', tema: 'vern', biter: [[], [{ tc: [8, 0, 0], antall: 0, hel: true, andel: null, faktor: 1 }]] },
    'andeler'
  )!;
  assert.equal(T.antall, 2048 * 2048);
  assert.equal(T.rader.length, 20);
  assert.deepEqual(T.rader[0], { kategori: 1, bit: '8/0/0', x: 0, y: 0, andel: 1, faktor: 1 });
  assert.deepEqual(T.om, [
    ['nr', '5001'],
    ['tema', 'vern']
  ]);
});

test('eksempelrader: én post per kommune, flatet ut ett nivå, og hodet ved siden av', () => {
  const kommuner: Record<string, unknown> = { '0301': { tilBebygd: { '11': 9 }, endret: true } };
  for (let i = 0; i < 3; i++) kommuner[String(5001 + i)] = { tilBebygd: { '11': i }, endret: false };
  const E = eksempelrader({ fra: '2017', til: '2024', kommuner }, 'kommuner')!;
  assert.equal(E.antall, 4);
  assert.deepEqual(E.rader[0], { 'tilBebygd.11': 9, endret: true, kommune: '0301' });
  assert.equal(E.kolonner[0].navn, 'kommune');
  assert.deepEqual(E.om, [
    ['fra', '2017'],
    ['til', '2024']
  ]);
  /* et tall per kommune står i en kolonne med navnet på feltet */
  assert.deepEqual(eksempelrader({ kilde: 'Kartverket', km2: { '1101': 1.5 } }, 'kommuner')!.rader[0], {
    km2: 1.5,
    kommune: '1101'
  });
});

test('eksempelrader: JSON-stat med én rad per verdi som ikke er tom, siste dimensjon raskest, og én kategori i hodet', () => {
  const J = {
    class: 'dataset',
    label: 'Areal',
    id: ['Region', 'Klasse', 'Innhold', 'Tid'],
    size: [2, 3, 1, 2],
    dimension: {
      Region: { category: { index: { '5021': 1, '5001': 0 }, label: { '5001': 'Trondheim', '5021': 'Oppdal' } } },
      Klasse: { category: { index: ['a', 'b', 'c'] } },
      Innhold: { category: { index: ['Areal'] } },
      Tid: { category: { index: ['2017', '2024'] } }
    },
    value: Array.from({ length: 12 }, (_, i) => (i === 0 ? null : i))
  };
  const E = eksempelrader(J, 'jsonstat')!;
  assert.equal(E.antall, 11);
  assert.deepEqual(E.rader[0], { Region: '5001 Trondheim', Klasse: 'a', Tid: '2024', verdi: 1 });
  assert.deepEqual(E.rader[10], { Region: '5021 Oppdal', Klasse: 'c', Tid: '2024', verdi: 11 });
  assert.deepEqual(E.om, [
    ['label', 'Areal'],
    ['Innhold', 'Areal']
  ]);
  assert.ok(E.hva.includes('1 tomme verdier er utelatt'));
  /* verdiene som objekt, og en dimensjon som mangler, gir ikke feil */
  const S = eksempelrader({ ...J, value: { '5': 50 }, dimension: { ...J.dimension, Klasse: undefined } }, 'jsonstat')!;
  assert.deepEqual(S.rader, [{ Region: '5001 Trondheim', Klasse: '2', Tid: '2024', verdi: 50 }]);
});

test('eksempelrader uten radform: den lengste listen som ikke er tom, ordbøker med ulike nøkler, flater og GeoJSON', () => {
  const flate = [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0]
      ]
    ]
  ];
  const E = eksempelrader(
    {
      nr: '5001',
      sum: 3,
      tom: [],
      utenFastVerdi: [{ navn: 'C' }],
      omrader: [
        { km2: 1, koord: flate, navn: 'A', egenskaper: { verneform: 'NR' } },
        { km2: 2, koord: flate, navn: 'B', egenskaper: { verneform: 'LVO', ekstra: 'x' } }
      ]
    },
    null
  )!;
  assert.equal(E.hva, 'Én rad per element i «omrader». Verdien har også «utenFastVerdi» (1), som ikke vises her.');
  assert.deepEqual(
    E.kolonner.map(k => [k.navn, k.type, k.fylt]),
    [
      ['navn', 'tekst', 2],
      ['km2', 'tall', 2],
      ['egenskaper.verneform', 'tekst', 2],
      ['koord', 'flate', 2],
      ['egenskaper.ekstra', 'tekst', 1]
    ]
  );
  assert.deepEqual(E.om, [
    ['nr', '5001'],
    ['sum', '3']
  ]);
  assert.equal(celle(flate).tekst, 'flate med 4 punkter');
  assert.equal(celle(1.23456789).tekst, '1,23457');
  assert.equal(celle(259584).tekst, '259584');
  /* en tom liste er ikke radene */
  assert.equal(eksempelrader({ tom: [], sum: 1 }, null)!.hva, 'Svaret har ingen liste, så alle feltene står i én rad.');
  /* GeoJSON: id, egenskapene og geometrien */
  assert.deepEqual(
    flat({ type: 'Feature', id: 4, properties: { navn: 'A' }, geometry: { type: 'Polygon', coordinates: flate[0] } }),
    { id: 4, navn: 'A', geometry: { type: 'Polygon', coordinates: flate[0] } }
  );
  /* kodene med bare sifre står sist, sortert som tall, og nøkkelen først */
  assert.deepEqual(
    kolonnerI([{ '10': 1, '01': 2, '2': 3, kommune: '5001' }], ['kommune']).map(k => k.navn),
    ['kommune', '01', '2', '10']
  );
  assert.deepEqual(
    kolonnerI([{ kommune: '5001', 'til.11': 1, 'til.02': 2, 'fra.11': 3, 'fra.02': 4, endret: false }]).map(
      k => k.navn
    ),
    ['kommune', 'endret', 'til.02', 'til.11', 'fra.02', 'fra.11']
  );
  assert.equal(kolonnerI([{ a: 1 }, { a: 'x' }, { a: null }])[0].type, 'blandet');
  /* ett svar uten liste er én rad, et svar med interne strukturer og et bilde har ingen rader */
  assert.deepEqual(eksempelrader({ sum: 2, soner: [1, 1] }, null)!.rader, [{ sum: 2, soner: [1, 1] }]);
  assert.equal(eksempelrader({ celler: new Int32Array(3), R: { blokker: new Map() } }, null), null);
  assert.equal(eksempelrader(new ArrayBuffer(8), null), null);
  /* en lang tallrekke i en liste gir én kolonne, ikke én per tall */
  assert.deepEqual(Object.keys(eksempelrader([new Array(50).fill(1)], null)!.rader[0]), ['verdi']);
  /* passer ikke verdien til radformen, brukes listen, med en merknad */
  assert.ok(eksempelrader([{ a: 1 }], 'ruter')!.merknad);
  /* liste i liste: én rad per kommune, med fylket foran */
  const F = eksempelrader(
    [
      { nr: '50', navn: 'Trøndelag', kommuner: [{ nr: '5001', navn: 'Trondheim' }] },
      { nr: '03', navn: 'Oslo', kommuner: [{ nr: '0301', navn: 'Oslo' }] }
    ],
    { utvid: 'kommuner', som: 'fylke' }
  )!;
  assert.equal(F.antall, 2);
  assert.deepEqual(F.rader[0], { 'fylke.nr': '50', 'fylke.navn': 'Trøndelag', nr: '5001', navn: 'Trondheim' });
  assert.deepEqual(
    F.kolonner.map(k => k.navn),
    ['fylke.nr', 'fylke.navn', 'nr', 'navn']
  );
});

test('eksempelrader: lister som går i ring eller er svært dype, gir ikke feil', () => {
  const ring: unknown[] = [];
  ring.push(ring);
  assert.doesNotThrow(() => eksempelrader({ a: ring }, null));
  let dyp: unknown = [[1, 2]];
  for (let i = 0; i < 5000; i++) dyp = [dyp];
  assert.doesNotThrow(() => celle(dyp));
});
