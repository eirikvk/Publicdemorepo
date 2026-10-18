/* Tegnemotoren for kartlagene som tegnes piksel for piksel av datamotoren (data/motor/kartverdier.ts): dagens klasser,
   detaljklassene, grått areal og inngrepsfri natur. Hovedsiden og tvillingen fra Figma bruker den samme motoren, så dataene går den
   samme veien og møter kartet på samme måte på begge sidene.
   Datamotoren sier hva hver piksel er, og laget gir verdien en farge, uten utjevning: hver piksel i kartet er det sølv sier på nivået
   kartet viser, og alle lagene er enige. Det et lag bestemmer selv, er bare hvordan det ser ut: fargene, om det klippes mot kommunen
   også zoomet inn, om det bare vises innenfor noen flater, og gjennomsiktigheten. */
import type ImageTile from 'ol/ImageTile.js';
import { ol } from './ol.ts';
import type { Flerflate, Utsnitt } from '../../data/generelt/geometri.ts';
import { FLISNIVA, type Flis } from '../../data/solv/felles.ts';
import { flislerret, sti, tegneflate } from '../../data/solv/raster.ts';
import { katalog } from '../../data/katalog.ts';
import { iKommunen } from '../../data/motor/kartverdier.ts';
import { valgtNr, verdi } from '../../data/motor/valgt.ts';
import { abonner } from '../../data/motor/tilstand.ts';
import {
  TOM,
  fargPiksel,
  friskOpp,
  nyttSiden,
  plannett,
  slippTil,
  tegnetKilde,
  type Flislag,
  type Flistegner
} from './felles.ts';

/* Det som er eget for hvert lag */
export interface Verdilag {
  tittel: string /* navnet på laget */;
  kilder: string[] /* hvem dataene kommer fra, til krediteringen i kartet (KILDER i felles.ts) */;
  verdier: (tc: Flis) => Promise<ArrayLike<number> | null> /* verdien per piksel i flisen, fra datamotoren */;
  farger: () => (ArrayLike<number> | null)[] /* fargen [r, g, b] for verdien v på plass v, null der den ikke vises */;
  klipp: 'alltid' | 'zoomet ut' /* klippes mot kommunen alltid, eller bare zoomet ut (under nivå 10) */;
  klasse?: string /* CSS-klassen til laget: 'tema' (standard) deler lerret med dagens klasser på hovedsiden, 'figma-lag' i tvillingen */;
  maske?: () => Flerflate[] | null /* bare innenfor disse flatene, som verneområdene. null mens de hentes. */;
  folg?: (lag: Flislag) => unknown /* laget tegnes på nytt når dette endres */;
  opacity?: number;
  ferdig?: (tc: Flis) => void /* flisen er tegnet */;
}

/* Klipper det som er tegnet i flisen g (utsnitt u) til flatene F, slått sammen. false mens flatene ikke er hentet (null), eller når
   det ikke finnes noen. */
function klippTil(g: CanvasRenderingContext2D, F: Flerflate[] | null, u: Utsnitt): boolean {
  if (!F || !F.length) return false;
  const m = tegneflate(512, 512),
    s = 512 / (u[2] - u[0]);
  for (const f of F) {
    sti(m, f, u, s);
    m.fill('evenodd');
  }
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(m.canvas, 0, 0);
  return true;
}

export function verdilag(o: Verdilag): Flislag {
  async function tegn(tile: ImageTile) {
    try {
      /* én flis om gangen: siden slipper til mellom flisene, så et trykk ikke må vente til alle flisene er tegnet */
      await slippTil();
      const tc = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent(tc),
        G = verdi(katalog.solv.grense),
        klipp = o.klipp === 'alltid' || tc[0] < FLISNIVA;
      if (klipp && (!G || G.nr !== valgtNr() || !ol.extent.intersects(u, G.ext) || !(await iKommunen(tc))))
        return tile.setState(TOM);
      const V = await o.verdier(tc);
      if (!V) return tile.setState(TOM);
      const F = o.farger(),
        c = flislerret(),
        g = c.getContext('2d')!,
        d = g.createImageData(512, 512),
        p = d.data;
      let noe = false;
      for (let q = 0; q < V.length; q++) {
        const f = F[V[q]];
        if (!f) continue;
        fargPiksel(p, 4 * q, f);
        noe = true;
      }
      if (!noe) return tile.setState(TOM);
      g.putImageData(d, 0, 0);
      if (klipp) {
        g.globalCompositeOperation = 'destination-in';
        sti(g, G!.koord, u, 512 / (u[2] - u[0]));
        g.fill('evenodd');
      }
      if (o.maske && !klippTil(g, o.maske(), u)) return tile.setState(TOM);
      tile.setImage(c);
      if (o.ferdig) o.ferdig(tc);
    } catch (e) {
      tile.setState(3);
    }
  }
  const lag: Flislag = new ol.layer.Tile({
    className: o.klasse || 'tema',
    properties: { tittel: o.tittel },
    opacity: o.opacity === undefined ? 1 : o.opacity,
    source: tegnetKilde(tegn as Flistegner, o.kilder, true)
  });
  /* Ny kommune, eller noe laget følger er endret: laget tegnes på nytt. Lag som alltid klippes, holdes innenfor kommunen. */
  const ny = nyttSiden();
  abonner(() => {
    const G = verdi(katalog.solv.grense),
      a = ny('grense', G),
      b = o.folg ? ny('folg', o.folg(lag)) : false;
    if (!a && !b) return;
    if (G && o.klipp === 'alltid') lag.setExtent(G.ext);
    friskOpp(lag);
  });
  return lag;
}
