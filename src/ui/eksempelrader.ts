/* Eksempelrader i katalogen: noen rader fra en verdi i cachen, som en tabell med kolonner og typer, slik Databricks viser
   eksempeldata. Hva én rad er, sier tabellen selv (radform i Tabelldef), så visningen ikke må gjette. Det er noen få former:
   - ruter: et rutenett med én eller flere verdier per rute (klassene, sonene, planen per rute). Én rad per rute der ikke alle
     verdiene er 0.
   - andeler: andelen av hver rute i en bit, pakket som spenn (kommunen i bitene, temaene per rute). Én rad per rute med en andel.
   - kommuner: én post per kommune, med kommunenummeret som nøkkel (de syntetiske tabellene fra SSB, flaten til kommunene).
   - jsonstat: en tabell fra SSB i JSON-stat, med dimensjonene og verdiene hver for seg. Én rad per verdi som ikke er tom.
   - { utvid, som }: en liste der hvert element har en liste inni (fylkene med kommunene). Én rad per element i den indre listen, med
     feltene til elementet over foran, som som.felt (fylke.navn).
   Uten radform er verdien en liste, et svar med en liste inni, eller ett svar. Da er radene listen, eller den lengste av listene som
   ikke er tomme, øverst i svaret, eller hele svaret som én rad. Svar med interne strukturer (oppslag, tallrekker, rutenett) har ingen
   rader: de er hurtigminne, og feltene vises som før.
   Radene som vises, er spredt jevnt over alle radene (alle når det er få), så de ikke bare viser starten på en sortert liste.
   Hodet (om) er feltene ved siden av radene, som står én gang. Rader som er ordbøker med ulike nøkler, får alle nøklene som kolonner:
   nøklene som identifiserer raden først, så de vanligste. Kolonnene og typene finnes av alle radene (høyst 10 000), med hvor mange
   rader som har verdi. Et felt inni et annet felt flates ut ett nivå (egenskaper.navn). Det som ligger dypere, lister og flater,
   vises kort i cellen, og hele raden kan foldes ut. Bilder og binære filer har ingen rader. Rene funksjoner, uten React. */
import { HEL, type Andel } from '../data/generelt/dekning.ts';
import type { Kolonneinfo, Radform, Tom } from '../data/cache.ts';

export type Kolonnetype = 'tall' | 'tekst' | 'ja/nei' | 'flate' | 'liste' | 'objekt' | 'tom' | 'blandet';
/* En kolonne: navnet, typen, hvor mange av radene som har en verdi i den (fylt av av), og hva den er, enheten og navnet på kodene,
   når det er kjent (fra tabellen, eller fra radformen) */
export interface Kolonne extends Kolonneinfo {
  navn: string;
  type: Kolonnetype;
  fylt: number;
  av: number;
}
/* Navnet på koden v i kolonnen k, eller tomt */
export const kodenavn = (k: Kolonneinfo, v: unknown) => (k.koder && enkel(v) ? k.koder[String(v)] || '' : '');
/* Eksempelradene i en verdi: hva én rad er (hva), kolonnene, radene som vises med alle feltene, hvor mange rader det er i alt (null
   når det ikke er kjent), plassen til hver rad som vises blant alle radene (fra 1), om radene som vises, er spredt over flere
   (spredt), hodet (om), nøkkelkolonnene som identifiserer en rad, og en merknad når verdien ikke passet radformen til tabellen */
export interface Eksempelrader {
  hva: string;
  kolonner: Kolonne[];
  rader: Record<string, unknown>[];
  antall: number | null;
  plass: number[];
  spredt: boolean;
  om: [string, string][];
  nokler: string[];
  merknad?: string;
  info?: Record<string, Kolonneinfo>;
}
export const MAKS_RADER = 20;
/* Høyst så mange rader brukes til å finne kolonnene og typene */
const MAKS_SKJEMA = 10000;
/* Ruter i en bit (2048 x 2048 på nivå 10, BIT i solv/felles.ts) */
const BIT = 2048;

const erObjekt = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
const erTall = (x: unknown): x is ArrayLike<number> & ArrayBufferView =>
  ArrayBuffer.isView(x) && !(x instanceof DataView);
const enkel = (x: unknown) => x === null || ['string', 'number', 'boolean'].includes(typeof x);
/* En intern struktur som ikke er rader: et oppslag, en mengde, en tallrekke eller binærdata */
const intern = (x: unknown) => x instanceof Map || x instanceof Set || erTall(x) || x instanceof ArrayBuffer;
/* Plassene i en liste med n elementer som vises: alle når de er få, ellers MAKS_RADER spredt jevnt, med den første */
export const plasser = (n: number) =>
  n <= MAKS_RADER
    ? Array.from({ length: n }, (_, i) => i)
    : Array.from({ length: MAKS_RADER }, (_, k) => Math.floor((k * n) / MAKS_RADER));

/* Antall punkter i en flate: lister i lister ned til tallpar (ring, flate eller flerflate), eller en geometri i GeoJSON. null når
   det ikke er en flate. Høyst seks nivåer, så lister i seg selv ikke går i ring. */
const punkterI = (x: unknown, dybde = 0): number | null => {
  if (dybde > 6) return null;
  if (erObjekt(x) && typeof x.type === 'string' && Array.isArray(x.coordinates))
    return punkterI(x.coordinates, dybde + 1);
  if (!Array.isArray(x) || !x.length || !Array.isArray(x[0])) return null;
  if (x[0].length === 2 && typeof x[0][0] === 'number') return x.length; /* en ring av punkter */
  let n = 0;
  for (const y of x) {
    const m = punkterI(y, dybde + 1);
    if (m === null) return null;
    n += m;
  }
  return n;
};
/* Tall på norsk: hele tall som de er, uten skille mellom tusener (de er ofte nummer, år og koordinater), og desimaltall med komma og
   høyst seks gjeldende sifre */
const DESIMAL = new Intl.NumberFormat('nb-NO', { maximumSignificantDigits: 6, useGrouping: false });
const tall = (v: number) => (Number.isInteger(v) ? String(v).replace('-', '−') : DESIMAL.format(v));
const flertall = (n: number, en: string, flere: string) => `${n} ${n === 1 ? en : flere}`;

/* En celle: teksten som vises, og typen. Lang tekst kortes ned, med mindre hele er sann. */
export function celle(v: unknown, hele = false): { tekst: string; type: Kolonnetype } {
  if (v === null || v === undefined) return { tekst: '', type: 'tom' };
  if (typeof v === 'number') return { tekst: tall(v), type: 'tall' };
  if (typeof v === 'string') return { tekst: !hele && v.length > 60 ? v.slice(0, 60) + '…' : v, type: 'tekst' };
  if (typeof v === 'boolean') return { tekst: v ? 'ja' : 'nei', type: 'ja/nei' };
  const p = punkterI(v);
  if (p !== null) return { tekst: `flate med ${flertall(p, 'punkt', 'punkter')}`, type: 'flate' };
  if (erTall(v)) return { tekst: `tallrekke med ${flertall(v.length, 'verdi', 'verdier')}`, type: 'liste' };
  if (v instanceof ArrayBuffer) return { tekst: `binærdata, ${v.byteLength} byte`, type: 'objekt' };
  if (Array.isArray(v))
    return v.length && v.length <= 6 && v.every(x => typeof x === 'number')
      ? { tekst: v.map(tall).join('; '), type: 'liste' }
      : { tekst: `liste med ${v.length}`, type: 'liste' };
  if (v instanceof Map) return { tekst: `oppslag med ${v.size}`, type: 'objekt' };
  if (v instanceof Set) return { tekst: `mengde med ${v.size}`, type: 'objekt' };
  if (typeof v === 'object') return { tekst: `objekt med ${Object.keys(v).length} felt`, type: 'objekt' };
  return { tekst: String(v), type: 'objekt' };
}

/* En rad som ordbok med feltene ett nivå ned flatet ut (egenskaper.navn), når de er høyst 30. En geometri flates ikke. En rad i
   GeoJSON (Feature) er id, egenskapene og geometrien. */
export function flat(o: Record<string, unknown>): Record<string, unknown> {
  if (o.type === 'Feature' && (erObjekt(o.properties) || o.geometry)) {
    const p = erObjekt(o.properties) ? o.properties : {};
    return { ...(o.id !== undefined ? { id: o.id } : {}), ...flat(p), geometry: o.geometry };
  }
  const ut: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    if (erObjekt(v) && punkterI(v) === null && Object.keys(v).length <= 30)
      for (const [k2, v2] of Object.entries(v)) ut[`${k}.${k2}`] = v2;
    else ut[k] = v;
  }
  return ut;
}

/* Kolonnene i radene R, med typen og hvor mange rader som har verdi. Nøkkelkolonnene (nokler) står først. Så de som flest rader har
   verdi i, og blant dem som er like vanlige, de enkle (tall, tekst og ja/nei) foran det som er kortet ned (flater, lister og
   objekter), og ellers i den rekkefølgen de kom. Nøkler som er koder med bare sifre, som økosystemtypene 01–12, også inni et felt
   som er flatet ut (tilBebygd.02), står etter de andre, sortert innenfor feltet. Er verdiene av ulik type (tomme ikke regnet med),
   er typen blandet. */
export function kolonnerI(R: Record<string, unknown>[], nokler: string[] = []): Kolonne[] {
  const n = new Map<string, number>(),
    forst = new Map<string, number>(),
    typer = new Map<string, Set<Kolonnetype>>();
  for (const r of R)
    for (const [k, v] of Object.entries(r)) {
      if (!forst.has(k)) {
        forst.set(k, forst.size);
        n.set(k, 0);
        typer.set(k, new Set());
      }
      const t = celle(v).type;
      if (t !== 'tom') {
        n.set(k, n.get(k)! + 1);
        typer.get(k)!.add(t);
      }
    }
  const nokkel = (k: string) => {
      const i = nokler.indexOf(k);
      return i < 0 ? nokler.length : i;
    },
    tung = (t: Kolonnetype) => (t === 'flate' || t === 'liste' || t === 'objekt' ? 1 : 0),
    info = new Map(
      [...forst.keys()].map(k => {
        const i = k.lastIndexOf('.'),
          T = typer.get(k)!,
          type: Kolonnetype = T.size === 0 ? 'tom' : T.size === 1 ? [...T][0] : 'blandet',
          siste = i < 0 ? k : k.slice(i + 1);
        return [k, { type, gruppe: i < 0 ? '' : k.slice(0, i), siste, kode: /^\d+$/.test(siste) }];
      })
    ),
    gruppe = new Map<string, number>();
  for (const k of forst.keys()) if (!gruppe.has(info.get(k)!.gruppe)) gruppe.set(info.get(k)!.gruppe, gruppe.size);
  return [...forst.keys()]
    .sort((a, b) => {
      const A = info.get(a)!,
        B = info.get(b)!;
      return (
        nokkel(a) - nokkel(b) ||
        n.get(b)! - n.get(a)! ||
        tung(A.type) - tung(B.type) ||
        Number(A.kode) - Number(B.kode) ||
        (A.kode && B.kode
          ? gruppe.get(A.gruppe)! - gruppe.get(B.gruppe)! || A.siste.localeCompare(B.siste, 'nb', { numeric: true })
          : forst.get(a)! - forst.get(b)!)
      );
    })
    .map(k => ({ navn: k, type: info.get(k)!.type, fylt: n.get(k)!, av: R.length }));
}
/* Hodet: de enkle feltene øverst i o som har verdi, utenom feltene med radene */
const hodet = (o: Record<string, unknown>, utenom: string[]): [string, string][] =>
  Object.entries(o)
    .filter(([k, v]) => !utenom.includes(k) && v !== null && v !== undefined && enkel(v))
    .map(([k, v]) => [k, celle(v, true).tekst]);
/* Eksempelradene av radene som vises, med plassen deres blant alle radene (plass, fra 0), og kolonnene funnet av skjema (alle radene,
   eller radene som vises) */
const ferdig = (
  hva: string,
  rader: Record<string, unknown>[],
  plass: number[],
  antall: number | null,
  om: [string, string][],
  nokler: string[],
  skjema: Record<string, unknown>[] = rader,
  info: Record<string, Kolonneinfo> = {}
): Eksempelrader => ({
  info,
  hva,
  kolonner: kolonnerI(skjema, nokler),
  rader,
  plass: plass.slice(0, rader.length).map(i => i + 1),
  antall,
  spredt: antall !== null && antall > rader.length,
  om,
  nokler
});

/* ruter: rutenettene i verdien (et rutenett, eller en liste av dem). Et rutenett har bredde og høyde (w, h) og en eller flere
   tallrekker med én verdi per rute. Ruta står med x og y i flisnettet når alle rutenettene har plasseringen (cx0, cy0), ellers i
   rutenettet. Ruter der alle verdiene er 0, er utelatt. To løp: først telles rutene med verdi, så hentes de som vises, spredt jevnt
   over dem. */
const KOLONNE_X_Y: Record<string, Kolonneinfo> = {
  x: { om: 'kolonnen i flisnettet på nivå 10, 10,6 meter per rute, mot øst' },
  y: { om: 'raden i flisnettet på nivå 10, 10,6 meter per rute, mot sør' }
};
function ruter(v: unknown, tom: Tom | null | undefined): Eksempelrader | null {
  const nett = (Array.isArray(v) ? v : [v]).filter(erObjekt);
  if (!nett.length || !nett.every(g => typeof g.w === 'number' && typeof g.h === 'number')) return null;
  /* verdien som betyr at ruta ikke har data: 0 når tabellen ikke sier noe */
  const t = tom ? tom.verdi : 0;
  const deler = nett.map((g, gi) => {
    const w = g.w as number,
      h = g.h as number,
      felt = Object.entries(g).filter(
        (e): e is [string, ArrayLike<number> & ArrayBufferView] => erTall(e[1]) && e[1].length === w * h
      ),
      F = felt.map(([, a]) => a);
    let n = 0;
    if (!F.length) n = 0;
    else if (tom === null) n = w * h;
    else if (F.length === 1) {
      const a = F[0];
      for (let q = 0; q < a.length; q++) if (a[q] !== t) n++;
    } else
      for (let q = 0; q < w * h; q++)
        for (let c = 0; c < F.length; c++)
          if (F[c][q] !== t) {
            n++;
            break;
          }
    return { g, gi, w, h, felt, F, n };
  });
  const antall = deler.reduce((s, d) => s + d.n, 0),
    global = nett.every(g => typeof g.cx0 === 'number' && typeof g.cy0 === 'number'),
    flere = nett.length > 1,
    rader: Record<string, unknown>[] = [],
    maal = plasser(antall);
  let neste = 0,
    nr = 0;
  for (const d of deler) {
    if (neste >= maal.length) break;
    if (nr + d.n <= maal[neste]) {
      nr += d.n;
      continue;
    }
    const x0 = global ? (d.g.cx0 as number) : 0,
      y0 = global ? (d.g.cy0 as number) : 0;
    for (let q = 0; q < d.w * d.h && neste < maal.length; q++) {
      let med = tom === null;
      for (let c = 0; c < d.F.length && !med; c++)
        if (d.F[c][q] !== t) {
          med = true;
          break;
        }
      if (!med) continue;
      if (nr === maal[neste]) {
        const r: Record<string, unknown> = flere ? { id: enkel(d.g.id) ? d.g.id : d.gi + 1 } : {};
        r.x = x0 + (q % d.w);
        r.y = y0 + Math.floor(q / d.w);
        for (const [k, a] of d.felt) r[k] = a[q];
        rader.push(r);
        neste++;
      }
      nr++;
    }
  }
  const om = flere ? [['rutenett', String(nett.length)] as [string, string]] : hodet(nett[0], []);
  const utelatt =
    tom === null
      ? 'Alle rutene er med.'
      : tom
        ? `Ruter med ${tom.verdi} i alle kolonnene (${tom.betyr}) er utelatt.`
        : 'Ruter der alle verdiene er 0, er utelatt.';
  return ferdig(
    `Én rad per rute. ${utelatt} ${global ? 'x og y er ruta i flisnettet, med 10,6 meter per rute på nivå 10.' : 'x og y er ruta i rutenettet.'}`,
    rader,
    maal,
    antall,
    om,
    flere ? ['id', 'x', 'y'] : ['x', 'y'],
    rader,
    global
      ? { ...KOLONNE_X_Y, id: { om: 'rutenettet ruta hører til' } }
      : {
          x: { om: 'kolonnen i rutenettet, mot høyre' },
          y: { om: 'raden i rutenettet, nedover' },
          id: { om: 'rutenettet ruta hører til' }
        }
  );
}

/* andeler: bitene med andelen per rute (Andelsbit i solv/kommune.ts), i en liste, eller i lister per kategori (biter, som i
   solv.vernAndel). Ruta står med x og y i flisnettet på nivå 10, som i rutenettene. En bit uten andel som er hel, er dekket i
   hver rute. Andelen står som 0–1. To løp: først telles rutene, så hentes de som vises, spredt jevnt over dem. */
interface Bit {
  tc: number[];
  hel: boolean;
  andel: Andel | null;
  faktor: number;
}
const erBit = (x: unknown): x is Bit => erObjekt(x) && Array.isArray(x.tc) && 'andel' in x;
function andeler(v: unknown): Eksempelrader | null {
  const o = erObjekt(v) ? v : null,
    lister: unknown[] | null = Array.isArray(v) ? [v] : o && Array.isArray(o.biter) ? (o.biter as unknown[]) : null;
  if (!lister || !lister.every(L => Array.isArray(L) && L.every(erBit))) return null;
  const kategorier = o !== null && Array.isArray(o.biter),
    biter = (lister as Bit[][]).flatMap((L, k) => L.map(b => ({ b, k }))),
    ruterI = (b: Bit) => (b.andel ? b.andel.n.reduce((s, x) => s + x, 0) : b.hel ? BIT * BIT : 0),
    antall = biter.reduce((s, { b }) => s + ruterI(b), 0),
    maal = plasser(antall),
    rader: Record<string, unknown>[] = [];
  let neste = 0,
    nr = 0;
  const legg = (k: number, b: Bit, x: number, y: number, a: number) =>
    rader.push({
      ...(kategorier ? { kategori: k } : {}),
      bit: b.tc.join('/'),
      x: b.tc[1] * BIT + x,
      y: b.tc[2] * BIT + y,
      andel: a,
      faktor: b.faktor
    });
  for (const { b, k } of biter) {
    const n = ruterI(b);
    if (neste >= maal.length) break;
    if (nr + n <= maal[neste]) {
      nr += n;
      continue;
    }
    const A = b.andel;
    if (A) {
      for (let y = 0; y < A.h && neste < maal.length; y++)
        for (let p = A.rad[y]; p < A.rad[y + 1] && neste < maal.length; p++) {
          while (neste < maal.length && maal[neste] < nr + A.n[p]) {
            legg(k, b, A.x[p] + (maal[neste] - nr), y, A.a[p] / HEL);
            neste++;
          }
          nr += A.n[p];
        }
    } else {
      while (neste < maal.length && maal[neste] < nr + n) {
        const i = maal[neste] - nr;
        legg(k, b, i % BIT, Math.floor(i / BIT), 1);
        neste++;
      }
      nr += n;
    }
  }
  return ferdig(
    'Én rad per rute med en andel: hvor stor del av ruta (0–1) som er med. x og y er ruta i flisnettet, med 10,6 meter per rute på nivå 10, og bit er biten den ligger i.' +
      (kategorier ? ' kategori er nummeret på kategorien i temaet, fra 0.' : ''),
    rader,
    maal,
    antall,
    o ? hodet(o, ['biter']) : [],
    kategorier ? ['kategori', 'x', 'y'] : ['x', 'y'],
    rader,
    {
      ...KOLONNE_X_Y,
      kategori: { om: 'kategorien i temaet, fra 0' },
      bit: { om: 'biten ruta ligger i: en flis på nivå 8 med 2048 × 2048 ruter, som z/x/y' },
      andel: { om: 'hvor stor del av ruta som er med', enhet: '0–1' },
      faktor: { om: 'målestokken i biten: arealet av en rute rettes med den' }
    }
  );
}

/* kommuner: én post per kommune, med kommunenummeret som nøkkel, i verdien selv eller i et felt i den. En post som er et tall, står i
   en kolonne med navnet på feltet (eller verdi). */
const erKommuner = (x: unknown): x is Record<string, unknown> =>
  erObjekt(x) && Object.keys(x).length > 0 && Object.keys(x).every(k => /^\d{4}$/.test(k));
function kommuner(v: unknown): Eksempelrader | null {
  if (!erObjekt(v)) return null;
  const felt = erKommuner(v) ? null : Object.keys(v).find(k => erKommuner(v[k]));
  if (felt === undefined) return null;
  const K = (felt === null ? v : v[felt]) as Record<string, unknown>,
    nr = Object.keys(K).sort(),
    rad = (n: string) => {
      const x = K[n];
      return { ...(erObjekt(x) ? flat(x) : { [felt || 'verdi']: x }), kommune: n };
    };
  return ferdig(
    'Én rad per kommune.',
    plasser(nr.length).map(i => rad(nr[i])),
    plasser(nr.length),
    nr.length,
    felt === null ? [] : hodet(v, [felt]),
    ['kommune'],
    nr.slice(0, MAKS_SKJEMA).map(rad),
    { kommune: { om: 'kommunenummeret' } }
  );
}

/* jsonstat: en tabell i JSON-stat 2.0 (class dataset): dimensjonene (id, size, dimension) og verdiene i én rekke, med den siste
   dimensjonen raskest. Én rad per verdi som ikke er tom, med koden og navnet for hver dimensjon. En dimensjon med bare én kategori
   står i hodet. */
type Dimensjon = { label?: string; category?: { index?: unknown; label?: Record<string, string> } };
function jsonstat(v: unknown): Eksempelrader | null {
  if (!erObjekt(v) || v.class !== 'dataset' || !Array.isArray(v.id) || !Array.isArray(v.size) || !erObjekt(v.dimension))
    return null;
  const id = v.id as string[],
    size = v.size as number[],
    dim = v.dimension as Record<string, Dimensjon | undefined>,
    kat = (d: string) => (dim[d] && dim[d]!.category) || {},
    koder = id.map(d => {
      const ix = kat(d).index;
      if (Array.isArray(ix)) return ix as string[];
      if (erObjekt(ix))
        return Object.entries(ix as Record<string, number>)
          .sort((a, b) => a[1] - b[1])
          .map(([k]) => k);
      return Object.keys(kat(d).label || {});
    }),
    navn = (d: number, p: number) => {
      const kode = koder[d][p] ?? String(p),
        lab = (kat(id[d]).label || {})[kode];
      return lab && lab !== kode ? `${kode} ${lab}` : kode;
    },
    verdier = v.value as unknown,
    total = size.reduce((a, b) => a * b, 1),
    verdi = (i: number) => (Array.isArray(verdier) ? verdier[i] : erObjekt(verdier) ? verdier[String(i)] : undefined),
    finnes = (x: unknown) => x !== null && x !== undefined,
    en = id.map((_, d) => size[d] === 1);
  /* plassen til hver verdi som ikke er tom: alle i en rekke, eller nøklene i et objekt */
  const fylt: number[] = [];
  if (Array.isArray(verdier)) verdier.forEach((x, i) => finnes(x) && fylt.push(i));
  else if (erObjekt(verdier)) for (const [k, x] of Object.entries(verdier)) if (finnes(x)) fylt.push(Number(k));
  fylt.sort((a, b) => a - b);
  const rader = plasser(fylt.length).map(j => {
    const i = fylt[j],
      r: Record<string, unknown> = {},
      p = new Array<number>(id.length);
    let rest = i;
    for (let d = id.length - 1; d >= 0; d--) {
      p[d] = rest % size[d];
      rest = Math.floor(rest / size[d]);
    }
    id.forEach((d, k) => {
      if (!en[k]) r[d] = navn(k, p[k]);
    });
    r.verdi = verdi(i);
    return r;
  });
  return ferdig(
    'Én rad per verdi i tabellen som ikke er tom, med koden og navnet for hver dimensjon.' +
      (total > fylt.length ? ` ${total - fylt.length} tomme verdier er utelatt.` : ''),
    rader,
    plasser(fylt.length),
    fylt.length,
    [
      ...hodet(v, ['id', 'size', 'value', 'version', 'class']),
      ...id.flatMap((d, k): [string, string][] => (en[k] ? [[d, navn(k, 0)]] : []))
    ],
    id.filter((_, k) => !en[k]),
    rader,
    {
      ...Object.fromEntries(id.map(d => [d, { om: dim[d] && dim[d]!.label ? dim[d]!.label : undefined }])),
      verdi: { om: 'verdien', enhet: enhetI(dim) }
    }
  );
}
/* Enheten for verdiene i JSON-stat: enheten til innholdet (category.unit) når tabellen har bare ett slags innhold */
function enhetI(dim: Record<string, Dimensjon | undefined>): string | undefined {
  for (const d of Object.values(dim)) {
    const u = d && d.category && (d.category as { unit?: Record<string, { base?: string }> }).unit;
    if (u && Object.keys(u).length === 1) return Object.values(u)[0].base;
  }
  return undefined;
}

/* Uten radform: en liste av ordbøker er radene. Et svar med lister av ordbøker øverst har den lengste som ikke er tom, som radene, og
   feltene ved siden av som hodet (en samling i GeoJSON har trekkene som rader). En liste av korte lister gir én kolonne per plass.
   Ellers er hele svaret én rad, men ikke svar med interne strukturer (oppslag, tallrekker og objekter med det inni), som har ingen
   rader. */
const NOKLER = ['kommune', 'nr', 'id', 'kode', 'navn'];
const somRad = (x: unknown): Record<string, unknown> =>
  erObjekt(x)
    ? flat(x)
    : Array.isArray(x) && x.length <= 12
      ? Object.fromEntries(x.map((y, i) => [`[${i}]`, y]))
      : { verdi: x };
function fraListe(L: unknown[], hva: string, om: [string, string][], utvid?: { utvid: string; som: string }) {
  let alle: Record<string, unknown>[];
  if (utvid) {
    alle = [];
    for (const x of L) {
      if (!erObjekt(x) || !Array.isArray(x[utvid.utvid])) continue;
      const over = Object.fromEntries(
        Object.entries(x)
          .filter(([k, y]) => k !== utvid.utvid && enkel(y))
          .map(([k, y]) => [`${utvid.som}.${k}`, y])
      );
      for (const y of x[utvid.utvid] as unknown[]) alle.push({ ...over, ...somRad(y) });
    }
  } else alle = L.slice(0, MAKS_SKJEMA).map(somRad);
  const n = utvid ? alle.length : L.length,
    rader = plasser(n).map(i => (utvid ? alle[i] : somRad(L[i]))),
    nokler = [
      ...(utvid ? Object.keys(alle[0] || {}).filter(k => k.startsWith(utvid.som + '.')) : []),
      ...NOKLER.filter(k => alle.some(r => k in r))
    ];
  return ferdig(hva, rader, plasser(n), n, om, nokler, alle.slice(0, MAKS_SKJEMA));
}
function liste(v: unknown): Eksempelrader | null {
  if (v === null || v === undefined || enkel(v) || intern(v)) return null;
  if (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) return null;
  if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return null;
  if (Array.isArray(v)) return punkterI(v) === null ? fraListe(v, 'Én rad per element i listen.', []) : null;
  if (!erObjekt(v)) return null;
  const lister = Object.entries(v).filter(
    (e): e is [string, unknown[]] => Array.isArray(e[1]) && e[1].length > 0 && e[1].every(erObjekt)
  );
  if (lister.length) {
    const [k, L] = lister.reduce((a, b) => (b[1].length > a[1].length ? b : a)),
      andre = lister.filter(([n]) => n !== k).map(([n, M]) => `«${n}» (${M.length})`);
    return fraListe(
      L,
      `Én rad per element i «${k}».` +
        (andre.length ? ` Verdien har også ${andre.join(', ')}, som ikke vises her.` : ''),
      hodet(v, [k])
    );
  }
  /* ett svar: ikke når det har interne strukturer, eller et felt inni med det eller med objekter */
  const komplisert = Object.values(v).some(
    x => intern(x) || (erObjekt(x) && Object.values(x).some(y => intern(y) || erObjekt(y)))
  );
  if (komplisert) return null;
  return ferdig('Svaret har ingen liste, så alle feltene står i én rad.', [flat(v)], [0], 1, [], []);
}

/* Hva tabellen sier om kolonnene og om ruter uten data (kolonner og tom i Tabelldef) */
export interface Valg {
  kolonner?: Record<string, Kolonneinfo> | null;
  tom?: Tom | null;
}
const FORMER: Record<string, (v: unknown, valg: Valg) => Eksempelrader | null> = {
  ruter: (v, valg) => ruter(v, valg.tom),
  andeler,
  kommuner,
  jsonstat
};
/* Eksempelradene i verdien v, med radformen til tabellen (form), eller som liste eller svar uten. null når verdien ikke har rader,
   som et bilde. Passer ikke verdien til radformen, brukes listen, med en merknad. Kolonnene får det tabellen sier om dem (valg),
   ellers det radformen vet. */
export function eksempelrader(v: unknown, form: Radform | null, valg: Valg = {}): Eksempelrader | null {
  const E = finn(v, form, valg);
  if (!E) return null;
  const info = { ...E.info, ...(valg.kolonner || {}) };
  return { ...E, kolonner: E.kolonner.map(k => ({ ...k, ...(info[k.navn] || {}) })) };
}
function finn(v: unknown, form: Radform | null, valg: Valg): Eksempelrader | null {
  if (!form) return liste(v);
  if (typeof form === 'object') {
    if (Array.isArray(v) && v.some(x => erObjekt(x) && Array.isArray(x[form.utvid])))
      return fraListe(v, `Én rad per element i «${form.utvid}», med feltene for ${form.som} foran.`, [], form);
  } else {
    const E = FORMER[form](v, valg);
    if (E) return E;
  }
  const L = liste(v);
  return L && { ...L, merknad: 'Verdien passet ikke radformen til tabellen, så den vises som liste.' };
}
