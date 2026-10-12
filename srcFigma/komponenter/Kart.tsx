/* Kartet i tvillingen: det samme kartet som hovedsiden (src/ui/kart), satt inn her, med lagvelgeren fra Figma ved siden av. Hvilket
   tema kartet viser, følger siden (ui.side, se navigasjon.ts). Lagvelgeren skjuler og viser lagene med gjennomsiktighet, så kartets
   egen styring av lagene ikke røres. Lag som bare tvillingen har (kartlag.ts), legges inn under planen når kartet vises, og tas ut
   igjen etterpå. Det finnes ett kart, så bare én side om gangen har det. «Åpne kart i fullskjerm» legger kartet over hele vinduet. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { UTM } from '../../src/data/solv/felles.ts';
import { hentingAvKlasser } from '../../src/data/motor/grunnkart.ts';
import { app } from '../../src/data/motor/tilstand.ts';
import { verdi } from '../../src/data/motor/valgt.ts';
import { katalog } from '../../src/data/katalog.ts';
import { graaLag } from '../../src/ui/kart/graa.ts';
import { oversiktLag, tema as klasseLag } from '../../src/ui/kart/grunnkart.ts';
import { inonLag } from '../../src/ui/kart/inon.ts';
import { kart as kartet, lagKart, view } from '../../src/ui/kart/kart.ts';
import { dekLag, flateLag } from '../../src/ui/kart/naturtema.ts';
import { ol } from '../../src/ui/kart/ol.ts';
import { planLag } from '../../src/ui/kart/plan.ts';
import { byttTilValgt, plasserBytt, settByttKnapp } from '../../src/ui/kart/trykk.ts';
import { ui } from '../../src/ui/tilstand.ts';
import { henteKort } from '../../src/ui/tekst.ts';
import { MdButton, MdCheckbox, MdIconClose, MdIconExpandContent, MdLoadingSpinner } from '../md.ts';
import './Kart.css';

/* Et lag i lagvelgeren: hvilke av kartets lag det styrer (klasser, plan eller tema), eller et eget lag (ol), navnet, kilden, fargene
   i tegnforklaringen [navn, farge], og av når laget er skjult til man slår det på */
export interface Kartlag {
  id: string;
  navn: string;
  kilde: string;
  farger?: [navn: string, farge: string][];
  ol?: TileLayer<XYZ>;
  av?: boolean;
}
const OL_LAG: Record<string, () => { setOpacity(o: number): void }[]> = {
  klasser: () => [klasseLag, oversiktLag],
  plan: () => [planLag],
  tema: () => [...flateLag, dekLag, inonLag, graaLag]
};
export const KLASSER: Kartlag = {
  id: 'klasser',
  navn: 'Dagens arealklasser',
  kilde: 'Grunnkart for arealanalyse, NIBIO',
  farger: [
    ['Natur', 'nat'],
    ['Jordbruk', 'jor'],
    ['Bebygd', 'beb']
  ]
};
export const PLAN: Kartlag = {
  id: 'plan',
  navn: 'Planlagt utbygging',
  kilde: 'Kommuneplanen, DiBK',
  farger: [
    ['På natur', 'pnat'],
    ['På jordbruk', 'pjor']
  ]
};

/* Kartet zoomer til kommunen når det settes inn */
function tilKommunen() {
  const k = app.valgt,
    G = verdi(katalog.solv.grense),
    u = G ? G.ext : k && k.boks ? ol.proj.transformExtent(k.boks, 'EPSG:4326', UTM) : null;
  if (u && kartet) view.fit(u, { size: kartet.getSize(), padding: [16, 16, 16, 16] });
}

function Kartflate() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = lagKart();
    k.setTarget(ref.current!);
    const r = requestAnimationFrame(() => {
      k.updateSize();
      tilKommunen();
    });
    return () => {
      cancelAnimationFrame(r);
      k.setTarget(undefined);
    };
  }, []);
  return <div className="kartflate" ref={ref} />;
}

/* Knappen som bytter til kommunen man trykket i utenfor valgt kommune. Kartet plasserer den over punktet. */
function Bytt() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    settByttKnapp(ref.current);
    plasserBytt();
  });
  if (!ui.bytt) return null;
  return (
    <div className="bytt" ref={ref}>
      <MdButton onClick={byttTilValgt}>Bytt til {ui.bytt.navn}</MdButton>
    </div>
  );
}

/* Kartet med lagvelgeren ved siden av (lag og det som står under den, etter), som et bånd over hele bredden. stor gir et høyere kart.
   enkel gir bare kartet, med en merkelapp nede til venstre, som på oversikten. */
export default function Kart({
  lag,
  etter,
  stor,
  enkel
}: {
  lag: Kartlag[];
  etter?: ReactNode;
  stor?: boolean;
  enkel?: string;
}) {
  const [skjult, settSkjult] = useState<Record<string, boolean>>(() =>
      Object.fromEntries(lag.filter(l => l.av).map(l => [l.id, true]))
    ),
    [full, settFull] = useState(false),
    henting = hentingAvKlasser(),
    p = ui.probe;
  /* Lagene som er skjult, er gjennomsiktige. Alt vises igjen når kartet tas ut av siden. */
  useEffect(() => {
    for (const [id, f] of Object.entries(OL_LAG)) f().forEach(l => l.setOpacity(skjult[id] ? 0 : 1));
  }, [skjult]);
  useEffect(() => () => Object.values(OL_LAG).forEach(f => f().forEach(l => l.setOpacity(1))), []);
  /* Egne lag: inn under planen mens kartet vises, og synlige når de er slått på */
  const egne = lag.filter(l => l.ol);
  useEffect(() => {
    const k = lagKart(),
      L = k.getLayers();
    egne.forEach(l => {
      if (!L.getArray().includes(l.ol!)) L.insertAt(L.getArray().indexOf(planLag), l.ol!);
    });
    return () => egne.forEach(l => L.remove(l.ol!));
  }, [egne.map(l => l.id).join()]);
  useEffect(() => egne.forEach(l => l.ol!.setVisible(!skjult[l.id])), [skjult, egne.map(l => l.id).join()]);
  useEffect(() => {
    if (kartet) kartet.updateSize();
    if (!full) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && settFull(false);
    document.addEventListener('keydown', esc);
    document.documentElement.classList.add('kart-fullskjerm');
    return () => {
      document.removeEventListener('keydown', esc);
      document.documentElement.classList.remove('kart-fullskjerm');
    };
  }, [full]);
  const scene = (
    <div className={'kartscene' + (full ? ' full' : '') + (enkel ? ' enkel' : '')}>
      <Kartflate />
      <MdButton
        className="fullskjerm"
        mode="small"
        rightIcon={full ? <MdIconClose /> : <MdIconExpandContent />}
        onClick={() => settFull(!full)}
      >
        {full ? 'Lukk fullskjerm' : 'Åpne kart i fullskjerm'}
      </MdButton>
      {(app.laster || henting) && (
        <div className="kartmerke oppe" role="status">
          <MdLoadingSpinner size={16} />
          {henting ? henteKort(henting) : 'Henter kart …'}
        </div>
      )}
      {ui.ute && !henting && <div className="kartmerke nede">Zoom inn for å se arealklassene.</div>}
      <Bytt />
      {enkel && <div className="kartmerke enkel-merke">{enkel}</div>}
    </div>
  );
  if (enkel)
    return (
      <section className="kart-enkel" aria-label="Kart">
        {scene}
      </section>
    );
  return (
    <section className={'kartbaand' + (stor ? ' stor' : '')} aria-label="Kart">
      <div className="kartrute">
        {scene}
        <div className="lagvelger">
          <ul>
            {lag.map(l => (
              <li key={l.id}>
                <MdCheckbox
                  label={
                    <span className="lagnavn">
                      <b>{l.navn}</b>
                      <small>Kilde: {l.kilde}</small>
                    </span>
                  }
                  checked={!skjult[l.id]}
                  onChange={e => settSkjult({ ...skjult, [l.id]: !e.target.checked })}
                />
                {l.farger && (
                  <ul className="farger">
                    {l.farger.map(([navn, farge]) => (
                      <li key={navn}>
                        <i style={{ background: `var(--${farge})` }} />
                        {navn}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="probe">
            {!p ? 'Trykk i kartet for å se hva som er der.' : p.punkt ? <b>{p.punkt}</b> : p.tekst}
          </p>
          {etter}
        </div>
      </div>
    </section>
  );
}
