/* Sølv for grunnkartet fra NIBIO: arealklassene per rute, én felles sannhet per nivå i kartet. Ett datasett med to kolonner: klassen
   (bebygd, jordbruk, natur, vann eller ukjent) og detaljklassen (19 klasser fra NIBIO og to restklasser), som alltid ligger innenfor
   klassen.
   Per blokk (solv.klasser): klassen og detaljklassen per rute i blokkene på nivå 10 (10,6 meter), i samme rutenett som planen. De
   lages av to kartbilder fra NIBIO per flis, ett med klassene og ett med detaljklassene, og for noen kommuner ligger de lagret ferdig
   sammen med siden (bronse.klassefil og bronse.detaljfil), hver kolonne for seg. Det lagrede er laget med den samme funksjonen, så det
   er samme svar. Tallene regnes av nivå 10. Finere nivåer leses av kartbildene på det nivået, med den samme funksjonen.
   Zoomet ut (solv.klasserUt): den vanligste klassen i blokkene på nivå 10 under hver piksel, og den vanligste detaljklassen innenfor
   den, så grovere nivåer aldri sier noe annet enn blokkene.
   Kartbildene fra NIBIO leses som de er: klassen leses av fargen (klasserIFlis i klasser.ts). */
import { HEL, type Andel } from '../generelt/dekning.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, type Flis, type Plassering } from './felles.ts';
import { arbeid } from './arbeid.ts';
import { ALLE, detaljFlestIBlokk, detaljIKlassen, flestIBlokk } from './klasser.ts';
import { kommuneIBlokk } from './kommune.ts';

/* Dagens klasser i en blokk på nivå 10: 512 x 512 ruter, plassert i flisnettet som planen (Planruter i felles.ts). kl er klassen per
   rute som i klasserIFlis: 0 ukjent, ellers plassen i ALLE pluss én (1 bebygd, 2 jordbruk, 3 natur, 4–6 vann). Det samme for en
   flis på et annet nivå, og for temaene per flis (graa.ts og inon.ts), med 0 for ingenting. iBlokk gir plasseringen for flisen tc. */
export interface Klasser extends Plassering {
  h: number;
  kl: Uint8Array;
}
export const iBlokk = (tc: Flis): Plassering & { h: number } => ({
  z: tc[0],
  cx0: tc[1] * 512,
  cy0: tc[2] * 512,
  w: 512,
  h: 512
});

/* Grunnkartet i en flis: klassen (kl, som i Klasser) og detaljklassen (detalj: 0 for ukjent, ellers plassen i DETALJKLASSER pluss én)
   per rute. Detaljklassen ligger alltid innenfor klassen. */
export interface Grunnkart extends Klasser {
  detalj: Uint8Array;
}

/* Tabellen solv.klasser: grunnkartet i flisen tc [z, x, y], fra nivå 10: klassen og detaljklassen per rute, 512 x 512 ruter, og hver
   rute er én piksel. Klassen leses av kartbildet med klassene (bronse.grunnkartflis), og detaljklassen av kartbildet med
   detaljklassene (bronse.detaljflis), innenfor klassen i den samme ruta: hører den til en annen klasse, blir den en restklasse
   (detaljIKlassen i klasser.ts). Fargen leses som det det er mest av, når den er en blanding. På nivå 10 er ruta 10,6 meter, og det er
   blokkene alle tallene regnes av. For noen kommuner ligger blokkene lagret sammen med siden, klassene og detaljklassene hver for seg
   (bronse.klassefil og bronse.detaljfil), og da leses kolonnen derfra i stedet for fra NIBIO. Finere nivåer (11, 12 og videre, med
   ruter på 5,3, 2,6 meter og så videre) er den felles sannheten for kartet zoomet inn: alle kartlagene tegnes av dem, men ingen tall
   regnes av dem. */
export async function klasser(tc: Flis): Promise<Grunnkart> {
  if (tc[0] < FLISNIVA) throw new Error('grunnkartet finnes fra nivå 10');
  const lagret = tc[0] === FLISNIVA,
    [kf, df] = lagret ? await Promise.all([katalog.bronse.klassefil(tc), katalog.bronse.detaljfil(tc)]) : [null, null],
    kl = await arbeid<Uint8Array>({ type: 'klasser', P: kf || (await katalog.bronse.grunnkartflis(tc)) }),
    detalj = df
      ? await arbeid<Uint8Array>({ type: 'detaljfil', P: df })
      : detaljIKlassen(await arbeid<Uint8Array>({ type: 'detaljklasser', P: await katalog.bronse.detaljflis(tc) }), kl);
  return { ...iBlokk(tc), kl, detalj };
}
/* Blokkene på nivå 10 i flisen [z, x, y] under nivå 10 som kommunen nr har (solv.blokker): [i, j] i flisen, n blokker langs siden */
async function blokkerIFlis(nr: string, z: number, x: number, y: number) {
  const n = 1 << (FLISNIVA - z),
    har = new Set((await katalog.solv.blokker([nr, FLISNIVA])).map(([, bx, by]) => `${bx}/${by}`)),
    her: [number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (har.has(`${x * n + i}/${y * n + j}`)) her.push([i, j]);
  return { n, her };
}
/* Tabellen solv.klasserUt: grunnkartet i flisen [z, x, y] under nivå 10 for kommunen nr, kalt med [nr, z, x, y]: kartet zoomet
   ut. Hver piksel er n x n ruter på nivå 10 i kommunens blokker (solv.klasser), og får klassen flest av dem har (flestIBlokk i
   klasser.ts), og detaljklassen flest av rutene med den klassen har (detaljFlestIBlokk), så den alltid ligger innenfor klassen.
   Utledet av blokkene tallene regnes av, så det er den samme sannheten, bare grovere, og alle kartlagene zoomet ut tegnes av den.
   Blokker kommunen ikke har, er ukjent. */
export async function klasserUt([nr, z, x, y]: [string, number, number, number]): Promise<Grunnkart> {
  if (z >= FLISNIVA) throw new Error('grunnkartet zoomet ut er under nivå 10');
  const { n, her } = await blokkerIFlis(nr, z, x, y),
    kl = new Uint8Array(512 * 512),
    detalj = new Uint8Array(512 * 512),
    s = 512 / n;
  await Promise.all(
    her.map(async ([i, j]) => {
      const K = await katalog.solv.klasser([FLISNIVA, x * n + i, y * n + j]);
      flestIBlokk(K.kl, n, kl, i * s, j * s, ALLE.length);
      detaljFlestIBlokk(K.detalj, K.kl, n, detalj, i * s, j * s);
    })
  );
  return { ...iBlokk([z, x, y]), kl, detalj };
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
export function tellIKommunen(
  K: Pick<Klasser, 'kl'>,
  kommune: { andel: Andel | null; faktor: number },
  antall: number
): number[] {
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
