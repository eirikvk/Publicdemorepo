/* Sølv for kommunen: grensen i felles form, og temaene som hentes i biter (inngrepsfri natur og grått areal) talt i kommunen. De
   telles på samme måte (tellIKommune), så det står bare her. */
import { flerflate, utsnitt, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { BITNIVA, HALV, arealKm2, biterI, bitRuter, m2PerKm2, type Flis, type Piksler } from './felles.ts';
import { flatePiksler } from './raster.ts';

/* Kommunegrensen: flerflaten i UTM33, utsnittet og flaten i km² (land og vann) */
export interface Grense {
  nr: string;
  koord: Flerflate;
  ext: Utsnitt;
  km2: number;
}
/* Tabellen solv.grense: kommunegrensen fra Kartverket som flerflate, med utsnitt og flate rettet for målestokken i UTM */
export async function grense(nr: string): Promise<Grense> {
  const koord = flerflate(await katalog.bronse.kommunegrense(nr)),
    ext = utsnitt(koord);
  return { nr, koord, ext, km2: arealKm2(koord, ext) };
}

/* Et tema som hentes i biter, talt i kommunen nr: antall ruter per verdi innenfor kommunen (n), bitene kommunen har ruter i
   (biter), meter per rute (res, 10,6) og skala (m2PerKm2 for kommunen), så arealet kan regnes ut */
export interface Bitruter {
  nr: string;
  n: number[];
  biter: Flis[];
  res: number;
  skala: number;
}
/* Teller et tema i kommunen nr bit for bit. verdier gir verdien per rute i en bit (fra katalogen), og plass plassen i n for verdien,
   eller null når den ikke telles. plasser er lengden på n. En rute er i kommunen når kommunens flate dekker minst halve ruta. Biter
   kommunen ikke berører, hentes ikke. Fire biter hentes om gangen. hver kalles for hver bit med verdiene (V) og kommunens flate
   (M, alfa er dekningen), når den som kaller trenger mer enn antallet. */
export async function tellIKommune(
  nr: string,
  plasser: number,
  verdier: (tc: Flis) => Promise<ArrayLike<number>>,
  plass: (v: number) => number | null,
  hver?: (tc: Flis, V: ArrayLike<number>, M: Piksler) => void
): Promise<Bitruter> {
  const g = await katalog.solv.grense(nr),
    n = new Array<number>(plasser).fill(0),
    alle = biterI(g.ext),
    biter: Flis[] = [],
    res = bitRuter(alle[0] || [BITNIVA, 0, 0]).res;
  const en = async (tc: Flis) => {
    /* først et grovt bilde (64 x 64) for å se om kommunen berører biten, så biter utenfor ikke hentes */
    const R = bitRuter(tc),
      grov = flatePiksler(g.koord, { u: R.u, res: R.res * (R.w / 64), w: 64, h: 64 });
    let berort = false;
    for (let i = 3; i < grov.length && !berort; i += 4) berort = grov[i] > 0;
    if (!berort) return;
    const V = await verdier(tc),
      M = flatePiksler(g.koord, R);
    let inne = false;
    for (let q = 0; q < V.length; q++) {
      if (M[4 * q + 3] < HALV) continue;
      inne = true;
      const p = plass(V[q]);
      if (p !== null) n[p]++;
    }
    if (inne) biter.push(tc);
    if (inne && hver) hver(tc, V, M);
  };
  const ko = [...alle];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let tc = ko.shift(); tc; tc = ko.shift()) await en(tc);
    })
  );
  biter.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
  return { nr, n, biter, res, skala: m2PerKm2(g.ext) };
}

/* Tabellen solv.kommuneareal: flaten til hver kommune i km² (land, ferskvann og hav), etter kommunenummer */
export async function kommuneareal(): Promise<Record<string, number>> {
  return (await katalog.bronse.kommuneareal()).km2;
}
