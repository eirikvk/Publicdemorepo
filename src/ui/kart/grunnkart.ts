/* Kartlaget med dagens arealklasser i kartfargene, tegnet av datamotoren (klasserIFlis) med den felles tegnemotoren (verdilag.ts):
   den felles sannheten i sølv på nivået kartet viser, så hver piksel er én klasse, den samme i alle kartlagene. Fra nivå 10 og finere
   solv.klasser (nivå 10 er blokkene tallene regnes av), og zoomet ut solv.klasserUt, utledet av blokkene. Zoomet inn vises også det
   som er utenfor kommunen. Kartbildene fra NIBIO hentes gjennom katalogen (bronse.grunnkartflis), som også legger dem inn i det
   sammensatte kartet. Under flisene ligger bildet zoomet ut, som vises mens flisene lages: blokkene satt sammen, eller det sammensatte
   kartet datamotoren lager av flisene som er hentet (data/motor/grunnkart.ts). Begge er et lerret, og kartet har sin egen kopi av det i
   kartfargene. */
import type ImageWrapper from 'ol/Image.js';
import type { Extent } from 'ol/extent.js';
import { ol } from './ol.ts';
import type { Utsnitt } from '../../data/generelt/geometri.ts';
import { UTM } from '../../data/solv/felles.ts';
import { oversikt } from '../../data/motor/grunnkart.ts';
import { klasserIFlis } from '../../data/motor/kartverdier.ts';
import { abonner, lytt, tidSlutt, type Sted } from '../../data/motor/tilstand.ts';
import { klassefarger, tilFarge } from './fargelegging.ts';
import { KILDER, MAKSRES, kartflagg, nyttSiden } from './felles.ts';
import { kartStatus, opplosning } from './kart.ts';
import { tegnPlan } from './plan.ts';
import { verdilag } from './verdilag.ts';

export const klare = new Set<string>(); /* fliser som er ferdig tegnet, som «nivå/x/y» */
export const tema = verdilag({
  tittel: 'Dagens arealklasser',
  kilder: [KILDER.nibio],
  verdier: klasserIFlis,
  farger: () => [null, ...klassefarger()],
  klipp: 'zoomet ut',
  ferdig: tc => klare.add(tc.join('/'))
});

/* Bildet zoomet ut. Ett lag, i samme lerret som flisene. Bildet glattes når det vises forminsket, og tegnes med rene piksler når
   det forstørres som plassholder. Det styres per bilde i tegningen, ikke med to lag: et lag som først slås på midt i en
   zoombevegelse rekker ikke å laste bildet sitt, og da blinket bakgrunnskartet gjennom første gang man zoomet inn. */
export const oversiktLag = new ol.layer.Image({ className: 'tema' });
const ovRes = () => {
  const ov = oversikt();
  return ov ? ov.res : 0;
};
oversiktLag.on('prerender', e => {
  (e.context as CanvasRenderingContext2D).imageSmoothingEnabled = e.frameState!.viewState.resolution >= ovRes();
});
oversiktLag.on('postrender', e => {
  (e.context as CanvasRenderingContext2D).imageSmoothingEnabled = true;
});
/* Uten bilde holdes laget skjult. Et synlig lag uten kilde får OpenLayers til å feile midt i en kartbevegelse,
   for eksempel når man bytter fra en kommune med lagrede klasser til en uten. */
export const oversiktSynlig = (v: boolean) => oversiktLag.setVisible(v && !!oversiktLag.getSource());

/* Dagens klasser zoomet ut i kartfargene. Kilden er et lerret (for det sammensatte kartet fylt på flis for flis), og kartlaget får
   en kopi av det som bilde. Det sparer å pakke hele lerretet som PNG og lese det inn igjen hver gang det kommer nye fliser. */
class LerretKilde extends ol.source.Image {
  declare bilde_: ImageWrapper;
  declare nr_: number;
  constructor(lerret: HTMLCanvasElement, ext: Utsnitt) {
    super({ projection: UTM, attributions: [KILDER.nibio] });
    this.bilde_ = new ol.Image(ext, (ext[3] - ext[1]) / lerret.height, 1, 2 /* ferdig lastet */);
    this.bilde_.setImage(lerret);
    this.nr_ = 0;
  }
  /* null når bildet er utenfor utsnittet. OpenLayers tåler det, selv om typene ikke sier det. */
  getImageInternal(extent: Extent) {
    return (ol.extent.intersects(extent, this.bilde_.getExtent()) ? this.bilde_ : null) as ImageWrapper;
  }
  oppdater(lerret: HTMLCanvasElement) {
    const mitt = ++this.nr_,
      bytt = (ny: HTMLCanvasElement | ImageBitmap) => {
        const gml = this.bilde_.getImage() as HTMLCanvasElement | ImageBitmap | null;
        this.bilde_.setImage(ny);
        if (gml && gml !== ny && (gml as ImageBitmap).close) (gml as ImageBitmap).close();
        this.changed();
      };
    bytt(lerret); /* lerretet vises med en gang, og byttes med en kopi som tegnes raskere når den er klar */
    if (!window.createImageBitmap) return;
    createImageBitmap(lerret)
      .then(bm => {
        if (mitt !== this.nr_) {
          bm.close();
          return;
        }
        bytt(bm);
      })
      .catch(() => {});
  }
}
/* Kartets kopi av hvert sammensatt kart: lerretet i kartfargene (vis), kilden, og stedene som venter på å bli fargelagt */
interface Kopi {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  vis: HTMLCanvasElement;
  vg: CanvasRenderingContext2D;
  kilde: LerretKilde | null;
  venter: Sted[];
}
const kopier = new Map<HTMLCanvasElement, Kopi>();
const kopi = (c: HTMLCanvasElement) => {
  let k = kopier.get(c);
  if (!k) {
    const vis = document.createElement('canvas');
    vis.width = c.width;
    vis.height = c.height;
    k = {
      c,
      g: c.getContext('2d', { willReadFrequently: true })!,
      vis,
      vg: vis.getContext('2d')!,
      kilde: null,
      venter: []
    };
    kopier.set(c, k);
  }
  return k;
};
lytt('samlingFjernet', c => {
  const k = kopier.get(c);
  if (k) k.vis.width = 0;
  kopier.delete(c);
});
function fargeleggSamling(k: Kopi, x = 0, y = 0, w = k.c.width, h = k.c.height) {
  /* fra rå klassefarger til kartfarger, for hele lerretet eller bare en flis */
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  w = Math.min(w, k.c.width - x);
  h = Math.min(h, k.c.height - y);
  if (w <= 0 || h <= 0) return;
  const t0 = performance.now(),
    F = klassefarger(),
    d = k.g.getImageData(x, y, w, h),
    o = d.data;
  let sist = -1,
    f: number[] = [];
  for (let i = 0; i < o.length; i += 4) {
    if (!o[i + 3]) continue;
    const n = ((o[i] << 24) | (o[i + 1] << 16) | (o[i + 2] << 8) | o[i + 3]) >>> 0;
    if (n !== sist) {
      sist = n;
      f = tilFarge(o[i], o[i + 1], o[i + 2], o[i + 3], F);
    } /* like nabopiksler regnes én gang */
    o[i] = f[0];
    o[i + 1] = f[1];
    o[i + 2] = f[2];
    o[i + 3] = f[3];
  }
  k.vg.putImageData(d, x, y);
  tidSlutt('fargelegging', t0);
}
function visSamling(k: Kopi, ext: Utsnitt) {
  k.kilde = k.kilde || new LerretKilde(k.vis, ext);
  const forste = !oversiktLag.getSource();
  if (oversiktLag.getSource() !== k.kilde) oversiktLag.setSource(k.kilde);
  if (forste) oversiktSynlig(true);
  k.kilde.oppdater(k.vis);
}
const fargeleggVentende = (k: Kopi | null | undefined) => {
  if (!k || !k.venter.length) return;
  while (k.venter.length) fargeleggSamling(k, ...k.venter.shift()!);
  if (k.kilde) k.kilde.oppdater(k.vis);
};
/* Nye fliser i det sammensatte kartet fargelegges når kartet har stått stille litt, så det ikke hakker mens man flytter det: én om
   gangen med pust imellom. Unntaket er når man zoomer ut til det sammensatte kartet er det eneste som vises. Da fargelegges alt som
   venter med en gang, ellers ville det man nettopp så på mangle. */
let etterTimer: number | undefined;
export let etterVenter = false;
export const pauseEtterarbeid = () => clearTimeout(etterTimer);
export const maalEtterarbeid = ['']; /* til målingen under Tekniske valg, se kart.ts */
export function planleggEtterarbeid() {
  etterVenter = true;
  clearTimeout(etterTimer);
  etterTimer = setTimeout(async () => {
    if (kartflagg.iBevegelse) return; /* moveend tar opp tråden igjen */
    const ov = oversikt(),
      k = ov && ov.lerret ? kopier.get(ov.lerret) : null,
      t0 = performance.now(),
      antall = k ? k.venter.length : 0;
    if (k && k.venter.length) {
      while (k.venter.length && !kartflagg.iBevegelse && k.c === (oversikt() || {}).lerret) {
        fargeleggSamling(k, ...k.venter.shift()!);
        await new Promise(ok => setTimeout(ok, 0));
      }
      if (k.kilde) k.kilde.oppdater(k.vis); /* også når det ble avbrutt, så det som er gjort vises */
    }
    if (kartflagg.iBevegelse) return;
    etterVenter = false;
    if (antall)
      maalEtterarbeid[0] = `Siste fargelegging: ${Math.round(performance.now() - t0)} ms for ${antall} ${antall === 1 ? 'ny flis' : 'nye fliser'}.`;
  }, 400);
}
/* Datamotoren har lagt en ny flis inn i det sammensatte kartet c, på stedet r */
lytt('nyFlis', (c, r) => {
  const k = kopi(c);
  k.venter.push(r); /* fargelegges når kartet står stille */
  if (opplosning() >= MAKSRES)
    fargeleggVentende(k); /* zoomet ut vises det sammensatte kartet, så flisen må inn med en gang */
  planleggEtterarbeid();
});
/* Zoomet ut: alt som venter, fargelegges med en gang */
export const fargeleggAltSomVenter = () => {
  const ov = oversikt();
  fargeleggVentende(ov && ov.lerret ? kopier.get(ov.lerret) : null);
};

/* Laget følger tilstanden: nytt bilde zoomet ut for valgt kommune */
const ny = nyttSiden();
abonner(() => {
  const denne = oversikt();
  if (!ny('ov', denne)) return;
  if (!denne) {
    oversiktLag.setSource(null);
    oversiktSynlig(true);
  } else {
    const k = kopi(denne.lerret);
    k.venter.length = 0;
    fargeleggSamling(k);
    visSamling(k, denne.ext);
    if (!denne.dynamisk) tegnPlan(); /* planlaget tegnes oppå dagens klasser, som nå finnes for hele kommunen */
  }
  kartStatus();
});
