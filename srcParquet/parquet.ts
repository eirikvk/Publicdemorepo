/* Spørring i en GeoParquet-fil på nettet, uten å laste ned hele filen. Filen er verneområdene i Norge fra Miljødirektoratet
   (rundt 33 MB, nesten alt er flatene), lagt i en offentlig bøtte på Hugging Face (eirikvk/naturdata). Den er skrevet for slike
   spørringer: sortert etter kommune, med små sider og sideindeks (README og skriptet ligger i bøtta). En Parquet-fil har
   beskrivelsen av innholdet sist i filen, og hver kolonne for seg, så nettleseren kan be om bare de bitene den trenger med Range i
   HTTP. Spørringen går i tre steg:
   1. Beskrivelsen av filen og sideindeksen, i ett kall (de siste 64 kB), og kommunekolonnen for alle radene. Én gang mens siden
      er åpen.
   2. Radene i kommunen: tekstkolonnene for bare de radene. Sideindeksen sier hvilke sider radene ligger i.
   3. Flatene for de samme radene, når man ber om dem. De ligger stort sett etter hverandre, fordi filen er sortert etter kommune.
   Hugging Face sender videre til en adresse i sitt CDN som gjelder i en time. Siden bruker den adressen direkte etter første
   kall, så hvert kall går rett til CDN-et. Svarer den ikke, brukes den faste adressen igjen.
   Tjenesten må svare med bare biten det spørres om (206 Partial Content). Svarer den med hele filen (200), stoppes hentingen, så
   siden aldri laster ned alt. Nettleseren kan bare lese filen når tjenesten tillater det for siden (CORS). Det som er hentet,
   huskes så lenge siden er åpen. Ingenting lagres i nettleseren. Lesingen gjøres av hyparquet. */
import { parquetMetadataAsync, parquetReadObjects, type AsyncBuffer, type FileMetaData } from 'hyparquet';

export const FIL =
  'https://huggingface.co/buckets/eirikvk/naturdata/resolve/miljodirektoratet/naturvernomrader.parquet';
/* Siden om bøtta, med README og skriptet som skrev filen */
export const BOTTA = 'https://huggingface.co/buckets/eirikvk/naturdata';
/* Tekstkolonnene spørringen leser for radene i kommunen, i tillegg til kommune */
export const TEKST = ['navn', 'verneform', 'vernedato', 'faktaark'];

/* Ett verneområde: radnummeret i filen, navnet, verneformen, vernedatoen (ååååmmdd), kommunene (nummer med komma mellom) og
   lenken til faktaarket */
export interface Verneomrade {
  rad: number;
  navn: string;
  verneform: string;
  vernedato: string;
  kommune: string;
  faktaark: string;
}
/* En flate: koordinatene i UTM 33 (EPSG:25833), som i GeoJSON */
export interface Flate {
  rad: number;
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}
/* Hvor mye som er hentet: antall kall og byte, og om filen ble åpnet da (beskrivelsen, sideindeksen og kommunekolonnen) */
export interface Hentet {
  kall: number;
  byte: number;
  apnet?: boolean;
}
/* Feilene siden forklarer: nettleseren fikk ikke lese filen (CORS), eller tjenesten ga hele filen i stedet for en bit */
export type Feil = 'cors' | 'helefilen' | 'annet';
export class Sporrefeil extends Error {
  hva: Feil;
  constructor(hva: Feil, melding: string) {
    super(melding);
    this.hva = hva;
  }
}

/* Adressen bitene hentes fra: den faste, eller CDN-adressen den sendte videre til */
let adresse = FIL;
/* Henter fra adressen, og gjør en feil i nettverket (som når CORS mangler) om til en forklarbar feil */
async function hent(fra: string, init: RequestInit, signal?: AbortSignal) {
  try {
    return await fetch(fra, { ...init, signal });
  } catch (e) {
    if (signal && signal.aborted) throw e;
    throw new Sporrefeil('cors', e instanceof Error ? e.message : String(e));
  }
}
/* Én bit, bytes a til b. Svarer CDN-adressen ikke med en bit (den kan ha gått ut), prøves den faste adressen. */
async function bit(a: number, b: number): Promise<ArrayBuffer> {
  const fra = adresse,
    stopp = new AbortController();
  let svar: Response;
  try {
    svar = await hent(fra, { headers: { Range: `bytes=${a}-${b - 1}` } }, stopp.signal);
  } catch (e) {
    if (fra === FIL) throw e;
    adresse = FIL;
    return bit(a, b);
  }
  if (svar.status !== 206) {
    stopp.abort();
    if (fra !== FIL && svar.status !== 200) {
      adresse = FIL;
      return bit(a, b);
    }
    throw new Sporrefeil(
      svar.status === 200 ? 'helefilen' : 'annet',
      `Tjenesten svarte ${svar.status} i stedet for 206 på en bit av filen`
    );
  }
  if (svar.url && svar.url !== fra) adresse = svar.url;
  return svar.arrayBuffer();
}
/* Bitene som er hentet: [fra, til, innholdet]. En bit som ligger inni en som er hentet før, tas derfra. */
const minne: [number, number, Promise<ArrayBuffer>][] = [];
/* Filen som biter, der hvert kall telles i H og i det som er hentet til sammen. Hver bit hentes med Range (bytes=a-b, aldri
   «de siste n», som ikke alle tjenester støtter). */
function biter(lengde: number, H: Hentet): AsyncBuffer {
  return {
    byteLength: lengde,
    slice(a: number, b = lengde) {
      const m = minne.find(([x, y]) => x <= a && b <= y);
      if (m) return m[2].then(buf => buf.slice(a - m[0], b - m[0]));
      const p = bit(a, b).then(buf => {
        H.kall++;
        H.byte += buf.byteLength;
        hentet.kall++;
        hentet.byte += buf.byteLength;
        return buf;
      });
      const rad: [number, number, Promise<ArrayBuffer>] = [a, b, p];
      minne.push(rad);
      p.catch(() => minne.splice(minne.indexOf(rad), 1));
      return p;
    }
  };
}
/* Sideindeksen for alle kolonnene ligger rett foran beskrivelsen. Den hentes i samme kall som beskrivelsen (de siste 64 kB), og
   ellers i ett kall for seg, så oppslagene i den aldri blir egne kall. */
async function sideindeksen(file: AsyncBuffer, metadata: FileMetaData) {
  let a = Infinity,
    b = 0;
  for (const g of metadata.row_groups)
    for (const c of g.columns)
      for (const [o, n] of [
        [c.column_index_offset, c.column_index_length],
        [c.offset_index_offset, c.offset_index_length]
      ])
        if (o !== undefined && n) {
          a = Math.min(a, Number(o));
          b = Math.max(b, Number(o) + Number(n));
        }
  if (b > a) await file.slice(a, b);
}

/* Det som er hentet til sammen mens siden er åpen, og størrelsen på filen */
export const hentet = { kall: 0, byte: 0, fil: 0 };
/* Filen åpnet: lengden, beskrivelsen og kommunekolonnen for alle radene. Hentes én gang. */
interface Apnet {
  lengde: number;
  metadata: FileMetaData;
  kommune: string[];
}
let apnet: Promise<Apnet> | null = null;
function apne(H: Hentet): Promise<Apnet> {
  if (!apnet) {
    H.apnet = true;
    apnet = (async () => {
      const hode = await hent(FIL, { method: 'HEAD' });
      H.kall++;
      hentet.kall++;
      const lengde = Number(hode.headers.get('content-length'));
      if (!hode.ok || !lengde) throw new Sporrefeil('annet', `Fant ikke størrelsen på filen (${hode.status})`);
      if (hode.url && hode.url !== FIL) adresse = hode.url;
      hentet.fil = lengde;
      const file = biter(lengde, H),
        metadata = await parquetMetadataAsync(file, { initialFetchSize: 1 << 16 });
      await sideindeksen(file, metadata);
      const R = await parquetReadObjects({ file, metadata, columns: ['kommune'] });
      return { lengde, metadata, kommune: R.map(r => String(r.kommune || '')) };
    })().catch(e => {
      apnet = null; /* neste forsøk prøver på nytt */
      throw e;
    });
  }
  return apnet;
}
/* Radene (i stigende rekkefølge) som sammenhengende biter [fra, til) */
function sammenhengende(rader: number[]): [number, number][] {
  const B: [number, number][] = [];
  for (const i of rader) {
    const s = B[B.length - 1];
    if (s && s[1] === i) s[1]++;
    else B.push([i, i + 1]);
  }
  return B;
}
/* Kolonnene C for radene, bit for bit, med sideindeksen så bare sidene med radene hentes */
async function les(f: Apnet, H: Hentet, rader: number[], C: string[]): Promise<Record<string, unknown>[]> {
  const file = biter(f.lengde, H);
  const B = sammenhengende(rader),
    deler = await Promise.all(
      B.map(([a, b]) =>
        parquetReadObjects({ file, metadata: f.metadata, columns: C, rowStart: a, rowEnd: b, useOffsetIndex: true })
      )
    );
  return deler.flatMap((D, j) => D.map((r, i) => ({ ...(r as Record<string, unknown>), rad: B[j][0] + i })));
}

/* Svaret for en kommune: verneområdene og hva det kostet å hente dem (med det første kallet som åpner filen, når det skjer nå) */
export interface Svar<T> {
  R: T;
  hentet: Hentet;
}
const kommuner = new Map<string, Promise<Svar<Verneomrade[]>>>();
/* Verneområdene som ligger helt eller delvis i kommunen nr, etter navnet */
export function iKommunen(nr: string): Promise<Svar<Verneomrade[]>> {
  let s = kommuner.get(nr);
  if (!s) {
    s = (async () => {
      const H = { kall: 0, byte: 0 },
        f = await apne(H),
        rader = f.kommune.flatMap((k, i) => (k.split(',').includes(nr) ? [i] : []));
      const R = (await les(f, H, rader, TEKST)).map(
        r => ({ ...r, kommune: f.kommune[r.rad as number] }) as Verneomrade
      );
      return { R: R.sort((a, b) => a.navn.localeCompare(b.navn, 'nb')), hentet: H };
    })();
    s.catch(() => kommuner.delete(nr));
    kommuner.set(nr, s);
  }
  return s;
}
const flater = new Map<string, Promise<Svar<Flate[]>>>();
/* Flatene for verneområdene i kommunen nr */
export function flateneI(nr: string): Promise<Svar<Flate[]>> {
  let s = flater.get(nr);
  if (!s) {
    s = (async () => {
      const H = { kall: 0, byte: 0 },
        f = await apne(H),
        { R } = await iKommunen(nr),
        G = await les(
          f,
          H,
          R.map(r => r.rad).sort((a, b) => a - b),
          ['geometry']
        );
      return { R: G.map(g => ({ ...(g.geometry as Omit<Flate, 'rad'>), rad: g.rad as number })), hentet: H };
    })();
    s.catch(() => flater.delete(nr));
    flater.set(nr, s);
  }
  return s;
}

/* Verneformen som tekst: «marintVerneområde» blir «marint verneområde» */
export const verneform = (v: string) => (v || '').replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2').toLowerCase();
/* Datoen ååååmmdd som dd.mm.åååå */
export const dato = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}` : d || '');
