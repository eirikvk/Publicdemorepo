/* Sølv, det tunge bildearbeidet som oppgaver: å pakke ut og tolke kartbildene, tegne kommunens flate i bitene, telle verdiene i
   kommunen og regne arealet av verdsatt natur per verdikategori. Oppgavene kjøres i bakgrunnstråden (arbeider.ts), så siden ikke
   henger mens det regnes, eller på siden når nettleseren ikke har bakgrunnstråder med lerret (se arbeid i raster.ts). Svaret er det
   samme begge steder: det er de samme funksjonene, og bildene tegnes på samme måte. Filen kjenner ikke katalogen: alt den trenger,
   kommer med oppgaven. */
import { andelBuffere, dekningI, HEL, type Andel, type Nett, type Ringer } from '../generelt/dekning.ts';
import { motKlokka, omriss, overlapper, type Flerflate, type FlateMedUtsnitt } from '../generelt/geometri.ts';
import { BIT, biterI, bitRuter, m2PerKm2 } from './felles.ts';
import { detaljklasserIFlis, klasserIFlis } from './klasser.ts';
import { dekketM2, pakkUt, sti, type Flate } from './raster.ts';
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
    } /* de to bildene av grått areal i en bit: trinnet per rute, eller null */
  | { type: 'inon'; P: ArrayBuffer } /* bildet av inngrepsfri natur i en bit: sonen per rute, eller null */
  | { type: 'planlag'; P: ArrayBuffer } /* hele planlaget i en bit: 1 der ruta er tegnet */
  | { type: 'planflis'; P: ArrayBuffer } /* kommuneplanen i en flis: 1 der minst halve ruta er planlagt utbygging */
  | { type: 'klasser'; P: ArrayBuffer } /* grunnkartet i en blokk: dagens klasse per rute */
  | { type: 'detaljklasser'; P: ArrayBuffer } /* grunnkartet med 19 klasser i en blokk: detaljklassen per rute */
  | {
      type: 'andeler';
      lagene: Ringer[];
      maske: number[];
      kategorier: number[];
      nett: Nett[];
    } /* dekningsandelen per klasse i hvert rutenett, se dekningI i generelt/dekning.ts */
  | { type: 'telling'; V: Uint8Array; andel: Andel | null; tom: number } /* verdiene i en bit innenfor kommunen */
  | {
      type: 'klasseAreal';
      omrader: { koord: Flerflate; v: number }[];
      antall: number;
      kommune: FlateMedUtsnitt;
      innenfor?: Flerflate;
    }; /* arealet per verdikategori, se klasseAreal i temaer.ts */
export interface Utfort {
  svar: unknown;
  overfor: Transferable[];
}

/* Utfører oppgaven o. flate gir en tegneflate på w x h, som kan brukes fram til neste await. */
export async function utfor(o: Oppgave, flate: (w: number, h: number) => Flate): Promise<Utfort> {
  const ut = (v: Uint8Array | null): Utfort => ({ svar: v, overfor: v ? [v.buffer] : [] });
  switch (o.type) {
    case 'graa': {
      const P = await pakkUt(o.P, BIT, BIT, flate),
        V = await pakkUt(o.V, BIT, BIT, flate);
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
    case 'andeler': {
      const A = o.nett.map(R => dekningI(o.lagene, R, o.maske, o.kategorier));
      return { svar: A, overfor: A.flatMap(a => (a ? a.flatMap(andelBuffere) : [])) };
    }
    case 'telling': {
      const T = telling(o.V, o.andel, o.tom);
      return { svar: T, overfor: [T.hist.buffer] };
    }
    case 'klasseAreal':
      return { svar: klasseAreal(o.omrader, o.antall, o.kommune, flate, o.innenfor), overfor: [] };
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

/* Verdsatt natur: arealet per verdikategori i km², se klasseAreal i temaer.ts. Bit for bit, så lerretet aldri er større enn
   2048 x 2048. */
function klasseAreal(
  omrader: { koord: Flerflate; v: number }[],
  antall: number,
  kommune: FlateMedUtsnitt,
  flate: (w: number, h: number) => Flate,
  innenfor?: Flerflate
) {
  const skala = m2PerKm2(kommune.ext),
    kum = new Array<number>(antall).fill(0),
    ext = omrader.map(o => omriss(o.koord));
  if (!omrader.length) return { klasser: kum, sum: 0 };
  const g = flate(BIT, BIT);
  for (const tc of biterI(kommune.ext)) {
    const R = bitRuter(tc),
      u = R.u,
      res = R.res,
      her = omrader.filter((_, i) => overlapper(ext[i], u));
    if (!her.length) continue;
    let forrige = 0;
    for (let v = 0; v < antall; v++) {
      if (!her.some(o => o.v === v)) {
        kum[v] += forrige;
        continue;
      }
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, BIT, BIT);
      g.beginPath();
      for (const o of her) {
        if (o.v > v) continue;
        for (const flate of o.koord)
          flate.forEach((ring, nr) => {
            /* ytterkanter én vei og hull motsatt vei, så overlapp fylles og hull blir hull */
            const snu = motKlokka(ring) !== (nr === 0),
              n = ring.length;
            for (let i = 0; i < n; i++) {
              const q = ring[snu ? n - 1 - i : i],
                x = (q[0] - u[0]) / res,
                y = (u[3] - q[1]) / res;
              if (i) g.lineTo(x, y);
              else g.moveTo(x, y);
            }
            g.closePath();
          });
      }
      g.fill('nonzero');
      g.globalCompositeOperation = 'destination-in';
      sti(g, kommune.koord, u, 1 / res);
      g.fill('evenodd');
      if (innenfor) {
        sti(g, innenfor, u, 1 / res);
        g.fill('evenodd');
      }
      forrige = dekketM2(g.getImageData(0, 0, BIT, BIT).data, res) / skala;
      kum[v] += forrige;
    }
  }
  return {
    klasser: Array.from({ length: antall }, (_, v) => Math.max(0, kum[v] - (v ? kum[v - 1] : 0))),
    sum: kum[antall - 1]
  };
}
