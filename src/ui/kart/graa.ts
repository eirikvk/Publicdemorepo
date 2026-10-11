/* Kartlaget for grått areal. Zoomet ut tegnes det av trinnene per rute i katalogen (solv.graa). Zoomet inn hentes laget som
   fliser fra NIBIO gjennom katalogen (bronse.graaflis), så små flater blir skarpe. I kartet er lysere grått mer vegetasjon, og blågrønt er grønt i bebygd
   område: areal som er bebygd i grunnkartet, men ikke grått. Det som er felles med inngrepsfri natur, står i kommunebilde.ts. */
import { graaFlisUrl } from '../../data/bronse/nibio-graa.ts';
import { FLISNIVA, HALV } from '../../data/solv/felles.ts';
import { GRAATRINN, graaTrinn } from '../../data/solv/graa.ts';
import { BEB, klasserIFlis } from '../../data/solv/klasser.ts';
import { bildePiksler } from '../../data/solv/raster.ts';
import { katalog } from '../../data/katalog.ts';
import { dagensKlasser } from '../../data/motor/grunnkart.ts';
import { bildetallet, valgt, verdi } from '../../data/motor/valgt.ts';
import { tidSlutt } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { fargPiksel } from './felles.ts';
import { bildelag } from './kommunebilde.ts';

/* Kartets egne terskler for grått areal. Arealet regnes med halvregelen (HALV). I flisene fra NIBIO er en piksel grå fra en
   fjerdedel dekning, så kantene på små flater ikke forsvinner når kartet er zoomet langt inn. Langs kanten av den utjevnede masken
   tegnes grønt i bebygd område der masken er under en fjerdedel. Tersklene gjelder bare kartet, ikke tallene. */
const KART_GRAA = 64,
  KART_KANT = 64;

/* Fargene per trinn (plass 1–6), og grønt i bebygd område */
const trinnfarger = () => [null, ...GRAATRINN.map(x => rgb(x[0])), rgb('graa0')];
/* Bebygd per piksel i dagens klasser K, med samme regel som tallene (klasserIFlis). Grønt i bebygd område er bebygd, men ikke
   grått. */
const klasser = (K: Uint8ClampedArray | null) => (K ? klasserIFlis(K) : null);
const gront = (kl: Uint8Array | null, i: number) => !!kl && kl[i >> 2] === BEB + 1;

/* Masken er det grå: hvitt der det er grått, jevnet ut én gang så kanten blir glatt når kartet er zoomet inn. Laget tegnes på nytt
   også når kryssingen med planen endres. */
export const graaLag = bildelag({
  side: 'graa',
  tittel: 'Grått areal',
  data: () => verdi(katalog.solv.graa),
  noe: () => bildetallet(valgt(katalog.gull.graa)).tilstand === 'ok',
  folgOgsaa: () => verdi(katalog.gull.graakryss),
  jevninger: 1,
  fyll: (P, D) => {
    for (let q = 0, i = 0; q < D.kl.length; q++, i += 4) {
      P[i] = P[i + 1] = P[i + 2] = D.kl[q] ? 255 : 0;
      P[i + 3] = 255;
    }
  },
  tegn: async (g, D, tegnMaske, tc, u) => {
    const F = trinnfarger(),
      GR = rgb('gront');
    if (tc[0] >= FLISNIVA) {
      /* zoomet inn: flisen hentes fra tjenesten, så små flater blir skarpe. Zoomet ut holder kommunebildet. */
      const o = await bildePiksler(await katalog.bronse.graaflis(graaFlisUrl(u)), 512, 512);
      const K = klasser(
        await dagensKlasser(tc).catch(() => null)
      ); /* dagens klasser: bebygd som ikke er grått, tegnes som grønt i bebygd område */
      const t1 = performance.now();
      let noe = false;
      for (let i = 0; i < o.length; i += 4) {
        const k = o[i + 3] >= KART_GRAA ? graaTrinn(o[i], 255) : 0,
          f = k ? F[k] : gront(K, i) ? GR : null;
        if (!f) {
          o[i + 3] = 0;
          continue;
        }
        fargPiksel(o, i, f);
        noe = true;
      }
      if (!noe) return false;
      g.putImageData(new ImageData(o, 512, 512), 0, 0);
      tidSlutt('grått areal, fliser', t1);
      return true;
    }
    const K = klasser(await dagensKlasser(tc).catch(() => null)),
      t0 = performance.now();
    tegnMaske(); /* utjevnet maske: glatt kant rundt det grå */
    const P = g.getImageData(0, 0, 512, 512).data,
      ut = g.createImageData(512, 512),
      o = ut.data,
      m = (u[2] - u[0]) / 512;
    let tegnet = false;
    const kol = new Int32Array(512),
      w = D.w,
      h = D.h;
    for (let px = 0; px < 512; px++) kol[px] = Math.floor((u[0] + (px + 0.5) * m - D.u[0]) / D.res);
    for (let py = 0, i = 0; py < 512; py++) {
      const rad = Math.floor((D.u[3] - (u[3] - (py + 0.5) * m)) / D.res);
      for (let px = 0; px < 512; px++, i += 4) {
        const x = kol[px],
          inne = P[i + 3] >= HALV && x >= 0 && x < w && rad >= 0 && rad < h;
        let f = null;
        if (inne && P[i] >= HALV) {
          const q = rad * w + x;
          f =
            F[
              D.kl[q] ||
                (x > 0 && D.kl[q - 1]) ||
                (x < w - 1 && D.kl[q + 1]) ||
                (rad > 0 && D.kl[q - w]) ||
                (rad < h - 1 && D.kl[q + w]) ||
                6
            ];
        } /* i kanten kan masken nå litt lenger enn rutene */
        else if ((!inne || P[i] < KART_KANT) && gront(K, i)) f = GR;
        if (!f) continue;
        fargPiksel(o, i, f);
        tegnet = true;
      }
    }
    if (!tegnet) return false;
    g.putImageData(ut, 0, 0);
    tidSlutt('grått areal, fliser', t0);
    return true;
  }
});
