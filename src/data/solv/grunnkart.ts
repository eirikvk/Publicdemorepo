/* Sølv for grunnkartet fra NIBIO: dagens klasser, én felles sannhet per nivå i kartet.
   Per blokk (solv.klasser): klassen per rute i blokkene på nivå 10 (10,6 meter), i samme rutenett som planen. De lages av
   kartbildene fra NIBIO, og for noen kommuner ligger de lagret ferdig sammen med siden (bronse.klassefil). Det lagrede er laget med
   den samme funksjonen, så det er samme svar. Tallene regnes av nivå 10. Finere nivåer leses av kartbildet på det nivået, med den
   samme funksjonen.
   Detaljklassene per blokk (solv.detaljklasser): det samme med 19 klasser fra NIBIO og to restklasser, lest innenfor dagens klasse
   på samme nivå (se klasser.ts), og lagret for noen kommuner på nivå 10 (bronse.detaljfil).
   Zoomet ut (solv.klasserUt og solv.detaljklasserUt): den vanligste klassen i blokkene på nivå 10 under hver piksel, så grovere
   nivåer aldri sier noe annet enn blokkene.
   For hele kommunen zoomet ut (Oversikt), fra to kilder side om side: blokkene satt sammen (solv.klassekart) og det sammensatte
   kartet av flisene som er hentet (solv.sammensatt). Gull velger mellom dem (gull.dagensKlasser).
   Kartbildene fra NIBIO leses som de er: klassen leses av fargen (klasserIFlis i klasser.ts). */
import { HEL, type Andel } from '../generelt/dekning.ts';
import { overlapper, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, OPPLOSNINGER, flisAvNavn, flisUtsnitt, flisnavn, type Flis, type Plassering } from './felles.ts';
import { arbeid } from './arbeid.ts';
import { ALLE, KLASSETABELL, detaljFlestIBlokk, detaljIKlassen, flestIBlokk } from './klasser.ts';
import { kommuneIBlokk } from './kommune.ts';
import { lesBilde, sti, tegneflate } from './raster.ts';

/* Dagens klasser zoomet ut: lerretet med klassene i rene farger, utsnittet det dekker (ext) og meter per piksel (res). dynamisk sier
   at det fylles på med det som hentes (det sammensatte kartet). */
export interface Oversikt {
  ext: Utsnitt;
  res: number;
  lerret: HTMLCanvasElement;
  dynamisk?: boolean;
}

/* Dagens klasser i en blokk på nivå 10: 512 x 512 ruter, plassert i flisnettet som planen (Planruter i felles.ts). kl er klassen per
   rute som i klasserIFlis: 0 ukjent, ellers plassen i ALLE pluss én (1 bebygd, 2 jordbruk, 3 natur, 4–6 vann). */
export interface Klasser extends Plassering {
  h: number;
  kl: Uint8Array;
}
const iBlokk = (tc: Flis): Plassering & { h: number } => ({
  z: tc[0],
  cx0: tc[1] * 512,
  cy0: tc[2] * 512,
  w: 512,
  h: 512
});

/* Tabellen solv.klasser: dagens klasser i flisen tc [z, x, y], laget av kartbildet fra NIBIO for flisen (bronse.grunnkartflis): 512 x
   512 piksler, og hver rute er én piksel. Klassen leses av fargen (klasserIFlis): det det er mest av, når fargen er en blanding. På
   nivå 10 er ruta 10,6 meter, og det er blokkene alle tallene regnes av. Finere nivåer (11, 12 og videre, med ruter på 5,3, 2,6 meter
   og så videre) er den felles sannheten for kartet zoomet inn: alle kartlagene tegnes av dem, men ingen tall regnes av dem. */
export async function klasser(tc: Flis): Promise<Klasser> {
  if (tc[0] < FLISNIVA) throw new Error('dagens klasser finnes fra nivå 10');
  return {
    ...iBlokk(tc),
    kl: await arbeid<Uint8Array>({ type: 'klasser', P: await katalog.bronse.grunnkartflis(tc) })
  };
}
/* Det lagrede svaret for solv.klasser: filen for blokken (bronse.klassefil), et bilde med fargetabellen KLASSETABELL. Klassen
   leses av fargen som for kartbildene. null når blokken ikke er lagret. */
export async function lagredeKlasser(tc: Flis): Promise<Klasser | null> {
  const buf = await katalog.bronse.klassefil(tc);
  return buf ? { ...iBlokk(tc), kl: await arbeid<Uint8Array>({ type: 'klasser', P: buf }) } : null;
}

/* Tabellen solv.detaljklasser: detaljklassen per rute i flisen tc [z, x, y]. Flisen er ett kartbilde fra NIBIO (bronse.detaljflis),
   og detaljklassen leses innenfor dagens klasse i den samme ruta på det samme nivået (solv.klasser): hører den til en annen av
   dagens klasser, blir den en restklasse (detaljIKlassen i klasser.ts). kl er 0 for ukjent, ellers plassen i DETALJKLASSER pluss
   én. Tallene regnes på nivå 10 (10,6 meter); finere nivåer er til kartet zoomet inn, som for dagens klasser. */
export async function detaljklasser(tc: Flis): Promise<Klasser> {
  if (tc[0] < FLISNIVA) throw new Error('detaljklassene finnes fra nivå 10');
  const [K, P] = await Promise.all([katalog.solv.klasser(tc), katalog.bronse.detaljflis(tc)]);
  return { ...iBlokk(tc), kl: detaljIKlassen(await arbeid<Uint8Array>({ type: 'detaljklasser', P }), K.kl) };
}
/* Blokkene på nivå 10 i flisen [z, x, y] under nivå 10 som kommunen nr har (solv.blokker): [i, j] i flisen, n blokker langs siden */
async function blokkerIFlis(nr: string, z: number, x: number, y: number) {
  const n = 1 << (FLISNIVA - z),
    har = new Set((await katalog.solv.blokker([nr, FLISNIVA])).map(([, bx, by]) => `${bx}/${by}`)),
    her: [number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (har.has(`${x * n + i}/${y * n + j}`)) her.push([i, j]);
  return { n, her };
}
/* Tabellen solv.klasserUt: dagens klasser i flisen [z, x, y] under nivå 10 for kommunen nr, kalt med [nr, z, x, y]: kartet zoomet
   ut. Hver piksel er n x n ruter på nivå 10 i kommunens blokker (solv.klasser), og får klassen flest av dem har (flestIBlokk i
   klasser.ts). Utledet av blokkene tallene regnes av, så det er den samme sannheten, bare grovere, og alle kartlagene zoomet ut
   tegnes av den. Blokker kommunen ikke har, er ukjent. */
export async function klasserUt([nr, z, x, y]: [string, number, number, number]): Promise<Klasser> {
  if (z >= FLISNIVA) throw new Error('klassene zoomet ut er under nivå 10');
  const { n, her } = await blokkerIFlis(nr, z, x, y),
    kl = new Uint8Array(512 * 512),
    s = 512 / n;
  await Promise.all(
    her.map(async ([i, j]) => {
      const K = await katalog.solv.klasser([FLISNIVA, x * n + i, y * n + j]);
      flestIBlokk(K.kl, n, kl, i * s, j * s, ALLE.length);
    })
  );
  return { ...iBlokk([z, x, y]), kl };
}
/* Tabellen solv.detaljklasserUt: det samme for detaljklassene (solv.detaljklasser), kalt med [nr, z, x, y]. Pikselen får dagens
   klasse flest av rutene har, og detaljklassen flest av rutene med den klassen har (detaljFlestIBlokk), så den alltid ligger innenfor
   dagens klasse i solv.klasserUt. */
export async function detaljklasserUt([nr, z, x, y]: [string, number, number, number]): Promise<Klasser> {
  if (z >= FLISNIVA) throw new Error('detaljklassene zoomet ut er under nivå 10');
  const { n, her } = await blokkerIFlis(nr, z, x, y),
    kl = new Uint8Array(512 * 512),
    s = 512 / n;
  await Promise.all(
    her.map(async ([i, j]) => {
      const tc: Flis = [FLISNIVA, x * n + i, y * n + j],
        [D, K] = await Promise.all([katalog.solv.detaljklasser(tc), katalog.solv.klasser(tc)]);
      detaljFlestIBlokk(D.kl, K.kl, n, kl, i * s, j * s);
    })
  );
  return { ...iBlokk([z, x, y]), kl };
}
/* Tabellen solv.detaljblokker: blokkene på nivå 10 for kommunen nr, som [10, x, y]: de samme som for dagens klasser (solv.blokker).
   For de lagrede blokkene leser solv.detaljklasser filen, og for de andre kartbildet fra NIBIO, ett kall per blokk. Slik er logikken
   den samme for alle kommuner, bare raskere der blokkene er lagret. */
export async function detaljblokker(nr: string): Promise<Flis[]> {
  return katalog.solv.blokker([nr, FLISNIVA]);
}
/* Det lagrede svaret for solv.detaljklasser: filen for blokken (bronse.detaljfil), et bilde med fargetabellen DETALJTABELL, laget
   med den samme funksjonen og med de lagrede dagens klasser. Fargene leses eksakt (detaljfilIFlis). null når blokken ikke er
   lagret. */
export async function lagredeDetaljklasser(tc: Flis): Promise<Klasser | null> {
  const buf = await katalog.bronse.detaljfil(tc);
  return buf ? { ...iBlokk(tc), kl: await arbeid<Uint8Array>({ type: 'detaljfil', P: buf }) } : null;
}

/* Dagens klasser K klippet til kommunen: ruter kommunen ikke dekker noe av, blir ukjent (0). A er kommunens andel i blokken
   (kommuneIBlokk i kommune.ts), eller null når hele blokken er i kommunen. En kantrute beholder klassen, og telles senere med den delen
   av den som er i kommunen. */
export function klasserIKommunen(K: Klasser, A: Andel | null): Uint8Array {
  const kl = K.kl.slice();
  if (!A) return kl;
  for (let y = 0; y < A.h; y++) {
    let x = 0;
    for (let p = A.rad[y]; p < A.rad[y + 1]; p++) {
      kl.fill(0, y * A.w + x, y * A.w + A.x[p]);
      x = A.x[p] + A.n[p];
    }
    kl.fill(0, y * A.w + x, (y + 1) * A.w);
  }
  return kl;
}
/* Arealet per klasse i K innenfor kommunen, i ruter rettet for målestokken: plass 0 er ruter innenfor uten klasse, og klasse k er
   plass k. antall er antall klasser pluss én. kommune er andelen i blokken og målestokken (kommuneIBlokk): kommunens, eller et temas
   i kommunen, som verneområdene. */
export function tellIKommunen(K: Klasser, kommune: { andel: Andel | null; faktor: number }, antall: number): number[] {
  const n = new Array<number>(antall).fill(0),
    f = kommune.faktor;
  const A = kommune.andel;
  if (!A) {
    for (let q = 0; q < K.kl.length; q++) n[K.kl[q]] += f;
    return n;
  }
  for (let y = 0; y < A.h; y++)
    for (let p = A.rad[y]; p < A.rad[y + 1]; p++) {
      const a = (A.a[p] / HEL) * f;
      for (let q = y * A.w + A.x[p], s = q + A.n[p]; q < s; q++) n[K.kl[q]] += a;
    }
  return n;
}
/* Tabellen solv.blokker: blokkene på nivå z (10) der kommunen nr dekker noe av minst én rute, som [z, x, y], fra kommunens andel i
   bitene (solv.kommunebiter). Kalles med [nr, z]. */
export async function blokker([nr, z]: [string, number]): Promise<Flis[]> {
  if (z !== FLISNIVA) throw new Error('blokkene er på nivå 10');
  const KB = await katalog.solv.kommunebiter(nr),
    ut: Flis[] = [];
  for (const K of KB) {
    const f = 1 << (z - K.tc[0]);
    for (let j = 0; j < f; j++)
      for (let i = 0; i < f; i++) {
        const tc: Flis = [z, K.tc[1] * f + i, K.tc[2] * f + j],
          { andel } = kommuneIBlokk([K], tc);
        if (!andel || andel.a.length) ut.push(tc);
      }
  }
  return ut.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
}
/* Tabellen solv.klassekart: dagens klasser for kommunen nr zoomet ut, satt sammen av blokkene på 10,6 meter (solv.blokker og
   solv.klasser på nivå 10) og klippet til kommunen, så det er tomt utenfor. Bare til kartet: én piksel er 1, 2, 4 eller flere
   ruter, så det blir høyst 2048 piksler på lengste side. Blokkene leses seks om gangen og snittes rett inn i bildet. */
export async function klassekart(nr: string): Promise<Oversikt> {
  const [B, G] = await Promise.all([katalog.solv.blokker([nr, FLISNIVA]), katalog.solv.grense(nr)]);
  if (!B.length) throw new Error('ingen blokker');
  const x0 = Math.min(...B.map(t => t[1])),
    y0 = Math.min(...B.map(t => t[2])),
    nx = Math.max(...B.map(t => t[1])) - x0 + 1,
    ny = Math.max(...B.map(t => t[2])) - y0 + 1;
  let f = 1; /* ruter per piksel */
  while ((Math.max(nx, ny) * 512) / f > 2048) f *= 2;
  const z = B[0][0],
    m = OPPLOSNINGER[z] / 2,
    s = 512 / f,
    W = nx * s,
    g = tegneflate(W, ny * s),
    d = g.createImageData(W, ny * s),
    o = d.data,
    a = flisUtsnitt([z, x0, y0]),
    b = flisUtsnitt([z, x0 + nx - 1, y0 + ny - 1]);
  /* hver piksel er snittet av fargene til de f x f rutene den dekker, og dekningen er andelen ruter med klasse: det samme som å
     krympe blokken med utjevning, uten et lerret per blokk */
  const blokk = (tc: Flis, kl: Uint8Array) => {
    const ox = (tc[1] - x0) * s,
      oy = (tc[2] - y0) * s;
    for (let py = 0; py < s; py++)
      for (let px = 0; px < s; px++) {
        let n = 0,
          r = 0,
          gr = 0,
          bl = 0;
        for (let y = py * f; y < py * f + f; y++)
          for (let x = px * f; x < px * f + f; x++) {
            const k = kl[y * 512 + x];
            if (!k) continue;
            const c = KLASSETABELL[k];
            n++;
            r += c[0];
            gr += c[1];
            bl += c[2];
          }
        if (!n) continue;
        const i = 4 * ((oy + py) * W + ox + px);
        o[i] = r / n;
        o[i + 1] = gr / n;
        o[i + 2] = bl / n;
        o[i + 3] = (255 * n) / (f * f);
      }
  };
  const ko = [...B];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let tc = ko.shift(); tc; tc = ko.shift()) blokk(tc, (await katalog.solv.klasser(tc)).kl);
    })
  );
  g.putImageData(d, 0, 0);
  const ext: Utsnitt = [a[0], b[1], b[2], a[3]];
  g.globalCompositeOperation = 'destination-in';
  sti(g, G.koord, ext, 1 / (m * f));
  g.fill('evenodd');
  g.globalCompositeOperation = 'source-over';
  return { lerret: g.canvas, ext, res: m * f };
}

/* Det sammensatte kartet: lerretet (c) med klassene i rene farger, meter per piksel, utsnittet det dekker, flisene som er lagt inn
   (som «nivå/x/y», se flisnavn), og det samme som Oversikt (ov), til kartet og utregningene */
export interface Samling {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  res: number;
  ext: [number, number, number, number];
  har: Set<string>;
  ov: Oversikt;
}
/* Tabellen solv.sammensatt: dagens klasser for kommunen nr, satt sammen av kartbildene fra NIBIO som er hentet. Kilden er det
   brukeren har sett på: flisene som ligger i cachen (bronse.grunnkartflis). Det er et uttalt unntak fra regelen om å vente på det
   man bygger på, for det som er hentet, er selve kilden. Tabellen er voksende: datamotoren legger inn nye fliser etter hvert som de
   hentes (tegnISamling), uten å vente på at kartet står stille. Det sammensatte kartet dekker kommunens utsnitt. */
export async function sammensatt(nr: string): Promise<Samling> {
  const s = nySamling((await katalog.solv.grense(nr)).ext);
  await fyllSamling(s);
  return s;
}
/* Alle fliser cachen har som berører det sammensatte kartet s, og som ikke er lagt inn, legges inn, én om gangen og uten nye kall.
   Det gjentas til det ikke er flere, for nye fliser kan komme mens bildene leses inn. Et bilde som ikke kan leses, hoppes over. */
export async function fyllSamling(s: Samling) {
  const provd = new Set<string>();
  for (;;) {
    const nye = katalog.bronse.grunnkartflis
      .alle()
      .filter(([n]) => !s.har.has(n) && !provd.has(n) && overlapper(flisUtsnitt(flisAvNavn(n)), s.ext));
    if (!nye.length) return;
    for (const [n, buf] of nye) {
      provd.add(n);
      try {
        const bm = await lesBilde(buf);
        if (!s.har.has(n)) tegnISamling(s, flisAvNavn(n), bm);
        if (bm.close) bm.close();
      } catch (e) {
        /* hoppes over */
      }
    }
  }
}
/* Et tomt sammensatt kart over utsnittet e: høyst 2048 piksler på den lengste siden, og ikke finere enn flisene fra NIBIO */
export function nySamling(e: Utsnitt): Samling {
  const res = Math.max(OPPLOSNINGER[FLISNIVA] / 2, Math.max(e[2] - e[0], e[3] - e[1]) / 2048),
    g = tegneflate(Math.ceil((e[2] - e[0]) / res), Math.ceil((e[3] - e[1]) / res)),
    c = g.canvas;
  const ext: [number, number, number, number] = [e[0], e[3] - c.height * res, e[0] + c.width * res, e[3]];
  return { c, g, res, ext, har: new Set<string>(), ov: { lerret: c, ext, res, dynamisk: true } };
}
/* Flisen tc, lest inn som bilde bm, inn i det sammensatte kartet s. Gir stedet i lerretet [x, y, b, h] der den ble lagt. Flisen legges
   på hele piksler. Ellers blir kantpikselen halvt gjennomsiktig fra begge naboflisene, og skjøten vises som en lys stripe. */
export function tegnISamling(s: Samling, tc: Flis, bm: ImageBitmap): [number, number, number, number] {
  s.har.add(flisnavn(tc));
  const u = flisUtsnitt(tc),
    px = (v: number) => Math.round((v - s.ext[0]) / s.res),
    py = (v: number) => Math.round((s.ext[3] - v) / s.res);
  const X = px(u[0]),
    Y = py(u[3]),
    W = px(u[2]) - X,
    H = py(u[1]) - Y;
  s.g.drawImage(bm, X, Y, W, H);
  return [X, Y, W, H];
}
