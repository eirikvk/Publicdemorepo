/* Tester for dekningsandelen (src/data/generelt/dekning.ts): skanlinjen mot eksakte arealer, unionen, hull, kategorier, masker, og at
   regelen for én rute gir det samme som skanlinjen. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  andelSum,
  andelUtsnitt,
  andelVed,
  dekning,
  dekningIRute,
  HEL,
  hverRute,
  intervallMinus,
  intervallSnitt,
  intervallUnion,
  kanterI,
  regel,
  ringer,
  type Nett
} from '../src/data/generelt/dekning.ts';
import { areal, flatesok, type Flerflate } from '../src/data/generelt/geometri.ts';

const RES = 10,
  NETT: Nett = { u: [0, 0, 400, 400], res: RES, w: 40, h: 40 };
/* Et rektangel fra (x0, y0) til (x1, y1) i meter, mot klokka */
const firkant = (x0: number, y0: number, x1: number, y1: number): Flerflate => [
  [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0]
    ]
  ]
];
const en = (flater: Flerflate[], R: Nett = NETT) =>
  dekning(kanterI([{ lag: 0, ringer: ringer(flater) }], R), R.w, R.h, regel([], [0]), 1, 1)[0];
const ruter = (koord: Flerflate) => areal(koord) / (RES * RES);

test('dekning: firkant langs rutekantene gir hele ruter', () => {
  const A = en([firkant(20, 30, 60, 100)]);
  assert.equal(andelSum(A), 4 * 7);
  assert.equal(andelVed(A, 2, 30), HEL); /* rad 30 fra toppen er y mellom 100 og 90 */
  assert.equal(andelVed(A, 1, 30), 0);
});

test('dekning: forskjøvet firkant og smal stripe blir eksakte', () => {
  const F = firkant(22.5, 32.5, 61.3, 97.5); /* kantene bortover er eksakte, nedover på kvarte ruter */
  assert.ok(Math.abs(andelSum(en([F])) - ruter(F)) < 0.001);
  const S = firkant(103, 5, 106, 395); /* 3 meter bred, loddrett */
  assert.ok(Math.abs(andelSum(en([S])) - ruter(S)) < 0.001);
});

test('dekning: trekant og skrå kanter innenfor 0,5 %', () => {
  const T: Flerflate = [
    [
      [
        [13, 17],
        [377, 61],
        [151, 389],
        [13, 17]
      ]
    ]
  ];
  const a = andelSum(en([T]));
  assert.ok(Math.abs(a - ruter(T)) / ruter(T) < 0.005, `${a} mot ${ruter(T)}`);
});

test('dekning: hull, union, felles kant og like flater', () => {
  const ute = firkant(50, 50, 350, 350),
    hull: Flerflate = [[ute[0][0], firkant(100, 100, 200, 200)[0][0].slice().reverse()]];
  assert.ok(Math.abs(andelSum(en([hull])) - (900 - 100)) < 0.01);
  /* to overlappende firkanter teller overlappet én gang */
  const a = firkant(0, 0, 200, 200),
    b = firkant(100, 100, 300, 300);
  assert.ok(Math.abs(andelSum(en([a, b])) - (400 + 400 - 100)) < 0.01);
  /* to firkanter med felles kant midt i en rute: ruta langs kanten er helt dekket */
  const c = firkant(0, 0, 105, 200),
    d = firkant(105, 0, 300, 200);
  const A = en([c, d]);
  assert.equal(andelVed(A, 10, 25), HEL);
  assert.ok(Math.abs(andelSum(A) - 600) < 0.01);
  /* den samme flaten to ganger er én flate */
  assert.ok(Math.abs(andelSum(en([a, a])) - 400) < 0.01);
  /* et annet område over hullet fyller det */
  assert.ok(Math.abs(andelSum(en([hull, firkant(100, 100, 200, 200)])) - 900) < 0.01);
});

test('dekning: omløpsretningen spiller ingen rolle', () => {
  const F = firkant(33, 47, 211, 300),
    snudd: Flerflate = [[F[0][0].slice().reverse()]];
  assert.equal(andelSum(en([F])), andelSum(en([snudd])));
});

test('dekning: kategorier i rekkefølge, og maske', () => {
  const a = firkant(0, 0, 200, 200),
    b = firkant(100, 100, 300, 300),
    K = kanterI(
      [
        { lag: 0, ringer: ringer([firkant(0, 0, 250, 400)]) } /* masken, som kommunen */,
        { lag: 1, ringer: ringer([a]) },
        { lag: 2, ringer: ringer([b]) }
      ],
      NETT
    ),
    [A, B] = dekning(K, 40, 40, regel([0], [1, 2]), 2, 3);
  assert.ok(Math.abs(andelSum(A) - 400) < 0.01); /* a ligger helt i masken */
  assert.ok(Math.abs(andelSum(B) - (150 * 200 - 100 * 100) / 100) < 0.01); /* b i masken, minus det a tar */
  const [M] = dekning(K, 40, 40, regel([0], []), 1, 3);
  assert.ok(Math.abs(andelSum(M) - 1000) < 0.01);
});

test('dekning: utsnitt og hver rute gir det samme som hele', () => {
  const T: Flerflate = [
    [
      [
        [13, 17],
        [377, 61],
        [151, 389],
        [13, 17]
      ]
    ]
  ];
  const A = en([T]);
  let s = 0;
  hverRute(A, (q, a) => {
    s += a;
    assert.equal(andelVed(A, q % 40, Math.floor(q / 40)), a);
  });
  assert.ok(Math.abs(s / HEL - andelSum(A)) < 1e-9);
  const U = andelUtsnitt(A, 10, 5, 20, 20);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) assert.equal(andelVed(U, x, y), andelVed(A, x + 10, y + 5));
});

test('dekning: én og én rute gir det samme som skanlinjen', () => {
  const T: Flerflate = [
      [
        [
          [13, 17],
          [377, 61],
          [151, 389],
          [13, 17]
        ]
      ]
    ],
    kommune = firkant(0, 0, 222.2, 400),
    K = kanterI(
      [
        { lag: 0, ringer: ringer([kommune]) },
        { lag: 1, ringer: ringer([T]) }
      ],
      NETT
    ),
    [A] = dekning(K, 40, 40, regel([0], [1]), 1, 2),
    S = flatesok(T),
    KS = flatesok(kommune);
  let ulike = 0;
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 40; x++) {
      const d = dekningIRute(S, x * RES, 400 - y * RES, RES, [KS]);
      if (Math.abs(Math.round(d * HEL) - andelVed(A, x, y)) > 2) ulike++;
    }
  assert.equal(ulike, 0);
});

test('intervaller: union, minus og snitt', () => {
  assert.deepEqual(intervallUnion([5, 7, 1, 3, 2, 4]), [1, 4, 5, 7]);
  assert.deepEqual(intervallMinus([0, 10], [2, 3, 5, 6]), [0, 2, 3, 5, 6, 10]);
  assert.deepEqual(intervallMinus([0, 10, 12, 14], [-1, 1, 9, 13]), [1, 9, 13, 14]);
  assert.deepEqual(intervallSnitt([0, 5, 6, 10], [4, 7]), [4, 5, 6, 7]);
});
