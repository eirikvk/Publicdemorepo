/* Innholdet i en verdi fra cachen, vist etter formen det har, til katalogen i teknisk visning:
   - bilder fra kildene (PNG), og lerreter, som bilde
   - rutenett (et tall per rute, med bredde og høyde) som et bilde med én farge per verdi
   - lister der radene har de samme feltene, som tabell
   - flater (koordinater) som omriss
   - de enkle feltene i et svar, som felt og verdi
   Formen finnes ut fra dataene selv, uten oppsett per tabell. Store ting kortes ned: rutenettene skaleres ned, og tabellene viser de
   første radene. Det som vises, lages når en rad åpnes, og forsvinner når den lukkes. */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { kb, nf } from '../tekst.ts';

type Tall = ArrayLike<number>;
type Flerflate = number[][][][];
type Lerret = CanvasImageSource & { width: number; height: number };
export type Form =
  | { type: 'png'; sti: string; buf: ArrayBuffer }
  | { type: 'bilde'; sti: string; kilde: Lerret }
  | { type: 'rutenett'; sti: string; w: number; h: number; data: Tall }
  | { type: 'tabell'; sti: string; kolonner: string[]; rader: Record<string, unknown>[]; antall: number }
  | { type: 'flater'; sti: string; flater: { navn: string; koord: Flerflate }[]; antall: number }
  | { type: 'felt'; felt: [string, string][] };

const MAKS_FORMER = 8,
  MAKS_RADER = 50,
  MAKS_KOLONNER = 8,
  MAKS_FLATER = 300,
  MAKS_PUNKTER = 40000,
  BREDDE = 512; /* rutenett og lerreter vises med høyst så mange piksler i bredden */

const erObjekt = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && !ArrayBuffer.isView(x) && !(x instanceof ArrayBuffer);
const erPng = (x: unknown): x is ArrayBuffer =>
  x instanceof ArrayBuffer && x.byteLength > 24 && new DataView(x).getUint32(0) === 0x89504e47;
const erLerret = (x: unknown): x is Lerret =>
  (typeof HTMLCanvasElement !== 'undefined' && x instanceof HTMLCanvasElement) ||
  (typeof ImageBitmap !== 'undefined' && x instanceof ImageBitmap);
const erTall = (x: unknown): x is Tall & ArrayBufferView => ArrayBuffer.isView(x) && !(x instanceof DataView);
const erFlerflate = (x: unknown): x is Flerflate =>
  Array.isArray(x) &&
  Array.isArray(x[0]) &&
  Array.isArray(x[0][0]) &&
  Array.isArray(x[0][0][0]) &&
  typeof x[0][0][0][0] === 'number';
/* En flate i GeoJSON (Polygon eller MultiPolygon) som flerflate, eller null */
const geometri = (x: unknown): Flerflate | null =>
  erObjekt(x) && Array.isArray(x.coordinates)
    ? x.type === 'MultiPolygon'
      ? (x.coordinates as Flerflate)
      : x.type === 'Polygon'
        ? [x.coordinates as number[][][]]
        : null
    : null;
/* Flatene i en rad i en liste: koord eller flate (sølv), eller geometry (GeoJSON) */
const flaterI = (o: Record<string, unknown>): Flerflate | null =>
  erFlerflate(o.koord) ? o.koord : erFlerflate(o.flate) ? o.flate : geometri(o.geometry);
const enkel = (x: unknown) => x === null || ['string', 'number', 'boolean'].includes(typeof x);
const tekstAv = (x: unknown) =>
  typeof x === 'number'
    ? String(Number.isInteger(x) ? x : +x.toPrecision(6))
    : typeof x === 'string' && x.length > 60
      ? x.slice(0, 60) + '…'
      : String(x);
/* En rad i en tabell: egenskapene i GeoJSON, ellers raden selv */
const radAv = (o: Record<string, unknown>) => (erObjekt(o.properties) ? o.properties : o);
/* Navnet på en rad: et felt som heter navn eller name, ellers det første feltet med tekst som har «navn» i navnet */
const navnAv = (o: Record<string, unknown>) => {
  const r = radAv(o),
    n = r.navn ?? r.name ?? Object.entries(r).find(([k, v]) => /navn|name/i.test(k) && typeof v === 'string')?.[1];
  return typeof n === 'string' ? n : '';
};

/* Formene i verdien v, høyst MAKS_FORMER. Feltene øverst (og ett nivå ned) kommer først. */
export function finnFormer(v: unknown): Form[] {
  const ut: Form[] = [],
    felt: [string, string][] = [],
    sett = new Set<unknown>();
  const legg = (f: Form) => {
    if (ut.length < MAKS_FORMER) ut.push(f);
  };
  const gaa = (x: unknown, sti: string, dybde: number): void => {
    if (ut.length >= MAKS_FORMER || !x || typeof x !== 'object' || sett.has(x) || dybde > 4) return;
    sett.add(x);
    if (erPng(x)) return legg({ type: 'png', sti, buf: x });
    if (erLerret(x)) return legg({ type: 'bilde', sti, kilde: x });
    if (erTall(x)) {
      if (x.length === 262144) legg({ type: 'rutenett', sti, w: 512, h: 512, data: x }); /* én flis på nivå 9 */
      return;
    }
    if (x instanceof Map) {
      for (const [k, y] of x) gaa(y, `${sti}[${k}]`, dybde + 1);
      return;
    }
    if (x instanceof Set || x instanceof ArrayBuffer) return;
    if (Array.isArray(x)) {
      if (erFlerflate(x)) return legg({ type: 'flater', sti, flater: [{ navn: sti, koord: x }], antall: 1 });
      if (x.length && x.every(erObjekt)) {
        const fl = x
          .slice(0, MAKS_FLATER)
          .map(y => ({ navn: navnAv(y), koord: flaterI(y) }))
          .filter((y): y is { navn: string; koord: Flerflate } => !!y.koord);
        if (fl.length) legg({ type: 'flater', sti, flater: fl, antall: x.length });
        const rader = x.slice(0, MAKS_RADER).map(radAv),
          kolonner: string[] = [];
        for (const r of rader)
          for (const [k, y] of Object.entries(r))
            if (enkel(y) && !kolonner.includes(k) && kolonner.length < MAKS_KOLONNER) kolonner.push(k);
        if (kolonner.length) legg({ type: 'tabell', sti, kolonner, rader, antall: x.length });
        return;
      }
      x.slice(0, 4).forEach((y, i) => gaa(y, `${sti}[${i}]`, dybde + 1));
      return;
    }
    const o = x as Record<string, unknown>,
      g = geometri(o);
    if (g) return legg({ type: 'flater', sti, flater: [{ navn: sti, koord: g }], antall: 1 });
    const w = o.w,
      h = o.h,
      nett = typeof w === 'number' && typeof h === 'number';
    for (const [k, y] of Object.entries(o)) {
      const s = sti ? `${sti}.${k}` : k;
      if (nett && erTall(y) && y.length === (w as number) * (h as number))
        legg({ type: 'rutenett', sti: s, w: w as number, h: h as number, data: y });
      else if (dybde <= 1 && enkel(y)) felt.push([s, tekstAv(y)]);
      else if (dybde <= 1 && Array.isArray(y) && y.length && y.length <= 12 && y.every(z => typeof z === 'number'))
        felt.push([s, y.map(tekstAv).join(', ')]);
      else if ((k === 'koord' || k === 'flate') && erFlerflate(y))
        legg({ type: 'flater', sti: s, flater: [{ navn: navnAv(o) || s, koord: y }], antall: 1 });
      else gaa(y, s, dybde + 1);
    }
  };
  gaa(v, '', 0);
  return felt.length ? [{ type: 'felt', felt: felt.slice(0, 40) }, ...ut] : ut;
}

/* Fargene i rutenettene. Få verdier (høyst tre) får de tre første kategorifargene, som kan skilles fra hverandre også med nedsatt
   fargesyn. Fire til tolv verdier vises i én farge fra lys til mørk etter verdien, og man kan velge én verdi å se for seg. Flere
   verdier er mengder, som dekningen i en maske, og vises fra lys til mørk etter størrelsen. 0 er tomt. */
const KATEGORI = ['#2a78d6', '#eb6834', '#1baf7a'],
  SKALA = [
    '#9ec5f4',
    '#86b6ef',
    '#6da7ec',
    '#5598e7',
    '#3987e5',
    '#2a78d6',
    '#256abf',
    '#1c5cab',
    '#184f95',
    '#104281',
    '#0d366b'
  ],
  TOM = '#f0efec',
  DEMPET = '#d8d7d2';
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

function Rutenett({ f }: { f: Extract<Form, { type: 'rutenett' }> }) {
  const ref = useRef<HTMLCanvasElement>(null),
    [valgt, settValgt] = useState<number | null>(null),
    [her, settHer] = useState('');
  const { w, h, data } = f,
    s = Math.max(1, Math.ceil(w / BREDDE)),
    W = Math.ceil(w / s),
    H = Math.ceil(h / s);
  /* Antall ruter per verdi */
  const antall = useMemo(() => {
    const n = new Map<number, number>();
    for (let i = 0; i < data.length; i++) n.set(data[i], (n.get(data[i]) || 0) + 1);
    return [...n].sort((a, b) => a[0] - b[0]);
  }, [data]);
  const verdier = antall.map(([v]) => v).filter(v => v !== 0),
    maks = verdier.length ? verdier[verdier.length - 1] : 0,
    mengde = verdier.length > 12,
    kategori = !mengde && verdier.length <= 3;
  const farge = (v: number) => {
    if (v === 0) return TOM;
    if (valgt !== null) return v === valgt ? KATEGORI[0] : DEMPET;
    if (kategori) return KATEGORI[verdier.indexOf(v)];
    const t = mengde ? v / maks : verdier.length > 1 ? verdier.indexOf(v) / (verdier.length - 1) : 1;
    return SKALA[Math.round(t * (SKALA.length - 1))];
  };
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!,
      bilde = g.createImageData(W, H),
      p = bilde.data,
      oppslag = new Map<number, number[]>();
    for (const [v] of antall) oppslag.set(v, rgb(farge(v)));
    /* Hver piksel viser en blokk på s x s ruter: verdien i hjørnet, eller den første som ikke er 0, så små felt ikke forsvinner */
    const blokk = (x: number, y: number) => {
      const v = data[y * s * w + x * s];
      if (v || s === 1) return v;
      for (let j = y * s; j < Math.min(h, y * s + s); j++)
        for (let i = x * s; i < Math.min(w, x * s + s); i++) if (data[j * w + i]) return data[j * w + i];
      return 0;
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const q = 4 * (y * W + x),
          c3 = oppslag.get(blokk(x, y))!;
        p[q] = c3[0];
        p[q + 1] = c3[1];
        p[q + 2] = c3[2];
        p[q + 3] = 255;
      }
    g.putImageData(bilde, 0, 0);
  }, [data, valgt]);
  const vis = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = Math.min(w - 1, Math.floor(((e.clientX - r.left) / r.width) * w)),
      y = Math.min(h - 1, Math.floor(((e.clientY - r.top) / r.height) * h));
    settHer(`Rute ${nf(x, 0)}, ${nf(y, 0)}: ${data[y * w + x]}`);
  };
  return (
    <figure>
      <figcaption>
        <code>{f.sti || 'verdien'}</code>: rutenett på {nf(w, 0)} × {nf(h, 0)}
        {s > 1 ? `, vist med ${s} × ${s} ruter per piksel` : ''}
      </figcaption>
      <canvas
        ref={ref}
        width={W}
        height={H}
        role="img"
        aria-label={`Rutenettet ${f.sti}, ${verdier.length} verdier`}
        onPointerMove={vis}
        onPointerDown={vis}
      />
      <p className="her" role="status">
        {her || 'Pek eller trykk i bildet for å se verdien i ruta.'}
      </p>
      <ul className="forklaring">
        {antall.slice(0, 13).map(([v, n]) => {
          const valgbar = !mengde && !kategori && v !== 0;
          return (
            <li key={v}>
              <span className="rute" style={{ background: farge(v) }} />
              {valgbar ? (
                <button type="button" aria-pressed={valgt === v} onClick={() => settValgt(valgt === v ? null : v)}>
                  {v}
                </button>
              ) : (
                <span>{v}</span>
              )}
              : {nf(n, 0)} ruter
            </li>
          );
        })}
        {antall.length > 13 && <li>… {antall.length - 13} verdier til, fra lys til mørk</li>}
      </ul>
      {!mengde && !kategori && <p className="her">Trykk på en verdi for å se bare den.</p>}
    </figure>
  );
}

function Png({ f }: { f: Extract<Form, { type: 'png' }> }) {
  const [url, settUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([f.buf], { type: 'image/png' }));
    settUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [f.buf]);
  const d = new DataView(f.buf);
  return (
    <figure>
      <figcaption>
        <code>{f.sti || 'bildet'}</code>: PNG, {nf(d.getUint32(16), 0)} × {nf(d.getUint32(20), 0)} piksler,{' '}
        {kb(f.buf.byteLength)}, slik det kom fra kilden
      </figcaption>
      {url && <img src={url} alt={`Bildet ${f.sti}`} />}
    </figure>
  );
}

function Bilde({ f }: { f: Extract<Form, { type: 'bilde' }> }) {
  const ref = useRef<HTMLCanvasElement>(null),
    { width: w, height: h } = f.kilde,
    s = Math.max(1, w / BREDDE);
  useEffect(() => {
    const c = ref.current;
    if (c && w && h) c.getContext('2d')!.drawImage(f.kilde, 0, 0, c.width, c.height);
  }, [f.kilde]);
  return (
    <figure>
      <figcaption>
        <code>{f.sti || 'bildet'}</code>: bilde på {nf(w, 0)} × {nf(h, 0)} piksler
      </figcaption>
      {w > 0 && h > 0 ? (
        <canvas
          ref={ref}
          width={Math.round(w / s)}
          height={Math.round(h / s)}
          role="img"
          aria-label={`Bildet ${f.sti}`}
        />
      ) : (
        <p>Tomt.</p>
      )}
    </figure>
  );
}

function Flater({ f }: { f: Extract<Form, { type: 'flater' }> }) {
  const { stier, boks } = useMemo(() => {
    let punkter = 0;
    for (const x of f.flater) for (const flate of x.koord) for (const ring of flate) punkter += ring.length;
    const hopp = Math.max(1, Math.ceil(punkter / MAKS_PUNKTER)),
      b = [Infinity, Infinity, -Infinity, -Infinity];
    const stier = f.flater.map(x => ({
      navn: x.navn,
      d: x.koord
        .map(flate =>
          flate
            .map(
              ring =>
                ring
                  .filter((_, i) => i % hopp === 0)
                  .map(([px, py], i) => {
                    b[0] = Math.min(b[0], px);
                    b[1] = Math.min(b[1], py);
                    b[2] = Math.max(b[2], px);
                    b[3] = Math.max(b[3], py);
                    return `${i ? 'L' : 'M'}${Math.round(px)} ${Math.round(-py)}`;
                  })
                  .join('') + 'Z'
            )
            .join('')
        )
        .join('')
    }));
    return { stier, boks: b };
  }, [f]);
  const bw = Math.max(1, boks[2] - boks[0]),
    bh = Math.max(1, boks[3] - boks[1]);
  return (
    <figure>
      <figcaption>
        <code>{f.sti || 'flatene'}</code>: {f.antall === 1 ? 'én flate' : `${nf(f.antall, 0)} flater`}
        {f.antall > f.flater.length ? `, viser de ${nf(f.flater.length, 0)} første` : ''}. Pek på en flate for å se
        navnet.
      </figcaption>
      <svg viewBox={`${boks[0]} ${-boks[3]} ${bw} ${bh}`} role="img" aria-label={`Flatene i ${f.sti}`}>
        {stier.map((x, i) => (
          <path key={i} d={x.d} fillRule="evenodd">
            {x.navn && <title>{x.navn}</title>}
          </path>
        ))}
      </svg>
    </figure>
  );
}

function Tabell({ f }: { f: Extract<Form, { type: 'tabell' }> }) {
  return (
    <figure>
      <figcaption>
        <code>{f.sti || 'listen'}</code>: {nf(f.antall, 0)} rader
        {f.antall > f.rader.length ? `, viser de ${nf(f.rader.length, 0)} første` : ''}
      </figcaption>
      <div className="rullbar">
        <table className="talltabell">
          <thead>
            <tr>
              {f.kolonner.map(k => (
                <th key={k} scope="col">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.rader.map((r, i) => (
              <tr key={i}>
                {f.kolonner.map(k => (
                  <td key={k} className={typeof r[k] === 'number' ? 'tall' : undefined}>
                    {r[k] === undefined ? '' : tekstAv(r[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Felt({ f }: { f: Extract<Form, { type: 'felt' }> }) {
  return (
    <div className="rullbar">
      <table className="talltabell">
        <tbody>
          {f.felt.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">
                <code>{k}</code>
              </th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Alle formene i en verdi, etter hverandre */
export default function Datavisning({ former }: { former: Form[] }) {
  return (
    <div className="datavisning">
      {former.map((f, i) =>
        f.type === 'png' ? (
          <Png key={i} f={f} />
        ) : f.type === 'bilde' ? (
          <Bilde key={i} f={f} />
        ) : f.type === 'rutenett' ? (
          <Rutenett key={i} f={f} />
        ) : f.type === 'flater' ? (
          <Flater key={i} f={f} />
        ) : f.type === 'tabell' ? (
          <Tabell key={i} f={f} />
        ) : (
          <Felt key={i} f={f} />
        )
      )}
    </div>
  );
}
