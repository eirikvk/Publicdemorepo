/* Generelt: dekningsandel. Hvor stor andel av hver rute i et rutenett flater dekker, regnet i egen kode uten lerret, så svaret blir
   det samme i alle nettlesere og kan regnes i bakgrunnstråden.

   Metoden er en skanlinje: hver ruterad deles i fire delrader (DELRADER), og langs hver delrad finnes nøyaktig hvor flatene begynner og
   slutter. Bortover er dekningen dermed eksakt, nedover er den et snitt av de fire delradene. Hvilke flater et punkt ligger i, avgjøres
   med vindingstall per lag: ytterkantene teller +1 og hullene −1, så der to flater overlapper, telles området én gang (unionen), og et
   hull i én flate er dekket hvis en annen flate ligger over det. Et lag er en gruppe flater, for eksempel kommunen eller én
   verdikategori. En regel gjør vindingstallene om til en klasse: hvilke lag punktet må ligge i (masken), og hvilket lag som vinner
   der flere overlapper (kategoriene, i rekkefølge).

   Andelen lagres som spenn per ruterad (Andel): løp av hele ruter og ruter som er delvis dekket, med andelen i 16 biter (0–HEL). Bare
   kantrutene er delvis dekket, så en bit på 2048 x 2048 ruter tar som regel noen hundre kilobyte og ikke 4 MB. Med 16 biter blir
   avrundingen så liten at den ikke summerer seg opp langs lange, smale flater (med 8 biter ble en smal stripe 0,6 % for stor).

   Nederst er den samme regelen for én og én rute (dekningIRute), med oppslagene fra geometri.ts. Den brukes der bare noen få ruter
   trengs, som rutene med planlagt utbygging, og gir det samme som skanlinjen for de samme rutene.

   Filen vet ingenting om kart eller kilder. Koordinatene er i et plant system (meter i UTM), og rutenettet ligger med første rad
   øverst. */
import type { Flatesok, Flerflate, Utsnitt } from './geometri.ts';

/* Delrader per ruterad */
export const DELRADER = 4;
/* Andelen for en hel rute */
export const HEL = 65535;

/* Et rutenett: utsnittet rutene dekker (u), meter per rute (res), og bredde og høyde i ruter. Samme form som Rutebilde i sølv. */
export interface Nett {
  u: Utsnitt;
  res: number;
  w: number;
  h: number;
}
/* Kantene til flatene i rutekoordinater: [x0, y0, x1, y1] per kant, med x mot høyre og y nedover fra øverste rad, og laget hver kant
   hører til. Ytterkantene og hullene er snudd så de har motsatt omløpsretning. */
export interface Kanter {
  k: Float64Array;
  lag: Uint8Array;
  n: number;
}
/* Dekningen av ett lag eller én klasse i et rutenett, som spenn per rad. For rad y står postene rad[y] til rad[y + 1] − 1, sortert
   bortover. Post p dekker rutene x[p] til x[p] + n[p] − 1 med andelen a[p] (HEL er hele ruta, mindre er delvis). Ruter uten post er
   ikke dekket. */
export interface Andel {
  w: number;
  h: number;
  rad: Int32Array;
  x: Uint16Array;
  n: Uint16Array;
  a: Uint16Array;
}

/* Arealet av en ring med fortegn i koordinatenes enhet: positivt mot klokka */
function ringAreal(ring: number[][]) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return a / 2;
}

/* Kantene til flerflatene i settene, i rutenettet R. Hvert sett er flatene i ett lag. Ytterkanten i hver flate går mot klokka og
   hullene med klokka, uansett hvordan kilden har tegnet dem. Kanter som ligger helt over, helt under eller helt til høyre for
   rutenettet, tas ikke med: de endrer ikke vindingstallet i noen rute. Kanter til venstre tas med, for de gjør det. */
export function kanterI(sett: { lag: number; flater: Flerflate[] }[], R: Nett): Kanter {
  let n = 0;
  for (const s of sett)
    for (const koord of s.flater) for (const flate of koord) for (const ring of flate) n += ring.length;
  const k = new Float64Array(4 * n),
    lag = new Uint8Array(n),
    sx = 1 / R.res;
  let m = 0;
  for (const s of sett)
    for (const koord of s.flater)
      for (const flate of koord)
        flate.forEach((ring, nr) => {
          const ant = ring.length;
          if (ant < 3) return;
          /* mot klokka i kartet for ytterkanten, med klokka for hull */
          const snu = ringAreal(ring) > 0 !== (nr === 0);
          for (let i = 0; i < ant; i++) {
            const p = ring[snu ? ant - 1 - i : i],
              q = ring[snu ? (2 * ant - 2 - i) % ant : (i + 1) % ant],
              x0 = (p[0] - R.u[0]) * sx,
              y0 = (R.u[3] - p[1]) * sx,
              x1 = (q[0] - R.u[0]) * sx,
              y1 = (R.u[3] - q[1]) * sx;
            if (y0 === y1) continue;
            if ((y0 <= 0 && y1 <= 0) || (y0 >= R.h && y1 >= R.h) || (x0 >= R.w && x1 >= R.w)) continue;
            k[4 * m] = x0;
            k[4 * m + 1] = y0;
            k[4 * m + 2] = x1;
            k[4 * m + 3] = y1;
            lag[m] = s.lag;
            m++;
          }
        });
  return { k, lag, n: m };
}

/* Regelen for klassen i et punkt, fra vindingstallet per lag: −1 når punktet ikke er med. maske er lagene punktet må ligge i
   (kommunen, det kartlagte). kategorier er lagene som gir klassen, i rekkefølge: den første kategorien punktet ligger i, vinner.
   Uten kategorier er klassen 0 overalt i masken. */
export function regel(maske: number[], kategorier: number[]) {
  return (vind: Int32Array) => {
    for (const m of maske) if (!vind[m]) return -1;
    if (!kategorier.length) return 0;
    for (let i = 0; i < kategorier.length; i++) if (vind[kategorier[i]]) return i;
    return -1;
  };
}

/* Dekningen i et rutenett på w x h ruter av klassene regelen klasse gir, fra kantene K. lag er antall lag kantene bruker, og antall
   antall klasser. Gir én Andel per klasse. */
export function dekning(
  K: Kanter,
  w: number,
  h: number,
  klasse: (vind: Int32Array) => number,
  antall: number,
  lag: number
): Andel[] {
  const ne = K.n,
    ymin = new Float64Array(ne),
    ymax = new Float64Array(ne),
    x0 = new Float64Array(ne),
    dxdy = new Float64Array(ne),
    retning = new Int8Array(ne),
    start = new Int32Array(h + 1),
    forsteRad = (y: number) => Math.min(h - 1, Math.max(0, Math.floor(y)));
  /* kantene sortert etter første rad de krysser */
  for (let e = 0; e < ne; e++) {
    let ax = K.k[4 * e],
      ay = K.k[4 * e + 1],
      bx = K.k[4 * e + 2],
      by = K.k[4 * e + 3],
      r = 1;
    if (ay > by) {
      [ax, bx] = [bx, ax];
      [ay, by] = [by, ay];
      r = -1;
    }
    ymin[e] = ay;
    ymax[e] = by;
    x0[e] = ax;
    dxdy[e] = (bx - ax) / (by - ay);
    retning[e] = r;
    start[forsteRad(ay) + 1]++;
  }
  for (let y = 0; y < h; y++) start[y + 1] += start[y];
  const orden = new Int32Array(ne),
    pos = start.slice(0, h + 1);
  for (let e = 0; e < ne; e++) orden[pos[forsteRad(ymin[e])]++] = e;

  const vekt = 1 / DELRADER,
    diff = Array.from({ length: antall }, () => new Float64Array(w + 2)),
    brukt = new Uint8Array(antall),
    vind = new Int32Array(Math.max(1, lag)),
    ut = Array.from({ length: antall }, () => ({
      rad: new Int32Array(h + 1),
      x: [] as number[],
      n: [] as number[],
      a: [] as number[]
    }));
  let aktiv: number[] = [];
  const kx: number[] = [],
    ke: number[] = [],
    idx: number[] = [];
  /* legger delraden fra xa til xb inn i klassen c som differanser, med eksakte endestykker */
  const spenn = (c: number, xa: number, xb: number) => {
    if (xb <= 0 || xa >= w || xb <= xa) return;
    if (xa < 0) xa = 0;
    if (xb > w) xb = w;
    const d = diff[c],
      ia = Math.floor(xa),
      ib = Math.floor(xb);
    brukt[c] = 1;
    if (ia === ib) {
      d[ia] += vekt * (xb - xa);
      d[ia + 1] -= vekt * (xb - xa);
      return;
    }
    d[ia] += vekt * (ia + 1 - xa);
    d[ia + 1] -= vekt * (ia + 1 - xa);
    d[ia + 1] += vekt;
    d[ib] -= vekt;
    if (xb > ib) {
      d[ib] += vekt * (xb - ib);
      d[ib + 1] -= vekt * (xb - ib);
    }
  };
  const tom = klasse(vind); /* klassen utenfor alle flater: som regel −1 */
  for (let y = 0; y < h; y++) {
    for (let t = start[y]; t < start[y + 1]; t++) aktiv.push(orden[t]);
    if (aktiv.length) aktiv = aktiv.filter(e => ymax[e] > y);
    for (let s = 0; s < DELRADER; s++) {
      const ys = y + (s + 0.5) * vekt;
      kx.length = 0;
      ke.length = 0;
      for (const e of aktiv)
        if (ymin[e] <= ys && ymax[e] > ys) {
          kx.push(x0[e] + (ys - ymin[e]) * dxdy[e]);
          ke.push(e);
        }
      const m = kx.length;
      if (!m) {
        if (tom >= 0) spenn(tom, 0, w);
        continue;
      }
      idx.length = m;
      for (let i = 0; i < m; i++) idx[i] = i;
      idx.sort((i, j) => kx[i] - kx[j] || i - j);
      vind.fill(0);
      let c = tom,
        fra = -Infinity;
      for (let i = 0; i < m; i++) {
        const j = idx[i],
          e = ke[j],
          x = kx[j];
        vind[K.lag[e]] += retning[e];
        const ny = klasse(vind);
        if (ny === c) continue;
        if (c >= 0) spenn(c, fra, x);
        c = ny;
        fra = x;
      }
      if (c >= 0) spenn(c, fra, w);
    }
    /* raden ferdig: differansene summeres til andelen per rute, og blir spenn */
    for (let c = 0; c < antall; c++) {
      const U = ut[c];
      U.rad[y] = U.x.length;
      if (!brukt[c]) continue;
      const d = diff[c];
      let acc = 0,
        lop = -1;
      for (let x = 0; x <= w; x++) {
        acc += d[x];
        d[x] = 0;
        const a = x < w ? Math.round(Math.min(1, Math.max(0, acc)) * HEL) : 0;
        if (a === HEL) {
          if (lop < 0) lop = x;
          continue;
        }
        if (lop >= 0) {
          U.x.push(lop);
          U.n.push(x - lop);
          U.a.push(HEL);
          lop = -1;
        }
        if (a > 0) {
          U.x.push(x);
          U.n.push(1);
          U.a.push(a);
        }
      }
      d[w + 1] = 0;
      brukt[c] = 0;
    }
  }
  return ut.map(U => {
    U.rad[h] = U.x.length;
    return { w, h, rad: U.rad, x: Uint16Array.from(U.x), n: Uint16Array.from(U.n), a: Uint16Array.from(U.a) };
  });
}

/* Summen av andelene i A, i hele ruter */
export function andelSum(A: Andel): number {
  let s = 0;
  for (let p = 0; p < A.a.length; p++) s += A.n[p] * A.a[p];
  return s / HEL;
}
/* Andelen 0–HEL i ruta (x, y) i A */
export function andelVed(A: Andel, x: number, y: number): number {
  let lo = A.rad[y],
    hi = A.rad[y + 1] - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (x < A.x[m]) hi = m - 1;
    else if (x >= A.x[m] + A.n[m]) lo = m + 1;
    else return A.a[m];
  }
  return 0;
}
/* Kaller hver(q, a) for hver rute q (y · w + x) i A med andelen a (1–HEL) */
export function hverRute(A: Andel, hver: (q: number, a: number) => void) {
  for (let y = 0; y < A.h; y++)
    for (let p = A.rad[y]; p < A.rad[y + 1]; p++) {
      const q0 = y * A.w + A.x[p],
        a = A.a[p];
      for (let i = 0; i < A.n[p]; i++) hver(q0 + i, a);
    }
}
/* Om hele rutenettet er dekket */
export const helt = (A: Andel) => A.a.length === A.h && andelSum(A) === A.w * A.h;
/* Bufferne i A, til å flytte den mellom tråder uten kopi */
export const andelBuffere = (A: Andel): ArrayBuffer[] =>
  [A.rad.buffer, A.x.buffer, A.n.buffer, A.a.buffer] as ArrayBuffer[];
/* Andelen i delen av A som starter i ruta (x0, y0) og er w x h ruter: for en blokk inne i en bit */
export function andelUtsnitt(A: Andel, x0: number, y0: number, w: number, h: number): Andel {
  const rad = new Int32Array(h + 1),
    x: number[] = [],
    n: number[] = [],
    a: number[] = [];
  for (let y = 0; y < h; y++) {
    rad[y] = x.length;
    for (let p = A.rad[y0 + y]; p < A.rad[y0 + y + 1]; p++) {
      const fra = Math.max(A.x[p], x0),
        til = Math.min(A.x[p] + A.n[p], x0 + w);
      if (til <= fra) continue;
      x.push(fra - x0);
      n.push(til - fra);
      a.push(A.a[p]);
    }
  }
  rad[h] = x.length;
  return { w, h, rad, x: Uint16Array.from(x), n: Uint16Array.from(n), a: Uint16Array.from(a) };
}

/* Intervallene [a0, b0, a1, b1, …] langs linjen y fra xa til xb der punktet ligger i flaten bak oppslaget S, med samme regel som
   iSok (like-ulik): legges til i ut */
export function sokIntervaller(S: Flatesok, y: number, xa: number, xb: number, ut: number[]) {
  if (y < S.ext[1] || y > S.ext[3] || xb <= S.ext[0] || xa >= S.ext[2]) return;
  const B = S.band[Math.min(S.band.length - 1, Math.max(0, Math.floor((y - S.y0) / S.dy)))],
    x: number[] = [];
  for (let i = 0; i < B.length; i += 4) {
    const xi = B[i],
      yi = B[i + 1],
      xj = B[i + 2],
      yj = B[i + 3];
    if (yi > y !== yj > y) x.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  x.sort((p, q) => p - q);
  for (let i = 0; i + 1 < x.length; i += 2) {
    const a = Math.max(xa, x[i]),
      b = Math.min(xb, x[i + 1]);
    if (b > a) ut.push(a, b);
  }
}
/* Unionen av intervallene i I (par, i vilkårlig rekkefølge), sortert og uten overlapp */
export function intervallUnion(I: number[]): number[] {
  if (I.length <= 2) return I.slice();
  const o = Array.from({ length: I.length / 2 }, (_, i) => i).sort((p, q) => I[2 * p] - I[2 * q]),
    ut: number[] = [];
  for (const i of o) {
    const a = I[2 * i],
      b = I[2 * i + 1];
    if (ut.length && a <= ut[ut.length - 1]) ut[ut.length - 1] = Math.max(ut[ut.length - 1], b);
    else ut.push(a, b);
  }
  return ut;
}
/* Intervallene i A (sortert, uten overlapp) minus intervallene i B (sortert, uten overlapp) */
export function intervallMinus(A: number[], B: number[]): number[] {
  const ut: number[] = [];
  let j = 0;
  for (let i = 0; i < A.length; i += 2) {
    let a = A[i];
    const b = A[i + 1];
    while (j < B.length && B[j + 1] <= a) j += 2;
    let k = j;
    while (k < B.length && B[k] < b) {
      if (B[k] > a) ut.push(a, B[k]);
      a = Math.max(a, B[k + 1]);
      k += 2;
    }
    if (b > a) ut.push(a, b);
  }
  return ut;
}
/* Snittet av to sorterte intervallister uten overlapp */
export function intervallSnitt(A: number[], B: number[]): number[] {
  const ut: number[] = [];
  let i = 0,
    j = 0;
  while (i < A.length && j < B.length) {
    const a = Math.max(A[i], B[j]),
      b = Math.min(A[i + 1], B[j + 1]);
    if (b > a) ut.push(a, b);
    if (A[i + 1] < B[j + 1]) i += 2;
    else j += 2;
  }
  return ut;
}
/* Samlet lengde av intervallene */
export function intervallLengde(I: number[]) {
  let s = 0;
  for (let i = 0; i < I.length; i += 2) s += I[i + 1] - I[i];
  return s;
}
/* Delradene i ruta med øverste kant ytop og sidene res, i kartets koordinater (y oppover): de samme som skanlinjen bruker */
export const delradene = (ytop: number, res: number) =>
  Array.from({ length: DELRADER }, (_, s) => ytop - ((s + 0.5) / DELRADER) * res);
/* Andelen 0–1 av ruta med venstre kant x0, øverste kant ytop og sider res som ligger i flaten bak oppslaget S, og i alle oppslagene
   i innenfor (for eksempel kommunen) */
export function dekningIRute(S: Flatesok, x0: number, ytop: number, res: number, innenfor: Flatesok[] = []) {
  let sum = 0;
  for (const y of delradene(ytop, res)) {
    let I: number[] = [];
    sokIntervaller(S, y, x0, x0 + res, I);
    for (const K of innenfor) {
      if (!I.length) break;
      const J: number[] = [];
      sokIntervaller(K, y, x0, x0 + res, J);
      I = intervallSnitt(I, J);
    }
    sum += intervallLengde(I);
  }
  return sum / (DELRADER * res);
}
