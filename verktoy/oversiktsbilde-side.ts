/* Delen av verktoy/oversiktsbilde.ts som kjører i nettleseren. Den bruker koden siden selv bruker: grensen fra Kartverket og
   grunnkartet fra NIBIO hentes med bronse, bildene og kommunens flate leses som ruter med sølv (raster.ts), og hver farge tolkes som en
   blanding av to klasser med BLANDING (klasser.ts), slik kartet gjør. Det som er eget for oversiktsbildet, står her: hvor tett
   grunnkartet hentes, og hvordan pikslene slås sammen til et lite bilde med fargetabell. */
import { hent } from '../src/data/bronse/henting.ts';
import { hentKommunegrense } from '../src/data/bronse/kartverket.ts';
import { GROVESTE_M, grunnkartUrl } from '../src/data/bronse/nibio-grunnkart.ts';
import { flerflate, utsnitt } from '../src/data/generelt/geometri.ts';
import { ALLE, BLANDING, DATAFARGE, fargeNr } from '../src/data/solv/klasser.ts';
import { bildePiksler, flatePiksler } from '../src/data/solv/raster.ts';

const LENGSTE = 2048; /* piksler på lengste side i det ferdige bildet */
const FLIS = 2048; /* piksler per kall mot NIBIO */
const N = ALLE.length; /* klassene: bebygd, jordbruk, natur, hav, innsjø og elv */

/* Prøver på nytt med økende pause, inntil seks ganger */
async function medForsok<T>(f: () => Promise<T>, forsok = 6): Promise<T> {
  for (let i = 0; ; i++)
    try {
      return await f();
    } catch (e) {
      if (i + 1 >= forsok) throw e;
      await new Promise(ok => setTimeout(ok, (2 + 4 * i) * 1000));
    }
}
const enDesimal = (v: number) => Math.round(v * 10) / 10;

/* Lager oversiktsbildet for kommunen nr. Gir bildet som plass i fargetabellen per piksel (base64), fargetabellen med dekning,
   utsnittet bildet dekker, og litt statistikk. */
export async function lagOversikt(nr: string) {
  const koord = flerflate(await medForsok(() => hentKommunegrense({ nr, navn: nr, boks: null })));
  const [minx, miny, maxx, maxy] = utsnitt(koord),
    res = Math.max(maxx - minx, maxy - miny) / LENGSTE; /* meter per piksel i det ferdige bildet */
  let f = Math.max(1, Math.ceil(res / GROVESTE_M)); /* grunnkartet hentes f ganger så tett */
  if (f === 1 && res / 2 >= 4) f = 2;
  const kres = res / f,
    w = Math.ceil((maxx - minx) / res),
    h = Math.ceil((maxy - miny) / res),
    kw = w * f,
    kh = h * f;
  /* Andelen av hver klasse per piksel i det ferdige bildet: snittet av f x f piksler fra grunnkartet */
  const F = new Float32Array(w * h * N);
  let kall = 0,
    ms = 0;
  for (let ty = 0; ty < kh; ty += FLIS)
    for (let tx = 0; tx < kw; tx += FLIS) {
      const tw = Math.min(FLIS, kw - tx),
        th = Math.min(FLIS, kh - ty),
        u = [minx + tx * kres, maxy - (ty + th) * kres, minx + (tx + tw) * kres, maxy - ty * kres],
        t0 = performance.now();
      const buf = await medForsok(() => hent('NIBIO', 'Oversiktsbilde', grunnkartUrl(u, tw, th), true, true, true));
      kall++;
      ms += performance.now() - t0;
      const P = await bildePiksler(buf, tw, th);
      for (let y = 0; y < th; y++)
        for (let x = 0; x < tw; x++) {
          const i = 4 * (y * tw + x),
            a = P[i + 3] / 255;
          if (!a) continue;
          const q = fargeNr(P[i], P[i + 1], P[i + 2]),
            t = BLANDING.T[q] / 255,
            o = (Math.floor((ty + y) / f) * w + Math.floor((tx + x) / f)) * N;
          F[o + BLANDING.A[q]] += (t * a) / (f * f);
          F[o + BLANDING.B[q]] += ((1 - t) * a) / (f * f);
        }
    }
  /* Kommunens flate i samme rutenett. Hver piksel lagres som en blanding av de to klassene det er mest av, i sjettedeler, så
     bildet får en liten fargetabell. Piksler utenfor kommunen og nesten uten innhold blir gjennomsiktige. */
  const M = flatePiksler(koord, { u: [minx, maxy - h * res, minx + w * res, maxy], res, w, h }),
    FARGER = ALLE.map(([id]) => DATAFARGE[id]),
    nokkel = new Uint32Array(w * h),
    storst = new Int8Array(w * h).fill(-1);
  for (let p = 0; p < w * h; p++) {
    let a = 0,
      b = -1,
      sum = 0;
    for (let c = 0; c < N; c++) {
      const v = F[p * N + c];
      sum += v;
      if (v > F[p * N + a]) a = c;
    }
    for (let c = 0; c < N; c++) if (c !== a && (b < 0 || F[p * N + c] > F[p * N + b])) b = c;
    if (!(M[4 * p + 3] >= 128 && sum > 0.3)) continue;
    const fa = F[p * N + a],
      fb = F[p * N + b],
      q = Math.round((6 * fa) / Math.max(fa + fb, 1e-6)),
      farge = [0, 1, 2].map(k => Math.round((q * FARGER[a][k] + (6 - q) * FARGER[b][k]) / 6));
    nokkel[p] = ((farge[0] << 16) | (farge[1] << 8) | farge[2]) + 1;
    storst[p] = a;
  }
  const nokler = [...new Set(nokkel)].sort((x, y) => x - y);
  if (nokler.length > 256) throw new Error(`${nr}: ${nokler.length} farger, flere enn en fargetabell rommer`);
  const plass = new Map(nokler.map((k, i) => [k, i])),
    indeks = Uint8Array.from(nokkel, k => plass.get(k)!);
  const km2: Record<string, number> = {};
  ALLE.forEach(([, navn], c) => {
    let n = 0;
    for (let p = 0; p < w * h; p++) if (storst[p] === c) n++;
    km2[navn.toLowerCase()] = enDesimal((n * res * res) / 1e6);
  });
  let tekst = '';
  for (let i = 0; i < indeks.length; i += 32768) tekst += String.fromCharCode(...indeks.subarray(i, i + 32768));
  return {
    w,
    h,
    indeks: btoa(tekst),
    farger: nokler.map(k => (k ? [((k - 1) >> 16) & 255, ((k - 1) >> 8) & 255, (k - 1) & 255] : [0, 0, 0])),
    dekning: nokler.map(k => (k ? 255 : 0)),
    utsnitt: [enDesimal(minx), enDesimal(maxy - h * res), enDesimal(minx + w * res), enDesimal(maxy)],
    info: { piksler: `${w}x${h}`, meter_per_piksel: enDesimal(res), kall, sekunder: enDesimal(ms / 1000), km2 }
  };
}
