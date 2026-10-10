/* Kartlaget med dagens arealklasser: flisene fra NIBIO når kartet er zoomet inn, og oversiktsbildet når det er zoomet ut, i
   kartfargene. Bildene hentes i data/bronse/nibio-grunnkart.js. Oversiktsbildet er det lagrede, eller det sammensatte kartet
   datamotoren lager av flisene som er hentet (data/motor/grunnkart.js). Kartet har sin egen kopi av det i kartfargene. */
import { ol } from './ol.js';
import { grunnkartUrl, hentGrunnkartFlis } from '../../data/bronse/nibio-grunnkart.js';
import { UTM } from '../../data/solv/felles.ts';
import { leggISamling } from '../../data/motor/grunnkart.js';
import { abonner, app, lytt, tidSlutt } from '../../data/motor/tilstand.js';
import { fargeleggBlob, klassefarger, tilFarge } from './fargelegging.js';
import { MAKSRES, flisnett, friskOpp, kartflagg, nyttSiden, utdaterte } from './felles.js';
import { kartStatus, view } from './kart.js';
import { tegnPlan } from './plan.js';

/* Flisene fra NIBIO. Den rå flisen legges også inn i det sammensatte kartet i datamotoren. */
export const klare = new Set(); /* fliser som er ferdig lastet og tegnes skarpt, som «nivå/x/y» */
const flisUrl = tc => grunnkartUrl(flisnett.getTileCoordExtent(tc));
function lastFlis(tile, src) {
  hentGrunnkartFlis(src)
    .then(buf => {
      leggISamling(tile.getTileCoord(), buf);
      return fargeleggBlob(buf);
    })
    .then(blob => {
      const img = tile.getImage(),
        url = URL.createObjectURL(blob);
      img.addEventListener(
        'load',
        () => {
          URL.revokeObjectURL(url);
          klare.add(tile.getTileCoord().join('/'));
        },
        { once: true }
      );
      img.src = url;
    })
    .catch(() => tile.setState(3));
}
export const tema = new ol.layer.Tile({
  className: 'tema',
  source: new ol.source.XYZ({
    tileUrlFunction: flisUrl,
    tileGrid: flisnett,
    tilePixelRatio: 2,
    tileLoadFunction: lastFlis,
    transition: 0,
    projection: UTM
  }),
  maxResolution: MAKSRES
});

/* Zoomet ut tegnes inngrepsfri natur og grått areal oppå dagens klasser fra det sammensatte kartet. Fliser som ble tegnet før
   kartet fikk mer innhold, er derfor utdaterte. Lagene merkes når en ny flis legges inn, og tegnes på nytt neste gang kartet står
   stille zoomet ut med laget på. Uten dette ble de stående tomme når man zoomet inn, så seg rundt og zoomet ut igjen. */
export function friskOppGamle() {
  if (kartflagg.iBevegelse || view.getResolution() < MAKSRES) return;
  for (const lag of [...utdaterte]) if (lag.getVisible()) friskOpp(lag);
}
/* Lagene som tegnes oppå dagens klasser zoomet ut, og som må tegnes på nytt når det sammensatte kartet får nye fliser.
   Kartlagene melder seg på her. */
const oppaa = [];
export const tegnesOppaa = lag => oppaa.push(lag);

/* Oversiktsbildet. Ett lag, i samme lerret som flisene. Bildet glattes når det vises forminsket, og tegnes med rene piksler når
   det forstørres som plassholder. Det styres per bilde i tegningen, ikke med to lag: et lag som først slås på midt i en
   zoombevegelse rekker ikke å laste bildet sitt, og da blinket bakgrunnskartet gjennom første gang man zoomet inn. */
export const oversiktLag = new ol.layer.Image({ className: 'tema' });
const ovRes = () => (app.ov ? app.ov.res : 0);
oversiktLag.on('prerender', e => {
  e.context.imageSmoothingEnabled = e.frameState.viewState.resolution >= ovRes();
});
oversiktLag.on('postrender', e => {
  e.context.imageSmoothingEnabled = true;
});
/* Uten bilde holdes laget skjult. Et synlig lag uten kilde får OpenLayers til å feile midt i en kartbevegelse,
   for eksempel når man bytter fra en kommune med oversiktsbilde til en uten. */
export const oversiktSynlig = v => oversiktLag.setVisible(v && !!oversiktLag.getSource());

/* Det lagrede oversiktsbildet, fargelagt */
let ovUrl = null;
async function visLagret(denne) {
  const blob = await fargeleggBlob(denne.buf);
  if (denne !== app.ov) return;
  const url = URL.createObjectURL(blob),
    gammel = ovUrl;
  ovUrl = url;
  const forste = !oversiktLag.getSource();
  oversiktLag.setSource(new ol.source.ImageStatic({ url, imageExtent: denne.ext, projection: UTM }));
  if (forste) oversiktSynlig(true);
  if (gammel) setTimeout(() => URL.revokeObjectURL(gammel), 5000);
}

/* Det sammensatte kartet i kartfargene. Kilden er et lerret som fylles på flis for flis, og kartlaget får en kopi av det som bilde.
   Det sparer å pakke hele lerretet som PNG og lese det inn igjen hver gang det kommer nye fliser. */
class LerretKilde extends ol.source.Image {
  constructor(lerret, ext) {
    super({ projection: UTM });
    this.bilde_ = new ol.Image(ext, (ext[3] - ext[1]) / lerret.height, 1, 2 /* ferdig lastet */);
    this.bilde_.setImage(lerret);
    this.nr_ = 0;
  }
  getImageInternal(extent) {
    return ol.extent.intersects(extent, this.bilde_.getExtent()) ? this.bilde_ : null;
  }
  oppdater(lerret) {
    const mitt = ++this.nr_,
      bytt = ny => {
        const gml = this.bilde_.getImage();
        this.bilde_.setImage(ny);
        if (gml && gml !== ny && gml.close) gml.close();
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
const kopier = new Map();
const kopi = c => {
  let k = kopier.get(c);
  if (!k) {
    const vis = document.createElement('canvas');
    vis.width = c.width;
    vis.height = c.height;
    k = {
      c,
      g: c.getContext('2d', { willReadFrequently: true }),
      vis,
      vg: vis.getContext('2d'),
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
function fargeleggSamling(k, x = 0, y = 0, w = k.c.width, h = k.c.height) {
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
    f = null;
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
function visSamling(k, ext) {
  k.kilde = k.kilde || new LerretKilde(k.vis, ext);
  const forste = !oversiktLag.getSource();
  if (oversiktLag.getSource() !== k.kilde) oversiktLag.setSource(k.kilde);
  if (forste) oversiktSynlig(true);
  k.kilde.oppdater(k.vis);
}
const fargeleggVentende = k => {
  if (!k || !k.venter.length) return;
  while (k.venter.length) fargeleggSamling(k, ...k.venter.shift());
  if (k.kilde) k.kilde.oppdater(k.vis);
};
/* Nye fliser i det sammensatte kartet fargelegges når kartet har stått stille litt, så det ikke hakker mens man flytter det: én om
   gangen med pust imellom. Unntaket er når man zoomer ut til det sammensatte kartet er det eneste som vises. Da fargelegges alt som
   venter med en gang, ellers ville det man nettopp så på mangle. */
let etterTimer = null;
export let etterVenter = false;
export const pauseEtterarbeid = () => clearTimeout(etterTimer);
export const maalEtterarbeid = ['']; /* til målingen under Tekniske valg, se kart.js */
export function planleggEtterarbeid() {
  etterVenter = true;
  clearTimeout(etterTimer);
  etterTimer = setTimeout(async () => {
    if (kartflagg.iBevegelse) return; /* moveend tar opp tråden igjen */
    const k = app.ov && app.ov.lerret ? kopier.get(app.ov.lerret) : null,
      t0 = performance.now(),
      antall = k ? k.venter.length : 0;
    if (k && k.venter.length) {
      while (k.venter.length && !kartflagg.iBevegelse && app.ov && k.c === app.ov.lerret) {
        fargeleggSamling(k, ...k.venter.shift());
        await new Promise(ok => setTimeout(ok, 0));
      }
      if (k.kilde) k.kilde.oppdater(k.vis); /* også når det ble avbrutt, så det som er gjort vises */
    }
    if (kartflagg.iBevegelse) return;
    etterVenter = false;
    friskOppGamle();
    if (antall)
      maalEtterarbeid[0] = `Siste fargelegging: ${Math.round(performance.now() - t0)} ms for ${antall} ${antall === 1 ? 'ny flis' : 'nye fliser'}.`;
  }, 400);
}
/* Datamotoren har lagt en ny flis inn i det sammensatte kartet c, på stedet r */
lytt('nyFlis', (c, r) => {
  const k = kopi(c);
  oppaa.forEach(lag => utdaterte.add(lag));
  k.venter.push(r); /* fargelegges når kartet står stille */
  if (view.getResolution() >= MAKSRES)
    fargeleggVentende(k); /* zoomet ut vises det sammensatte kartet, så flisen må inn med en gang */
  planleggEtterarbeid();
});
/* Zoomet ut: alt som venter, fargelegges med en gang */
export const fargeleggAltSomVenter = () =>
  fargeleggVentende(app.ov && app.ov.lerret ? kopier.get(app.ov.lerret) : null);

/* Laget følger tilstanden: nytt oversiktsbilde for valgt kommune */
const ny = nyttSiden();
abonner(() => {
  if (!ny('ov', app.ov)) return;
  const denne = app.ov;
  if (!denne) {
    oversiktLag.setSource(null);
    oversiktSynlig(true);
  } else if (denne.buf) {
    visLagret(denne);
    tegnPlan(); /* planlaget tegnes oppå dagens klasser, som nå finnes for hele kommunen */
  } else {
    const k = kopi(denne.lerret);
    k.venter.length = 0;
    fargeleggSamling(k);
    visSamling(k, denne.ext);
  }
  kartStatus();
});
