/* Spørring i en GeoParquet-fil på nettet, uten å laste ned hele filen. Filen er verneområdene i Norge fra Miljødirektoratet, lagt
   ut som en testfil (rundt 33 MB, nesten alt er flatene). En Parquet-fil har beskrivelsen av innholdet sist i filen, og hver kolonne
   for seg, så nettleseren kan be om bare de bitene den trenger med Range i HTTP: først beskrivelsen, så de fem kolonnene spørringen
   bruker. Flatene leses ikke. Lesingen gjøres av hyparquet.
   Tjenesten (Azure Blob Storage) må svare med bare biten det spørres om (206 Partial Content). Svarer den med hele filen (200),
   stoppes hentingen, så siden aldri laster ned alt. Nettleseren kan bare lese filen når lagringskontoen tillater det for siden (CORS).
   Det som er hentet, huskes så lenge siden er åpen, så neste kommune ikke henter noe på nytt. Ingenting lagres i nettleseren. */
import { parquetMetadataAsync, parquetReadObjects, type AsyncBuffer } from 'hyparquet';

export const FIL =
  'https://pgisnedlasting.blob.core.windows.net/data/ressurser/test/Vern_0000_norge_25833_FILEGDB-Naturvernomr%C3%A5de.parquet';
/* Kolonnene spørringen leser */
export const KOLONNER = ['navn', 'verneform', 'vernedato', 'kommune', 'faktaark'];

/* Ett verneområde: navnet, verneformen, vernedatoen (ååååmmdd), kommunene (nummer med komma mellom) og lenken til faktaarket */
export interface Verneomrade {
  navn: string;
  verneform: string;
  vernedato: string;
  kommune: string;
  faktaark: string;
}
/* Hvor mye som er hentet: antall kall og byte, og hvor stor filen er */
export interface Hentet {
  kall: number;
  byte: number;
  fil: number;
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

/* Henter fra adressen, og gjør en feil i nettverket (som når CORS mangler) om til en forklarbar feil */
async function hent(init: RequestInit, signal?: AbortSignal) {
  try {
    return await fetch(FIL, { ...init, signal });
  } catch (e) {
    if (signal && signal.aborted) throw e;
    throw new Sporrefeil('cors', e instanceof Error ? e.message : String(e));
  }
}
/* Filen som biter: hver bit hentes med Range (bytes=a-b, aldri «de siste n», som tjenesten svarer på med hele filen) */
function biter(lengde: number, H: Hentet): AsyncBuffer {
  return {
    byteLength: lengde,
    async slice(a: number, b = lengde) {
      const stopp = new AbortController(),
        svar = await hent({ headers: { Range: `bytes=${a}-${b - 1}` } }, stopp.signal);
      if (svar.status !== 206) {
        stopp.abort();
        throw new Sporrefeil('helefilen', `Tjenesten svarte ${svar.status} i stedet for 206 på en bit av filen`);
      }
      const buf = await svar.arrayBuffer();
      H.kall++;
      H.byte += buf.byteLength;
      return buf;
    }
  };
}

/* Alle verneområdene med de fem kolonnene, hentet én gang mens siden er åpen */
let alle: Promise<Verneomrade[]> | null = null;
export const hentet: Hentet = { kall: 0, byte: 0, fil: 0 };
export function verneomrader(): Promise<Verneomrade[]> {
  if (!alle)
    alle = (async () => {
      const hode = await hent({ method: 'HEAD' });
      hentet.kall++;
      const lengde = Number(hode.headers.get('content-length'));
      if (!hode.ok || !lengde) throw new Sporrefeil('annet', `Fant ikke størrelsen på filen (${hode.status})`);
      hentet.fil = lengde;
      const file = biter(lengde, hentet),
        metadata = await parquetMetadataAsync(file, { initialFetchSize: 1 << 16 });
      return (await parquetReadObjects({ file, metadata, columns: KOLONNER })) as Verneomrade[];
    })().catch(e => {
      alle = null; /* neste forsøk prøver på nytt */
      throw e;
    });
  return alle;
}
/* Verneområdene som ligger helt eller delvis i kommunen nr, etter navnet */
export const iKommunen = (R: Verneomrade[], nr: string) =>
  R.filter(r => (r.kommune || '').split(',').includes(nr)).sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
/* Verneformen som tekst: «marintVerneområde» blir «marint verneområde» */
export const verneform = (v: string) => (v || '').replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2').toLowerCase();
/* Datoen ååååmmdd som dd.mm.åååå */
export const dato = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}` : d || '');
