/* Kartet i tvillingen: det samme kartet som hovedsiden (src/ui/kart), satt inn her, med lagvelgeren fra Figma ved siden av. Hvilket
   tema kartet viser, følger siden (ui.side, se navigasjon.ts). Lagvelgeren skjuler og viser lagene med gjennomsiktighet, så kartets
   egen styring av lagene ikke røres. Hvert lag står som i skissene: fargen til venstre, navnet og kilden, og valget til høyre. Har
   laget flere farger, står de under når laget er slått på, og en pil til venstre lukker og åpner dem. Lag som bare tvillingen har
   (kartlag.ts), legges inn under planen når kartet vises, og tas ut igjen etterpå. Hovedkartet finnes én gang, så bare én side om
   gangen har det. Siden om verneområder har i tillegg et eget kart lenger ned, som skissene (kart2.ts). «Åpne kart i fullskjerm»
   legger kartet over hele vinduet. Zoomknappene har designsystemets ikoner for pluss og minus. Omrisset av egne områder er et av
   kartets lag (ui/kart/egne.ts), og på naturtapet kan det slås av og på (EGNE), med verktøyene for å tegne over kartet og en fil
   som kan slippes i kartet. */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode
} from 'react';
import { createRoot } from 'react-dom/client';
import type OlMap from 'ol/Map.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { UTM } from '../../src/data/solv/felles.ts';
import { hentingAvKlasser } from '../../src/data/motor/grunnkart.ts';
import { abonner, app } from '../../src/data/motor/tilstand.ts';
import { verdi } from '../../src/data/motor/valgt.ts';
import { katalog } from '../../src/data/katalog.ts';
import { graaLag } from '../../src/ui/kart/graa.ts';
import { tema as klasseLag } from '../../src/ui/kart/grunnkart.ts';
import { inonLag } from '../../src/ui/kart/inon.ts';
import { kart as kartet, lagKart } from '../../src/ui/kart/kart.ts';
import { egneLag } from '../../src/ui/kart/egne.ts';
import { dekLag, flateLag } from '../../src/ui/kart/naturtema.ts';
import { ol } from '../../src/ui/kart/ol.ts';
import { planLag } from '../../src/ui/kart/plan.ts';
import { byttTilValgt, plasserBytt, settByttKnapp } from '../../src/ui/kart/trykk.ts';
import { ui } from '../../src/ui/tilstand.ts';
import { henteKort } from '../tekst.ts';
import {
  MdButton,
  MdIconAdd,
  MdIconClose,
  MdIconExpandContent,
  MdIconKeyboardArrowDown,
  MdIconRemove,
  MdLoadingSpinner
} from '../md.ts';
import './Kart.css';

/* Et lag i lagvelgeren: hvilke av kartets lag det styrer (klasser, plan eller tema), eller et eget lag (ol), navnet, kilden, fargene
   i tegnforklaringen [navn, farge], og av når laget er skjult til man slår det på. med er egne lag som vises sammen med laget, som
   lokalitetene som vurderes sammen med verdsatt natur. velg gjør at hver farge kan slås av og på for seg: den får fargene som er slått
   av. skjul er for et av kartets lag som ikke skal vises på siden: det står ikke i lagvelgeren og er alltid skjult. */
export interface Kartlag {
  id: string;
  navn: string;
  kilde: string;
  farger?: [navn: string, farge: string][];
  ol?: TileLayer<XYZ>;
  med?: TileLayer<XYZ>[];
  velg?: (av: string[]) => void;
  av?: boolean;
  skjul?: boolean;
}
/* Fargene med prikker, som i skissene: tresatt myr og tresatt innmarksbeite, og villreinområdene og dekningskartet, som har lys
   bunn og prikker i fargen fra kartet, og villrein også kanten */
const PRIKKET = new Set(['myr-tresatt', 'beite-tresatt']);
const MED_BUNN: Record<string, { prikk: string; kant?: string }> = {
  rein: { prikk: 'rein-prikk', kant: 'rein' },
  dekning: { prikk: 'dekning' }
};
/* Egne områder er omriss i kartet: hel strek for utbygging og stiplet for ikke utbygging */
const OMRISS: Record<string, string> = { 'egne-bygg': 'solid', 'egne-fri': 'dashed' };
const fargeStil = (f: string): CSSProperties =>
  OMRISS[f]
    ? { background: '#fff', border: `2.5px ${OMRISS[f]} var(--egne)` }
    : MED_BUNN[f]
      ? {
          backgroundColor: `var(--${f}-flate)`,
          backgroundImage: `radial-gradient(var(--${MED_BUNN[f].prikk}) 1.1px, transparent 1.6px)`,
          backgroundSize: '5px 5px',
          boxShadow: MED_BUNN[f].kant ? `inset 0 0 0 1.5px var(--${MED_BUNN[f].kant})` : undefined
        }
      : PRIKKET.has(f)
        ? {
            backgroundColor: `var(--${f})`,
            backgroundImage: 'radial-gradient(rgb(0 0 0 / 0.32) 1.1px, transparent 1.6px)',
            backgroundSize: '5px 5px'
          }
        : { background: `var(--${f})` };
const OL_LAG: Record<string, () => { setOpacity(o: number): void }[]> = {
  klasser: () => [klasseLag],
  plan: () => [planLag],
  tema: () => [...flateLag, inonLag, graaLag],
  dekning: () => [dekLag],
  egne: () => [egneLag]
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

/* Egne områder tegnet i kartet. En opplastet plan har ikke omriss, men vises i planlagt utbygging. */
export const EGNE: Kartlag = {
  id: 'egne',
  navn: 'Egne områder',
  kilde: 'Tegnet av deg',
  farger: [
    ['Utbygging', 'egne-bygg'],
    ['Ikke utbygging', 'egne-fri']
  ]
};

/* Kartet K viser hele kommunen */
function tilKommunen(K: OlMap) {
  const k = app.valgt,
    G = verdi(katalog.solv.grense),
    u = G ? G.ext : k && k.boks ? ol.proj.transformExtent(k.boks, 'EPSG:4326', UTM) : null;
  if (u) K.getView().fit(u, { size: K.getSize(), padding: [16, 16, 16, 16] });
}
/* Designsystemets ikoner for pluss og minus i zoomknappene fra OpenLayers, i stedet for tegnene */
function zoomIkoner(el: HTMLElement) {
  for (const [klasse, Ikon] of [
    ['.ol-zoom-in', MdIconAdd],
    ['.ol-zoom-out', MdIconRemove]
  ] as const) {
    const b = el.querySelector<HTMLButtonElement>(klasse);
    if (!b || b.dataset.ikon) continue;
    b.dataset.ikon = 'ja';
    b.textContent = '';
    createRoot(b).render(<Ikon aria-hidden="true" />);
  }
}

/* Kartet (hent, til vanlig hovedkartet) zoomer til kommunen når det settes inn, og igjen når kartet får en annen størrelse eller
   kommunegrensen kommer, til man flytter kartet selv. senere setter kartet inn først når flaten er rullet fram (kart nummer to). */
function Kartflate({ hent = lagKart, senere }: { hent?: () => OlMap; senere?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (!senere) return settInn(hent(), el);
    let rydd: (() => void) | null = null;
    const se = new IntersectionObserver(
      e => {
        if (rydd || !e.some(x => x.isIntersecting)) return;
        se.disconnect();
        rydd = settInn(hent(), el);
      },
      { rootMargin: '300px 0px' }
    );
    se.observe(el);
    return () => {
      se.disconnect();
      if (rydd) rydd();
    };
  }, []);
  return <div className="kartflate" ref={ref} />;
}
/* Setter kartet k inn i flaten el, og gir det som tar det ut igjen */
function settInn(k: OlMap, el: HTMLDivElement) {
  k.setTarget(el);
  let flyttet = false,
    grense = verdi(katalog.solv.grense);
  const flytt = () => (flyttet = true),
    r = requestAnimationFrame(() => {
      k.updateSize();
      tilKommunen(k);
      zoomIkoner(el);
    }),
    storrelse = new ResizeObserver(() => {
      k.updateSize();
      if (!flyttet) tilKommunen(k);
    }),
    slutt = abonner(() => {
      const G = verdi(katalog.solv.grense);
      if (G === grense) return;
      grense = G;
      if (!flyttet) tilKommunen(k);
    });
  el.addEventListener('pointerdown', flytt);
  el.addEventListener('wheel', flytt, { passive: true });
  el.addEventListener('keydown', flytt);
  storrelse.observe(el);
  return () => {
    cancelAnimationFrame(r);
    storrelse.disconnect();
    slutt();
    el.removeEventListener('pointerdown', flytt);
    el.removeEventListener('wheel', flytt);
    el.removeEventListener('keydown', flytt);
    k.setTarget(undefined);
  };
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
   enkel gir bare kartet, med en merkelapp nede til venstre, som på oversikten, og prikken i merkelappen har fargen enkelFarge (en
   variabel i stilen, til vanlig natur). Lag med farger som er slått på, får hver sin merkelapp under, så alt kartet viser, er
   forklart. hint gir teksten «Trykk i kartet …» under lagvelgeren før man har trykket; temasidene har den ikke, som skissene.
   eget gir et eget kart i stedet for hovedkartet, som kartet over naturen i verneområdene (kart2.ts): det får bare lagene i lag,
   settes inn først når det er rullet fram, og har ikke trykk i kartet. verktoy står oppå kartet (som tegningen av egne områder),
   underLag rett under lagene i lagvelgeren, og slipp tar imot en fil som slippes i kartet. */
export default function Kart({
  lag,
  etter,
  stor,
  enkel,
  enkelFarge = 'nat',
  hint = true,
  eget,
  verktoy,
  underLag,
  slipp
}: {
  lag: Kartlag[];
  etter?: ReactNode;
  stor?: boolean;
  enkel?: string;
  enkelFarge?: string;
  hint?: boolean;
  eget?: () => OlMap;
  verktoy?: ReactNode;
  underLag?: ReactNode;
  slipp?: (f: File) => void;
}) {
  const startSkjult = () => Object.fromEntries(lag.filter(l => l.av || l.skjul).map(l => [l.id, true]));
  const [skjult, settSkjult] = useState<Record<string, boolean>>(startSkjult),
    [lukket, settLukket] = useState<Record<string, boolean>>({}),
    [fargeAv, settFargeAv] = useState<Record<string, string[]>>({}),
    [full, settFull] = useState(false),
    [drar, settDrar] = useState(false),
    henting = hentingAvKlasser(),
    p = ui.probe,
    avPaa = lag.map(l => l.id + (l.av ? ':av' : '') + (l.skjul ? ':skjul' : '')).join();
  /* Bytter siden lagene (som kortene på oversikten), starter lagene som de er satt: av eller på, med alle fargene */
  const forrige = useRef(avPaa);
  useEffect(() => {
    if (forrige.current === avPaa) return;
    forrige.current = avPaa;
    settSkjult(startSkjult());
    settFargeAv({});
  }, [avPaa]);
  /* Lagene som er skjult, er gjennomsiktige. Dagens arealklasser og planlagt utbygging er skjult også når siden ikke har dem i
     lagvelgeren, som temasidene. Alt vises igjen når kartet tas ut av siden. */
  const ider = lag.map(l => l.id).join();
  useEffect(() => {
    if (eget) return;
    const med = new Set(ider.split(','));
    for (const [id, f] of Object.entries(OL_LAG))
      f().forEach(l => l.setOpacity(skjult[id] || ((id === 'klasser' || id === 'plan') && !med.has(id)) ? 0 : 1));
  }, [skjult, ider]);
  useEffect(() => () => void (eget || Object.values(OL_LAG).forEach(f => f().forEach(l => l.setOpacity(1)))), []);
  /* Fargene som er slått av i lag der hver farge kan velges, og alle på igjen når kartet tas ut av siden */
  useEffect(() => lag.forEach(l => l.velg && l.velg(fargeAv[l.id] || [])), [fargeAv, avPaa]);
  useEffect(() => () => lag.forEach(l => l.velg && l.velg([])), [avPaa]);
  /* Egne lag (ol, og med som følger laget): inn under planen mens kartet vises, eller under grensen i et eget kart, og synlige når
     laget er slått på */
  const egne = lag.flatMap(l => [...(l.ol ? [l.ol] : []), ...(l.med || [])].map(o => ({ id: l.id, ol: o }))),
    egneId = egne.map(e => e.id + ':' + String(e.ol.get('tittel'))).join();
  useEffect(() => {
    const k = eget ? eget() : lagKart(),
      L = k.getLayers();
    egne.forEach(e => {
      if (!L.getArray().includes(e.ol)) L.insertAt(eget ? L.getLength() - 1 : L.getArray().indexOf(planLag), e.ol);
    });
    return () => egne.forEach(e => L.remove(e.ol));
  }, [egneId]);
  useEffect(() => egne.forEach(e => e.ol.setVisible(!skjult[e.id])), [skjult, egneId]);
  useEffect(() => {
    const k = eget ? eget() : kartet;
    if (k) k.updateSize();
    if (!full) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && settFull(false);
    document.addEventListener('keydown', esc);
    document.documentElement.classList.add('kart-fullskjerm');
    return () => {
      document.removeEventListener('keydown', esc);
      document.documentElement.classList.remove('kart-fullskjerm');
    };
  }, [full]);
  /* Merkelappene i det enkle kartet: hovedmerket, og fargene i lagene som er slått på */
  const merker = enkel
    ? lag
        .filter(l => l.farger && !skjult[l.id] && !l.skjul)
        .flatMap(l => l.farger!.map(([navn, farge]) => [`${l.navn} ${navn.toLowerCase()}`, farge] as const))
    : [];
  /* En fil som dras over kartet, kan slippes der */
  const slippes = slipp
    ? {
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          settDrar(true);
        },
        onDragLeave: (e: DragEvent) => {
          if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) settDrar(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          settDrar(false);
          const f = e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) slipp(f);
        }
      }
    : {};
  const scene = (
    <div className={'kartscene' + (full ? ' full' : '') + (enkel ? ' enkel' : '')} {...slippes}>
      {eget ? <Kartflate hent={eget} senere /> : <Kartflate />}
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
      {!eget && <Bytt />}
      {verktoy}
      {drar && (
        <div className="slippflate" aria-hidden="true">
          <span>Slipp filen for å laste opp planen</span>
        </div>
      )}
      {enkel && (
        <ul className="enkel-merker">
          <li className="kartmerke enkel-merke" style={{ '--merke': `var(--${enkelFarge})` } as CSSProperties}>
            {enkel}
          </li>
          {merker.map(([navn, farge]) => (
            <li key={navn} className="kartmerke enkel-merke" style={{ '--merke': `var(--${farge})` } as CSSProperties}>
              {navn}
            </li>
          ))}
        </ul>
      )}
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
            {lag
              .filter(l => !l.skjul)
              .map(l => {
                const flere = !!l.farger && l.farger.length > 1,
                  apen = flere && !skjult[l.id] && !lukket[l.id],
                  av = fargeAv[l.id] || [];
                return (
                  <li key={l.id}>
                    <div className="lagrad">
                      {flere ? (
                        <button
                          type="button"
                          className={'lagpil' + (apen ? ' apen' : '')}
                          aria-expanded={apen}
                          aria-controls={`farger-${l.id}`}
                          aria-label={`${apen ? 'Skjul' : 'Vis'} fargene i ${l.navn}`}
                          disabled={!!skjult[l.id]}
                          onClick={() => settLukket({ ...lukket, [l.id]: apen })}
                        >
                          <MdIconKeyboardArrowDown aria-hidden="true" />
                        </button>
                      ) : (
                        <i className="lagfarge" style={l.farger ? fargeStil(l.farger[0][1]) : undefined} />
                      )}
                      <label className="lagnavn" htmlFor={`lag-${l.id}`}>
                        <b>{l.navn}</b>
                        <small>Kilde: {l.kilde}</small>
                      </label>
                      <input
                        id={`lag-${l.id}`}
                        type="checkbox"
                        className="lagvalg"
                        checked={!skjult[l.id]}
                        onChange={e => settSkjult({ ...skjult, [l.id]: !e.target.checked })}
                      />
                    </div>
                    {apen && (
                      <ul className="farger" id={`farger-${l.id}`}>
                        {l.farger!.map(([navn, farge]) => (
                          <li key={navn}>
                            <i style={fargeStil(farge)} />
                            {l.velg ? (
                              <>
                                <label htmlFor={`farge-${l.id}-${farge}`}>{navn}</label>
                                <input
                                  id={`farge-${l.id}-${farge}`}
                                  type="checkbox"
                                  className="lagvalg"
                                  checked={!av.includes(farge)}
                                  onChange={e =>
                                    settFargeAv({
                                      ...fargeAv,
                                      [l.id]: e.target.checked ? av.filter(f => f !== farge) : [...av, farge]
                                    })
                                  }
                                />
                              </>
                            ) : (
                              <span>{navn}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ul>
          {underLag}
          {!eget && (p || hint) && (
            <p className="probe">
              {!p ? 'Trykk i kartet for å se hva som er der.' : p.punkt ? <b>{p.punkt}</b> : p.tekst}
            </p>
          )}
          {etter && <div className="lag-etter">{etter}</div>}
        </div>
      </div>
    </section>
  );
}
