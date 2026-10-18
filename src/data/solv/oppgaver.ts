/* Sølv, det tunge bildearbeidet som oppgaver: å pakke ut og tolke kartbildene, tegne kommunens flate i bitene, telle verdiene i
   kommunen og regne arealet av verdsatt natur per verdikategori. Oppgavene kjøres i bakgrunnstråden (arbeider.ts), så siden ikke
   henger mens det regnes, eller på siden når nettleseren ikke har bakgrunnstråder med lerret (se arbeid i raster.ts). Svaret er det
   samme begge steder: det er de samme funksjonene, og bildene tegnes på samme måte. Filen kjenner ikke katalogen: alt den trenger,
   kommer med oppgaven. */
import { motKlokka, omriss, overlapper, type Flerflate, type FlateMedUtsnitt } from '../generelt/geometri.ts';
import { BIT, HALV, biterI, bitRuter, m2PerKm2, type Flis } from './felles.ts';
import { detaljklasserIFlis, klasserIFlis } from './klasser.ts';
import { dekketM2, flatePikslerI, pakkUt, sti, type Flate } from './raster.ts';
import { ellerTom, planIFlis, planlagPerRute, tolkGraa, tolkInon, UTENFOR } from './tolking.ts';

/* Kommunens flate i en bit (se Kommunebit i kommune.ts): antall ruter i kommunen, hel når hele biten er i kommunen, ellers én bit
   per rute */
export interface Kommunebit {
  tc: Flis;
  antall: number;
  hel: boolean;
  ruter: Uint8Array | null;
}
/* Telling av verdiene i en bit innenfor kommunen: antall ruter per verdi fra 0 til 255, og den midterste ruta som ikke er tom (-1 når
   alle er tomme) */
export interface Telling {
  hist: Int32Array;
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
  | { type: 'kommunebiter'; koord: Flerflate; biter: Flis[] } /* kommunens flate i bitene den berører */
  | { type: 'telling'; V: Uint8Array; ruter: Uint8Array | null; tom: number } /* verdiene i en bit innenfor kommunen */
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
    case 'kommunebiter': {
      const B = kommunebiter(o.koord, o.biter, flate);
      return { svar: B, overfor: B.flatMap(b => (b.ruter ? [b.ruter.buffer] : [])) };
    }
    case 'telling': {
      const T = telling(o.V, o.ruter, o.tom);
      return { svar: T, overfor: [T.hist.buffer] };
    }
    case 'klasseAreal':
      return { svar: klasseAreal(o.omrader, o.antall, o.kommune, flate, o.innenfor), overfor: [] };
  }
}

/* Kommunens flate (koord) i bitene: først et grovt bilde (64 x 64) for å se om kommunen berører biten, så flaten tegnes bare i
   bitene den berører. En rute er i kommunen etter halvregelen. Bitene uten ruter i kommunen er ikke med. */
function kommunebiter(koord: Flerflate, biter: Flis[], flate: (w: number, h: number) => Flate): Kommunebit[] {
  const ut: Kommunebit[] = [];
  for (const tc of biter) {
    const R = bitRuter(tc),
      grov = flatePikslerI(flate(64, 64), koord, { u: R.u, res: R.res * (R.w / 64), w: 64, h: 64 });
    let berort = false;
    for (let i = 3; i < grov.length && !berort; i += 4) berort = grov[i] > 0;
    if (!berort) continue;
    const M = flatePikslerI(flate(BIT, BIT), koord, R),
      ruter = new Uint8Array((BIT * BIT) >> 3);
    let antall = 0;
    for (let q = 0; q < BIT * BIT; q++)
      if (M[4 * q + 3] >= HALV) {
        antall++;
        ruter[q >> 3] |= 1 << (q & 7);
      }
    if (!antall) continue;
    const hel = antall === BIT * BIT;
    ut.push({ tc, antall, hel, ruter: hel ? null : ruter });
  }
  return ut;
}

/* Verdiene V i en bit innenfor kommunen (ruter, én bit per rute, eller null når hele biten er i kommunen): antall ruter per verdi,
   og den midterste ruta med en verdi som ikke er tom */
function telling(V: Uint8Array, ruter: Uint8Array | null, tom: number): Telling {
  const hist = new Int32Array(256);
  if (!ruter) for (let q = 0; q < V.length; q++) hist[V[q]]++;
  else for (let q = 0; q < V.length; q++) if ((ruter[q >> 3] >> (q & 7)) & 1) hist[V[q]]++;
  const noe = hist.reduce((a, x) => a + x, 0) - hist[tom];
  let midt = -1;
  if (noe > 0)
    for (let q = 0, k = 0; q < V.length; q++)
      if (V[q] !== tom && (!ruter || (ruter[q >> 3] >> (q & 7)) & 1) && k++ === noe >> 1) {
        midt = q;
        break;
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
