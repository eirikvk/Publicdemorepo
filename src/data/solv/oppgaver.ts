/* Sølv, det tunge bildearbeidet som oppgaver: å pakke ut og tolke kartbildene, regne dekningsandelen til flater per rute (kommunen
   og naturtemaene, generelt/dekning.ts) og telle verdiene i kommunen. Oppgavene kjøres i bakgrunnstråden (arbeider.ts), så siden ikke
   henger mens det regnes, eller på siden når nettleseren ikke har bakgrunnstråder med lerret (se arbeid i raster.ts). Svaret er det
   samme begge steder: det er de samme funksjonene. Filen kjenner ikke katalogen: alt den trenger, kommer med oppgaven. */
import { andelBuffere, dekningI, HEL, type Andel, type Nett, type Ringer } from '../generelt/dekning.ts';
import { BIT } from './felles.ts';
import { detaljfilIFlis, detaljklasserIFlis, klasserIFlis } from './klasser.ts';
import { pakkUt, type Flate } from './raster.ts';
import { ellerTom, planIFlis, planlagPerRute, tolkGraa, tolkInon, UTENFOR } from './tolking.ts';

/* Telling av verdiene i en bit innenfor kommunen: andelen ruter per verdi fra 0 til 255 (en kantrute teller med den delen av den som
   er i kommunen), og den midterste ruta i kommunen som ikke er tom (-1 når alle er tomme) */
export interface Telling {
  hist: Float64Array;
  midt: number;
}

export type Oppgave =
  | {
      type: 'graa';
      P: ArrayBuffer;
      V: ArrayBuffer;
      side?: number;
    } /* de to bildene av grått areal i en bit (side BIT, som er standard) eller en flis (side 512): trinnet per rute, eller null */
  | { type: 'inon'; P: ArrayBuffer } /* bildet av inngrepsfri natur i en bit: sonen per rute, eller null */
  | { type: 'planlag'; P: ArrayBuffer } /* hele planlaget i en bit: 1 der ruta er tegnet */
  | { type: 'planflis'; P: ArrayBuffer } /* kommuneplanen i en flis: 1 der minst halve ruta er planlagt utbygging */
  | { type: 'klasser'; P: ArrayBuffer } /* grunnkartet i en blokk: dagens klasse per rute */
  | { type: 'detaljklasser'; P: ArrayBuffer } /* grunnkartet med 19 klasser i en blokk: detaljklassen per rute */
  | { type: 'detaljfil'; P: ArrayBuffer } /* de lagrede detaljklassene i en blokk, med eksakte farger */
  | {
      type: 'andeler';
      lagene: Ringer[];
      maske: number[];
      kategorier: number[];
      nett: Nett[];
    } /* dekningsandelen per klasse i hvert rutenett, se dekningI i generelt/dekning.ts */
  | { type: 'telling'; V: Uint8Array; andel: Andel | null; tom: number }; /* verdiene i en bit innenfor kommunen */
export interface Utfort {
  svar: unknown;
  overfor: Transferable[];
}

/* Utfører oppgaven o. flate gir en tegneflate på w x h, som kan brukes fram til neste await. */
export async function utfor(o: Oppgave, flate: (w: number, h: number) => Flate): Promise<Utfort> {
  const ut = (v: Uint8Array | null): Utfort => ({ svar: v, overfor: v ? [v.buffer] : [] });
  switch (o.type) {
    case 'graa': {
      const s = o.side || BIT,
        P = await pakkUt(o.P, s, s, flate),
        V = await pakkUt(o.V, s, s, flate);
      return ut(ellerTom(tolkGraa(P, V), 0));
    }
    case 'inon':
      return ut(ellerTom(tolkInon(await pakkUt(o.P, BIT, BIT, flate)), UTENFOR));
    case 'planlag':
      return ut(planlagPerRute(await pakkUt(o.P, BIT, BIT, flate)));
    case 'planflis':
      return ut(planIFlis(await pakkUt(o.P, 512, 512, flate)));
    case 'klasser':
      return ut(klasserIFlis(await pakkUt(o.P, 512, 512, flate)));
    case 'detaljklasser':
      return ut(detaljklasserIFlis(await pakkUt(o.P, 512, 512, flate)));
    case 'detaljfil':
      return ut(detaljfilIFlis(await pakkUt(o.P, 512, 512, flate)));
    case 'andeler': {
      const A = o.nett.map(R => dekningI(o.lagene, R, o.maske, o.kategorier));
      return { svar: A, overfor: A.flatMap(a => (a ? a.flatMap(andelBuffere) : [])) };
    }
    case 'telling': {
      const T = telling(o.V, o.andel, o.tom);
      return { svar: T, overfor: [T.hist.buffer] };
    }
  }
}

/* Verdiene V i en bit innenfor kommunen: andelen ruter per verdi, og den midterste ruta med en verdi som ikke er tom. A er kommunens
   andel i biten, eller null når hele biten er i kommunen. */
function telling(V: Uint8Array, A: Andel | null, tom: number): Telling {
  const hist = new Float64Array(256);
  let noe = 0;
  if (!A)
    for (let q = 0; q < V.length; q++) {
      hist[V[q]]++;
      if (V[q] !== tom) noe++;
    }
  else
    for (let y = 0; y < A.h; y++)
      for (let p = A.rad[y]; p < A.rad[y + 1]; p++) {
        const a = A.a[p] / HEL;
        for (let q = y * A.w + A.x[p], s = q + A.n[p]; q < s; q++) {
          hist[V[q]] += a;
          if (V[q] !== tom) noe++;
        }
      }
  let midt = -1;
  if (noe > 0) {
    let k = 0;
    const finn = (q: number) => V[q] !== tom && k++ === noe >> 1;
    if (!A) {
      for (let q = 0; q < V.length && midt < 0; q++) if (finn(q)) midt = q;
    } else
      for (let y = 0; y < A.h && midt < 0; y++)
        for (let p = A.rad[y]; p < A.rad[y + 1] && midt < 0; p++)
          for (let q = y * A.w + A.x[p], s = q + A.n[p]; q < s; q++)
            if (finn(q)) {
              midt = q;
              break;
            }
  }
  return { hist, midt };
}
