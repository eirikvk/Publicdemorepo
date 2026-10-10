/* Sølv for kommunen: grensen i felles form, og bilder av hele kommunen tolket til ruter. Bildene av inngrepsfri natur og grått
   areal tolkes på samme måte (tolketBilde), så det står bare her. */
import { flerflate, utsnitt, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { BILDE_TEMA, arealKm2, m2PerKm2, rutenett, type Piksler, type Rutebilde } from './felles.ts';
import { bildePiksler, flatePiksler } from './raster.ts';

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

/* Rutenettet bildene av hele kommunen hentes og tolkes i */
export async function bildenett(nr: string): Promise<Rutebilde> {
  return rutenett((await katalog.solv.grense(nr)).ext, ...BILDE_TEMA);
}
/* Et bilde av hele kommunen tolket til ruter: rutenettet, kommunen (nr), antall ruter per klasse innenfor kommunen (n), og skala
   (m2PerKm2 for kommunen), så arealet kan regnes ut */
export type Kommuneruter<E> = Rutebilde & { nr: string; n: ArrayLike<number>; skala: number } & E;
/* Bildene b av kommunen nr tolket med tolk, sammen med kommunens flate som maske, i rutenettet for kommunen */
export async function tolketBilde<E>(
  nr: string,
  b: ArrayBuffer[],
  tolk: (bilder: Piksler[], maske: Piksler) => { n: ArrayLike<number> } & E
): Promise<Kommuneruter<E>> {
  const g = await katalog.solv.grense(nr),
    R = rutenett(g.ext, ...BILDE_TEMA),
    P: Piksler[] = [];
  for (const x of b) P.push(await bildePiksler(x, R.w, R.h));
  return { ...R, ...tolk(P, flatePiksler(g.koord, R)), nr, skala: m2PerKm2(g.ext) };
}
