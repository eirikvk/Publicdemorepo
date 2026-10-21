/* Delene sidene i tvillingen er bygd av, etter Figma-skissene: brødsmuler, toppen av en temaside, tallkort, trekkspill, figurer med
   tekst og kilde, stolper, flisene for temaene, ressurser, og en ramme for det som ikke er laget ennå. Bildene fra skissene er ikke med
   (rettighetene er ikke avklart), så hvert tema har en KI-generert illustrasjon i stedet, merket med det. Tallkortene og figurene kan
   ha et spørsmålstegn med forklaringen bak tallene, som infoknappen på hovedsiden, slått av og på i flagg.ts. */
import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { KILDE } from '../../src/data/katalog.ts';
import { MdAccordionItem, MdIconArrowForward, MdIconChevronForward, MdIconOpenInNew } from '../md.ts';
import { andelTekst, iTekst, nf, pst } from '../tekst.ts';
import { lenke, type Rute } from '../navigasjon.ts';
import { Illustrasjon } from '../illustrasjoner.tsx';
import { GRUPPER, TEMAER, type Tema } from '../temaer.ts';
import { sammenligning, temaflis, type Svar } from '../tall.ts';
import { useInfoknapp, type Se } from '../../src/ui/komponenter/Infoknapp.tsx';
import { ankerFor, REPO } from '../../src/ui/forklaringer.ts';
import { vises, type Sted } from '../flagg.ts';

/* En lenke til en side i tvillingen */
export function Lenke({
  til,
  children,
  className,
  naa
}: {
  til: Rute;
  children: ReactNode;
  className?: string;
  naa?: boolean;
}) {
  return (
    <a className={className} aria-current={naa ? 'page' : undefined} {...lenke(til)}>
      {children}
    </a>
  );
}

/* Pilen for en endring, som i skissene: opp eller ned i sikksakk (trending_up og trending_down fra Material Icons, Apache 2.0) */
export const Trend = ({ opp }: { opp: boolean }) => (
  <svg className="trend" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={
        opp
          ? 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z'
          : 'M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z'
      }
      fill="currentColor"
    />
  </svg>
);
/* En endring som merke med pil: opp eller ned, med endringen i prosent (pst). Uten pil når det ikke er noen endring. */
export const Endringsmerke = ({ d, pst }: { d: number; pst: number | null }) => (
  <span className="endringsmerke">
    {d !== 0 && <Trend opp={d > 0} />}
    <span className="skjult">{d > 0 ? 'Opp' : d < 0 ? 'Ned' : 'Uendret'}</span>
    {pst !== null ? andelTekst(Math.abs(pst)) : '– %'}
  </span>
);

/* Et tall som hentes, som tekst: verdien når den er der, ellers henter, feil eller ingen */
export function svar<T>(S: Svar<T>, vis: (v: T) => ReactNode, ingen = 'Ingen i kommunen'): ReactNode {
  if (S.s === 'ok') return vis(S.v);
  if (S.s === 'mangler') return <span className="mangler-tall">{S.hvorfor}</span>;
  return S.s === 'henter' ? <span className="henter">Henter …</span> : S.s === 'feil' ? 'Kunne ikke hentes' : ingen;
}

export function Brodsmuler({ tema }: { tema: Tema }) {
  return (
    <nav className="brodsmuler" aria-label="Du er her">
      <Lenke til={{ side: 'utforsk' }}>Utforsk naturen</Lenke>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{tema.navn}</span>
    </nav>
  );
}

/* Bildet for temaet: illustrasjonen (illustrasjoner.tsx), på temaets farge mens den tegnes, merket som KI-generert */
export const Bilde = ({ tema, farge, liten }: { tema: string; farge: string; liten?: boolean }) => (
  <div
    className={'bilde' + (liten ? ' liten' : '')}
    style={{ ['--farge' as string]: `var(--${farge})` }}
    aria-hidden="true"
  >
    <Illustrasjon tema={tema} />
    <span className="ki-merke">{liten ? 'KI-generert' : 'KI-generert illustrasjon'}</span>
  </div>
);

/* Ikonet for et tema i den runde flaten ved tittelen, som i skissene: en gran for skog, en fylt øyenstikker på skrå for våtmark, et
   reinsdyrhode med gevir for villrein, hus og tre for bynaturen, og en bok for de andre (som skissene). Sidene som ikke er tegnet, har
   egne: en pil som går ned for naturtapet, og lag over hverandre for arealklassene i kartet. */
const IKON: Record<string, ReactNode> = {
  skog: <path d="M12 3v18M12 6 9 9m3-3 3 3m-3 1-4 4m4-4 4 4m-4 0-5 4m5-4 5 4" />,
  vatmark: (
    <g transform="rotate(45 12 12)" fill="currentColor" stroke="none">
      <circle cx="12" cy="4.6" r="1.8" />
      <rect x="11.2" y="6.4" width="1.6" height="15.4" rx="0.8" />
      <ellipse cx="6.8" cy="8" rx="5" ry="1.3" transform="rotate(-14 6.8 8)" />
      <ellipse cx="17.2" cy="8" rx="5" ry="1.3" transform="rotate(14 17.2 8)" />
      <ellipse cx="7.3" cy="11.3" rx="4.4" ry="1.2" transform="rotate(12 7.3 11.3)" />
      <ellipse cx="16.7" cy="11.3" rx="4.4" ry="1.2" transform="rotate(-12 16.7 11.3)" />
    </g>
  ),
  villrein: (
    <path d="M8.5 11h7v3.5c0 2.8-1.6 5.5-3.5 5.5s-3.5-2.7-3.5-5.5zM8.5 12 5.5 10.5M15.5 12l3-1.5M10 11 7.5 4M8.6 7.2 5.5 6M8 5.6l1.3-2.1M14 11l2.5-7M15.4 7.2l3.1-1.2M16 5.6l-1.3-2.1" />
  ),
  bynatur: <path d="M3 21V10h6v11m0 0V5h6v16m3 0v-5m0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 21h20" />,
  bok: <path d="M6 3.5h11.5v14H7.5A1.5 1.5 0 0 0 6 19V3.5zm0 15.5a1.5 1.5 0 0 0 1.5 1.5h10v-3M9.5 3.5v14" />,
  utbygging: <path d="M3 6.5l6.5 6.5 4-4 7.5 7.5M21 11v5.5h-5.5" />,
  arealklasser: <path d="M12 3.5 3 8l9 4.5L21 8zM3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5" />
};
/* Symbolet for temaet alene, uten den runde flaten, som i valgene over kartet */
export const Temasymbol = ({ id }: { id: string }) => (
  <svg
    className="temasymbol"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {IKON[id] || IKON.bok}
  </svg>
);
export const TemaIkon = ({ id }: { id: string }) => (
  <span className="temaikon" aria-hidden="true">
    <Temasymbol id={id} />
  </span>
);

/* Toppen av en temaside: ikonet og tittelen, ingressen (avsnitt skilt med tom linje), trekkspillene under, og bildet ved siden av
   (under ingressen på mobil). ikon og bilde gir et annet ikon og en annen illustrasjon enn temaets, som på naturtapet. */
export function Helt({
  tema,
  ikon = tema.id,
  bilde = tema.id,
  children
}: {
  tema: Tema;
  ikon?: string;
  bilde?: string;
  children?: ReactNode;
}) {
  return (
    <section className="helt">
      <div className="helt-tekst">
        <h1 className="md-typography-heading-xl">
          <TemaIkon id={ikon} />
          {tema.navn}
        </h1>
        {tema.ingress.split('\n\n').map(a => (
          <p className="ingress" key={a}>
            {a}
          </p>
        ))}
      </div>
      <Bilde tema={bilde} farge={tema.farge} />
      {children && <div className="trekkspill-liste">{children}</div>}
    </section>
  );
}

/* Merket øverst på sidene som ikke er tegnet i skissene: oppsettet og teksten er et forslag, laget med KI */
export const Forslag = () => (
  <p className="forslag-merke">Ikke tegnet i skissene. Oppsettet og teksten er et KI-generert forslag.</p>
);

/* Et tall merket i en setning, som i de blå båndene */
export const Merket = ({ children }: { children: ReactNode }) => <span className="tallmerke">{children}</span>;
/* Hvor de syntetiske tallene kommer fra */
export const SYNTETISK_TEKST =
  'Tallene er syntetiske, til SSBs tabeller for naturregnskapet kommer 25. november 2026. De er laget av SSBs arealstatistikk for 2017 og 2024, som ikke måler endring direkte, og hvor mye som er bygget ned, er anslått med en fast regel. De skal bare ha riktig størrelsesorden.';
/* Merket som sier at tallene er syntetiske */
export const Syntetisk = () => <p className="syntetisk-merke">Syntetiske tall</p>;

/* Et blått bånd med en setning med merkede tall, og illustrasjonen ved siden av (til høyre når speilet), til vanlig utbyggingen */
export function Baand({
  children,
  speilet,
  bilde = 'utbygging'
}: {
  children: ReactNode;
  speilet?: boolean;
  bilde?: string;
}) {
  return (
    <section className={'baand' + (speilet ? ' speilet' : '')}>
      <div className="innhold baand-rute">
        <Bilde tema={bilde} farge="beb" />
        <div className="baand-innhold">{children}</div>
      </div>
    </section>
  );
}

/* Ett trekkspill med pluss, som i skissene */
export const Trekkspill = ({ tittel, children, merke }: { tittel: string; children: ReactNode; merke?: string }) => (
  <MdAccordionItem
    label={tittel}
    theme="add"
    hideCloseButton
    headerContent={merke ? <span className="trekk-merke">{merke}</span> : undefined}
  >
    <div className="trekkspill-innhold">{children}</div>
  </MdAccordionItem>
);

/* Et spørsmålstegn med forklaringen bak tallene: stedet (flagget i flagg.ts), id-en til kortet i src/ui/forklaringer.ts, og for et
   kort med én infoboks per tall, tabellen i gull for tallet som står her */
export type Forklaring = [sted: Sted, kort: string, tall?: string];
/* Et steg et annet kort forklarer, lenker til kapitlet i METODE.md, fordi sidene på hovedsiden ikke finnes her */
const tilMetoden: Se = k => (
  <a href={REPO + 'METODE.md#' + ankerFor(k)} target="_blank" rel="noopener">
    {k.tittel}
  </a>
);
/* Spørsmålstegnet og panelet for forklaringen f, eller ingenting når stedet er slått av */
export const useSporsmal = (f?: Forklaring) => useInfoknapp(f && vises(f[0]) ? f[1] : null, tilMetoden, f && f[2]);
/* En overskrift med spørsmålstegnet ved siden av, og panelet med forklaringen rett under når det er trykket */
export function MedSporsmal({ forklaring, children }: { forklaring?: Forklaring; children: ReactNode }) {
  const { knapp, panel } = useSporsmal(forklaring);
  if (!knapp) return children;
  return (
    <>
      <div className="korttittel">
        {children}
        {knapp}
      </div>
      {panel}
    </>
  );
}

/* Ett tallkort: etiketten med spørsmålstegnet, panelet med forklaringen under etiketten når det er åpent, og tallet */
function Tall({ etikett, tall, forklaring }: { etikett: string; tall: ReactNode; forklaring?: Forklaring }) {
  const { knapp, panel } = useSporsmal(forklaring);
  return (
    <div className={panel ? 'apen' : undefined}>
      <dt className={knapp ? 'korttittel' : undefined}>
        {knapp ? <span>{etikett}</span> : etikett}
        {knapp}
      </dt>
      {panel && <dd className="tallkort-forklaring">{panel}</dd>}
      <dd>{tall}</dd>
    </div>
  );
}
/* Tallkortene øverst: [etikett, tallet, spørsmålstegnet] */
export const Tallkort = ({ kort }: { kort: [etikett: string, tall: ReactNode, forklaring?: Forklaring][] }) => (
  <dl className="tallkort">
    {kort.map(([etikett, tall, forklaring]) => (
      <Tall key={etikett} etikett={etikett} tall={tall} forklaring={forklaring} />
    ))}
  </dl>
);

/* Kilden under en figur, med lenke til datasettet */
export function Kilde({ kilder }: { kilder: (keyof typeof KILDE)[] }) {
  if (!kilder.length) return null;
  return (
    <div className="kilde">
      <b>Kilde:</b>
      {kilder.map(k => (
        <a key={k} href={KILDE[k].adresse} target="_blank" rel="noopener">
          {KILDE[k].datasett}, {KILDE[k].navn}
        </a>
      ))}
    </div>
  );
}

/* En figur: tittel, tekst og kilde til venstre, figuren til høyre i en lys flate (under på mobil), og trekkspill under (etter). Er
   figuren ikke laget ennå (tom), står flaten tom med et merke og hva som trengs. Spørsmålstegnet (forklaring) står ved tittelen. */
export function Figur({
  tittel,
  tekst,
  kilder,
  children,
  etter,
  tom,
  merke,
  forklaring
}: {
  tittel: string;
  tekst: ReactNode;
  kilder: (keyof typeof KILDE)[];
  children?: ReactNode;
  etter?: ReactNode;
  tom?: string;
  merke?: string;
  forklaring?: Forklaring;
}) {
  return (
    <section className="figur">
      <div className="figur-tekst">
        <MedSporsmal forklaring={forklaring}>
          <h2 className="figur-tittel md-typography-heading-s">{tittel}</h2>
        </MedSporsmal>
        <div className="figur-forklaring">{tekst}</div>
        <Kilde kilder={kilder} />
      </div>
      <div className={'figur-flate' + (tom ? ' tom' : '')}>
        {tom ? (
          <div className="figur-tom">
            <span className="mangler-merke">{merke || 'Ikke laget ennå'}</span>
            <p>Krever: {tom}</p>
          </div>
        ) : (
          children
        )}
      </div>
      {etter && <div className="trekkspill-liste figur-etter">{etter}</div>}
    </section>
  );
}

/* Lange sammensatte ord i navnene under stolpene og i kolonnenavnene med myke bindestreker, så de deles mellom leddene og ikke midt
   i et ledd, på smale skjermer og når mange stolper står ved siden av hverandre */
const SAMMENSATTE = [
  ['Villmarks', 'preget'],
  ['Inngreps', 'nær'],
  ['Nasjonal', 'park'],
  ['Natur', 'reservat'],
  ['Landskaps', 'vern', 'område'],
  ['Arts', 'fredning'],
  ['verne', 'område'],
  ['Blandings', 'skog']
].map(
  d =>
    [
      new RegExp(d.join(''), 'i'),
      (m: string) =>
        d.reduce((u, del, i) => {
          const fra = d.slice(0, i).join('').length;
          return u + (i ? '\u00ad' : '') + m.slice(fra, fra + del.length);
        }, '')
    ] as const
);
const deleOrd = (t: string) => SAMMENSATTE.reduce((u, [r, f]) => u.replace(r, f), t);
/* Stående stolper med arealet over og navnet under, i kartets farger. smale gir smale stolper med runde hjørner, og brede stolper
   som fyller hele bredden, som i figurene i skissene. Er det for trangt, står stolpene liggende (Liggende). */
export interface Stolpe {
  navn: string;
  km2: number;
  farge: string;
  under?: string;
}
export function Stolper({
  data,
  hva,
  smale,
  brede
}: {
  data: Stolpe[];
  hva: string;
  smale?: boolean;
  brede?: boolean;
}) {
  const [ref, B] = useBredde(),
    maks = Math.max(...data.map(d => d.km2), 1e-9);
  /* Mange stolper på en smal skjerm, som de seks verneformene på telefon, får ikke plass til navnene og tallene, så de står liggende */
  if (data.length > 4 && B / data.length < 90)
    return (
      <div ref={ref as RefObject<HTMLDivElement>}>
        <Liggende data={data} hva={hva} />
      </div>
    );
  return (
    <figure ref={ref} className={'stolper' + (smale ? ' smale' : '') + (brede ? ' brede' : '')} aria-label={hva}>
      {data.map(d => (
        <div className="stolpe" key={d.navn}>
          <div className="stolpe-ramme">
            <span className="stolpe-tall">{iTekst(d.km2)}</span>
            <div
              className="stolpe-fyll"
              style={{ height: `${Math.max(2, (d.km2 / maks) * 280)}px`, background: `var(--${d.farge})` }}
            />
          </div>
          <span className="stolpe-navn">
            {deleOrd(d.navn)}
            {d.under && <small>{d.under}</small>}
          </span>
        </div>
      ))}
    </figure>
  );
}

/* Et kakediagram med navnet og arealet ved hver bit, som i skissene. prikker gir biten et prikkete mønster (tresatt myr og beite).
   Bitene står med klokka fra toppen, de minste først, eller i rekkefølgen de er gitt (fast). Navnene står utenfor kaken, på samme
   side som biten, og flyttes fra hverandre når de ville kommet for tett. */
export function Kake({ data, hva, fast }: { data: (Stolpe & { prikker?: boolean })[]; hva: string; fast?: boolean }) {
  const id = useId().replace(/:/g, ''),
    sum = data.reduce((a, d) => a + d.km2, 0) || 1,
    R = 176,
    cx = 400,
    cy = 220;
  let v = -Math.PI / 2;
  /* De minste bitene først, så de står øverst til høyre, som i skissene, eller i rekkefølgen de er gitt */
  const biter = [...data]
    .filter(d => d.km2 > 0)
    .sort((a, b) => (fast ? 0 : a.km2 - b.km2))
    .map(d => {
      const a0 = v,
        a1 = v + (d.km2 / sum) * 2 * Math.PI;
      v = a1;
      return { ...d, a0, a1, m: (a0 + a1) / 2 };
    });
  const pkt = (a: number, r: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const bue = (a0: number, a1: number) => {
    if (a1 - a0 > 2 * Math.PI - 1e-6) return null;
    const [x0, y0] = pkt(a0, R),
      [x1, y1] = pkt(a1, R);
    return `M${cx} ${cy}L${x0} ${y0}A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`;
  };
  /* Navnene: i en kolonne til høyre eller venstre for kaken, på høyde med biten og flyttet ned så de ikke overlapper, med en strek
     inn til biten */
  const navn = biter.map(b => {
    const hoyre = Math.cos(b.m) >= 0,
      [px, py] = pkt(b.m, R - 6);
    return { b, hoyre, px, py, x: hoyre ? cx + R + 36 : cx - R - 36, y: cy + (R + 10) * Math.sin(b.m) };
  });
  for (const side of [true, false]) {
    const l = navn.filter(n => n.hoyre === side).sort((a, b) => a.y - b.y);
    for (let i = 1; i < l.length; i++) if (l[i].y - l[i - 1].y < 48) l[i].y = l[i - 1].y + 48;
  }
  return (
    <figure className="kake" aria-label={hva}>
      <svg viewBox="0 0 800 440" role="img">
        <defs>
          {biter
            .filter(b => b.prikker)
            .map(b => (
              <pattern key={b.farge} id={`${id}-${b.farge}`} width="12" height="12" patternUnits="userSpaceOnUse">
                <rect width="12" height="12" fill={`var(--${b.farge})`} />
                <circle cx="6" cy="6" r="1.7" fill="rgb(0 0 0 / 0.28)" />
              </pattern>
            ))}
        </defs>
        {biter.map(b => {
          const d = bue(b.a0, b.a1),
            fyll = b.prikker ? `url(#${id}-${b.farge})` : `var(--${b.farge})`;
          return d ? (
            <path key={b.navn} d={d} fill={fyll} />
          ) : (
            <circle key={b.navn} cx={cx} cy={cy} r={R} fill={fyll} />
          );
        })}
        {navn.map(({ b, x, y, hoyre, px, py }) => (
          <polyline
            key={'s' + b.navn}
            points={`${px},${py} ${hoyre ? x - 8 : x + 8},${y - 5}`}
            fill="none"
            stroke="var(--tekst)"
            strokeWidth="1"
          />
        ))}
        {navn.map(({ b, x, y, hoyre }) => (
          <text key={b.navn} x={x} y={y} textAnchor={hoyre ? 'start' : 'end'} className="kake-navn">
            <tspan fontWeight="600">{b.navn}</tspan>
            <tspan x={x} dy="20">
              {iTekst(b.km2)} ({andelTekst((b.km2 / sum) * 100)})
            </tspan>
          </text>
        ))}
      </svg>
    </figure>
  );
}

/* Liggende stolper med tallet etter, til lange navn */
export function Liggende({ data, hva, tekst }: { data: Stolpe[]; hva: string; tekst?: (d: Stolpe) => string }) {
  const maks = Math.max(...data.map(d => Math.abs(d.km2)), 1e-9);
  return (
    <figure className="liggende" aria-label={hva}>
      {data.map(d => (
        <div className="liggende-rad" key={d.navn}>
          <span className="liggende-navn">{d.navn}</span>
          <span className="liggende-ramme">
            <span
              className="liggende-fyll"
              style={{
                width: `calc((100% - 9.5em) * ${Math.max(0.005, Math.abs(d.km2) / maks)})`,
                background: `var(--${d.farge})`
              }}
            />
            <span className="liggende-tall">{tekst ? tekst(d) : iTekst(d.km2)}</span>
          </span>
        </div>
      ))}
    </figure>
  );
}

/* Liggende stolper i par, til å sammenligne to planer: for hver rad en hul stolpe for den første (for, til vanlig kommuneplanen alene)
   og en fylt stolpe i radens farge for den andre (etter, med egne områder), med tallet etter hver og forskjellen etter den andre.
   Forskjellen i fyll, ikke i farge, skiller planene, så den kan leses uten fargesyn og på utskrift. for er null når det ikke er noe
   å sammenligne med (kommunen har ingen kommuneplan), og da står bare den fylte. Tallene står også i en tabell som kan åpnes. */
export interface Par {
  navn: string;
  farge: string;
  for: number | null;
  etter: number;
  endring: number;
}
const endringDaa = (km2: number) =>
  Math.abs(km2) * 1000 < 0.5 ? '0' : (km2 > 0 ? '+' : '−') + nf(Math.abs(km2) * 1000, 0);
export function Parstolper({
  data,
  hva,
  navnFor = 'Kommuneplanen alene',
  navnEtter = 'Med egne områder'
}: {
  data: Par[];
  hva: string;
  navnFor?: string;
  navnEtter?: string;
}) {
  const maks = Math.max(...data.flatMap(d => [d.for || 0, d.etter]), 1e-9),
    bredde = (km2: number) => `calc((100% - 10em) * ${Math.max(0.004, km2 / maks)})`;
  return (
    <figure className="parstolper" aria-label={hva}>
      <ul className="figur-tegn">
        <li>
          <i className="par-hul" />
          {navnFor}
        </li>
        <li>
          <i className="par-fylt" />
          {navnEtter}
        </li>
      </ul>
      {data.map(d => (
        <div className="par-rad" key={d.navn}>
          <span className="par-navn">{d.navn}</span>
          <span className="par-stolper">
            {d.for !== null && (
              <span className="par-linje">
                <span className="par-fyll par-hul" style={{ width: bredde(d.for) }} />
                <span className="par-tall">{iTekst(d.for)}</span>
              </span>
            )}
            <span className="par-linje">
              <span className="par-fyll" style={{ width: bredde(d.etter), background: `var(--${d.farge})` }} />
              <span className="par-tall">
                {iTekst(d.etter)}
                {d.for !== null && Math.abs(d.endring) * 1000 >= 0.5 && (
                  <b className="par-endring">{endringDaa(d.endring)}</b>
                )}
              </span>
            </span>
          </span>
        </div>
      ))}
      <Talltabell
        hode={['Planlagt utbygging på, daa', navnFor, navnEtter, 'Endring']}
        rader={data.map(d => [
          d.navn,
          d.for === null ? '–' : daa(d.for),
          daa(d.etter),
          d.for === null ? '–' : endringDaa(d.endring)
        ])}
      />
    </figure>
  );
}

/* Rene tall for aksene: steget mellom strekene (1, 2 eller 5 ganger en tierpotens) som gir omtrent n streker opp til maks */
function steg(maks: number, n = 4) {
  const r = maks / n,
    p = 10 ** Math.floor(Math.log10(r || 1)),
    f = r / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
/* Bredden figuren har på skjermen, til figurene under: de tegnes i den bredden, så teksten står i vanlig størrelse også på telefon.
   Til den er målt, er den 760. */
function useBredde(): [RefObject<HTMLElement | null>, number] {
  const ref = useRef<HTMLElement | null>(null),
    [b, settB] = useState(760);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mal = () => settB(Math.max(280, Math.round(el.clientWidth)));
    mal();
    const R = new ResizeObserver(mal);
    R.observe(el);
    return () => R.disconnect();
  }, []);
  return [ref, b];
}
/* Tallene i figuren i en tabell som kan åpnes, så de kan leses uten å tolke fargene og høydene. Tabellen ruller til siden når den er
   bredere enn figuren, som på telefon, så siden ikke blir bredere. */
function Talltabell({ hode, rader }: { hode: string[]; rader: string[][] }) {
  return (
    <details className="figurtall">
      <summary>Vis tallene</summary>
      <div className="figurtall-rull">
        <table>
          <thead>
            <tr>
              {hode.map((h, i) => (
                <th key={h} scope="col" className={i ? 'tall' : undefined}>
                  {deleOrd(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rader.map(r => (
              <tr key={r[0]}>
                {r.map((c, i) =>
                  i ? (
                    <td key={i} className="tall">
                      {c}
                    </td>
                  ) : (
                    <th key={i} scope="row">
                      {c}
                    </th>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
/* Dekar uten enhet, til aksene og tabellene */
const daa = (km2: number) => nf(km2 * 1000, 0);

/* En linje over tid: arealet (km2) per år, med årene i riktig avstand fra hverandre og aksen fra null, så endringen ikke ser større
   ut enn den er. Tallet står ved første og siste punkt, og hvert punkt har tallet når man holder over det. Én serie, så navnet står
   i figurens tittel. Figuren tegnes i bredden den har på skjermen, og på smale skjermer står bare årstallene det er plass til. */
export function Linje({ punkter, hva }: { punkter: { aar: number; km2: number }[]; hva: string }) {
  const [ref, B] = useBredde(),
    H = B < 520 ? 260 : 320,
    v = 72,
    h = 28,
    o = 28,
    u = 40,
    a0 = punkter[0].aar,
    a1 = punkter[punkter.length - 1].aar,
    s = steg(Math.max(...punkter.map(p => p.km2), 1e-9) * 1.15),
    maks = Math.ceil((Math.max(...punkter.map(p => p.km2), 1e-9) * 1.15) / s) * s,
    x = (a: number) => v + ((a - a0) / (a1 - a0 || 1)) * (B - v - h),
    y = (km2: number) => o + (1 - km2 / maks) * (H - o - u),
    streker = Array.from({ length: Math.round(maks / s) + 1 }, (_, i) => i * s);
  /* Årstallene under aksen med minst 44 px mellom, og alltid det siste */
  const aarstall: number[] = [];
  punkter.forEach((p, i) => {
    const forrige = aarstall.length ? x(punkter[aarstall[aarstall.length - 1]].aar) : -Infinity;
    if (x(p.aar) - forrige < 44) {
      if (i < punkter.length - 1) return;
      aarstall.pop();
    }
    aarstall.push(i);
  });
  return (
    <figure className="linje" aria-label={hva} ref={ref}>
      <svg viewBox={`0 0 ${B} ${H}`} role="img" aria-label={hva}>
        {streker.map(t => (
          <g key={t}>
            <line x1={v} x2={B - h} y1={y(t)} y2={y(t)} className="linje-strek" />
            <text x={v - 10} y={y(t) + 4} textAnchor="end" className="linje-akse">
              {daa(t)}
            </text>
          </g>
        ))}
        <text x={v - 10} y={o - 12} textAnchor="end" className="linje-akse">
          dekar
        </text>
        {aarstall.map(i => (
          <text key={punkter[i].aar} x={x(punkter[i].aar)} y={H - u + 22} textAnchor="middle" className="linje-akse">
            {punkter[i].aar}
          </text>
        ))}
        <polyline points={punkter.map(p => `${x(p.aar)},${y(p.km2)}`).join(' ')} className="linje-linje" />
        {punkter.map((p, i) => (
          <g key={p.aar}>
            <circle cx={x(p.aar)} cy={y(p.km2)} r="5" className="linje-punkt">
              <title>{`${p.aar}: ${daa(p.km2)} dekar`}</title>
            </circle>
            {(i === 0 || i === punkter.length - 1) && (
              <text x={x(p.aar)} y={y(p.km2) - 14} textAnchor={i ? 'end' : 'start'} className="linje-tall">
                {daa(p.km2)} dekar
              </text>
            )}
          </g>
        ))}
      </svg>
      <Talltabell hode={['År', 'Dekar']} rader={punkter.map(p => [String(p.aar), daa(p.km2)])} />
    </figure>
  );
}

/* Stolper over og under null for endringen i hver periode, én stolpe per serie (som sonene), med tegnforklaringen over. Hver stolpe
   har tallet når man holder over den, og alle tallene står i tabellen under. Figuren tegnes i bredden den har på skjermen, og på smale
   skjermer står periodene på to linjer. */
export function Endringsstolper({
  perioder,
  serier,
  hva
}: {
  perioder: { navn: string; km2: number[] }[];
  serier: { navn: string; farge: string }[];
  hva: string;
}) {
  const [ref, B] = useBredde(),
    smal = (B - 84) / perioder.length < 90,
    H = smal ? 300 : 356,
    v = 72,
    h = 12,
    o = 34,
    u = smal ? 58 : 44,
    alle = perioder.flatMap(p => p.km2),
    st = steg(Math.max(Math.max(...alle), -Math.min(...alle), 1e-9) * 1.1),
    topp = Math.max(st, Math.ceil(Math.max(...alle, 0) / st) * st),
    bunn = Math.min(0, Math.floor(Math.min(...alle, 0) / st) * st),
    y = (km2: number) => o + ((topp - km2) / (topp - bunn)) * (H - o - u),
    band = (B - v - h) / perioder.length,
    bredde = Math.min(24, (band * 0.7) / serier.length - 2),
    streker = Array.from({ length: Math.round((topp - bunn) / st) + 1 }, (_, i) => bunn + i * st);
  /* En stolpe fra null med runde hjørner (4 px) bare i enden med tallet */
  const stolpe = (x: number, km2: number) => {
    const y0 = y(0),
      y1 = y(km2),
      r = Math.min(4, Math.abs(y1 - y0) / 2, bredde / 2);
    if (km2 >= 0)
      return `M${x} ${y0}V${y1 + r}Q${x} ${y1} ${x + r} ${y1}H${x + bredde - r}Q${x + bredde} ${y1} ${x + bredde} ${y1 + r}V${y0}Z`;
    return `M${x} ${y0}V${y1 - r}Q${x} ${y1} ${x + r} ${y1}H${x + bredde - r}Q${x + bredde} ${y1} ${x + bredde} ${y1 - r}V${y0}Z`;
  };
  return (
    <figure className="endringsstolper" aria-label={hva} ref={ref}>
      <ul className="figur-tegn">
        {serier.map(s => (
          <li key={s.navn}>
            <i style={{ background: `var(--${s.farge})` }} />
            {s.navn}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${B} ${H}`} role="img" aria-label={hva}>
        {streker.map(t => (
          <g key={t}>
            <line x1={v} x2={B - h} y1={y(t)} y2={y(t)} className={t === 0 ? 'linje-null' : 'linje-strek'} />
            <text x={v - 10} y={y(t) + 4} textAnchor="end" className="linje-akse">
              {t > 0 ? '+' : ''}
              {daa(t).replace('-', '−')}
            </text>
          </g>
        ))}
        <text x={v - 10} y={14} textAnchor="end" className="linje-akse">
          dekar
        </text>
        {perioder.map((p, i) => {
          const x0 = v + i * band + (band - serier.length * (bredde + 2)) / 2;
          return (
            <g key={p.navn}>
              {p.km2.map((k, j) =>
                Math.abs(k) * 1000 < 0.5 ? null : (
                  <path key={j} d={stolpe(x0 + j * (bredde + 2), k)} fill={`var(--${serier[j].farge})`}>
                    <title>{`${serier[j].navn}, ${p.navn}: ${k > 0 ? '+' : '−'}${daa(Math.abs(k))} dekar`}</title>
                  </path>
                )
              )}
              {/* Perioden på to linjer når det er smalt: «1988–» og «2008» */}
              <text x={v + i * band + band / 2} y={H - u + 24} textAnchor="middle" className="linje-akse">
                {smal ? (
                  <>
                    <tspan x={v + i * band + band / 2}>{p.navn.split('–')[0]}–</tspan>
                    <tspan x={v + i * band + band / 2} dy="16">
                      {p.navn.split('–')[1]}
                    </tspan>
                  </>
                ) : (
                  p.navn
                )}
              </text>
            </g>
          );
        })}
      </svg>
      <Talltabell
        hode={['Periode', ...serier.map(s => s.navn)]}
        rader={perioder.map(p => [
          p.navn,
          ...p.km2.map(k => (Math.abs(k) * 1000 < 0.5 ? '0' : (k > 0 ? '+' : '−') + daa(Math.abs(k))))
        ])}
      />
    </figure>
  );
}

/* Et felt i skissen som ikke er laget ennå: hva det skal vise, og hva som trengs. merke står øverst (til vanlig «Ikke laget ennå»). */
export const Mangler = ({ tittel, trenger, merke }: { tittel: string; trenger: string; merke?: string }) => (
  <section className="mangler">
    <span className="mangler-merke">{merke || 'Ikke laget ennå'}</span>
    <h2 className="md-typography-heading-m">{tittel}</h2>
    <p>Krever: {trenger}</p>
  </section>
);

/* En fremhevet melding, som planlagt utbygging i temaet */
export const Fremhevet = ({ children, varsel }: { children: ReactNode; varsel?: boolean }) => (
  <div className={'fremhevet' + (varsel ? ' varsel' : '')}>{children}</div>
);

/* Ressurser: lenker ut, i to kolonner. Uten lenker vises ikke delen. */
export function Ressurser({ lenker }: { lenker: [tekst: string, url: string][] }) {
  if (!lenker.length) return null;
  return (
    <section className="ressurser">
      <h2 className="md-typography-heading-m">Ressurser</h2>
      <ul>
        {lenker.map(([tekst, url]) => {
          const ut = /^https?:/.test(url);
          return (
            <li key={tekst}>
              <a href={url} {...(ut ? { target: '_blank', rel: 'noopener' } : {})}>
                <span>
                  {tekst}
                  {ut && <MdIconOpenInNew aria-label="(åpnes i ny fane)" />}
                </span>
                <MdIconChevronForward aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* Ofte stilte spørsmål: [spørsmål, svar]. Tegningene har ingen svar, så alle svarene her er skrevet med KI fra offentlige kilder, som et
   reelt forsøk, og er merket som plassholdertekst til Miljødirektoratet har skrevet de faktiske svarene. */
export function Sporsmal({ liste }: { liste: [sporsmal: string, svar: ReactNode][] }) {
  return (
    <section className="sporsmal">
      <h2 className="md-typography-heading-m">Ofte stilte spørsmål</h2>
      {liste.map(([s, sv]) => (
        <Trekkspill key={s} tittel={s}>
          {sv}
          <p className="ki-tekst">KI-generert plassholdertekst</p>
        </Trekkspill>
      ))}
    </section>
  );
}

/* «Utforsk neste perspektiv»: en flis per tema, alle temaene i rekkefølgen fra skissene */
const NESTE = ['skog', 'vatmark', 'verdsatte-naturtyper', 'verneomrader', 'villrein', 'inngrepsfri-natur', 'bynatur'];
export function NestePerspektiv() {
  return (
    <section className="neste">
      <h2 className="md-typography-heading-m">Utforsk neste perspektiv</h2>
      <ul className="fliser">
        {NESTE.map(id => TEMAER.find(t => t.id === id)!).map(t => (
          <li key={t.id}>
            <Lenke til={{ side: 'utforsk', tema: t.id }} className="flis">
              <Bilde tema={t.id} farge={t.farge} liten />
              <span className="flis-navn">{t.navn}</span>
              <MdIconArrowForward aria-hidden="true" />
            </Lenke>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Om temaet har mer eller mindre enn gjennomsnittet i Norge. Skog og våtmark kan sammenlignes med SSBs tall for alle kommuner (som
   andel av landarealet i Norge); de andre temaene krever kartdata for alle kommuner, en dataplattform, og står tomme til den finnes. */
function Gjennomsnitt({ id }: { id: string }) {
  if (id !== 'skog' && id !== 'vatmark')
    return <span className="snittmerke tom">Gjennomsnitt: krever dataplattform</span>;
  const S = sammenligning();
  if (S.s !== 'ok' || S.v.endret) return null;
  const a = id === 'skog' ? S.v.skog : S.v.vatmarkAreal;
  if (a.kommune === null || a.norge === null) return null;
  const mer = a.kommune >= a.norge;
  return (
    <span className="snittmerke">
      <Trend opp={mer} />
      {mer ? 'Mer enn gjennomsnittet' : 'Mindre enn gjennomsnittet'}
    </span>
  );
}

/* Temakortene som er brede i rutenettet på oversikten, som i skissene */
const BREDE = ['vatmark', 'verdsatte-naturtyper', 'inngrepsfri-natur'];

/* Temaene i gruppene sine, med arealet, andelen av landarealet og om det er mer eller mindre enn gjennomsnittet. Til oversikten
   (uten nærnaturen, som skissene) og «Utforsk naturen». */
export function Temagrupper({ oversikt }: { oversikt?: boolean }) {
  return (
    <div className="temagrupper">
      {GRUPPER.filter(g => !oversikt || g !== 'Nærnaturen').map(g => (
        <section key={g}>
          <h3 className="md-typography-heading-s">{g}</h3>
          <ul className="temakort">
            {TEMAER.filter(t => t.gruppe === g).map(t => {
              const S = temaflis(t.id);
              return (
                <li key={t.id} className={BREDE.includes(t.id) ? 'bred' : undefined}>
                  <Lenke til={{ side: 'utforsk', tema: t.id }} className="temakort-lenke">
                    <Bilde tema={t.id} farge={t.farge} />
                    <span className="temakort-tekst">
                      <b>{t.navn}</b>
                      <span>
                        {svar(
                          S,
                          v => `${v.andel !== null ? pst(v.andel) + ' % av landarealet, ' : ''}${iTekst(v.km2)}`
                        )}
                      </span>
                    </span>
                    <span className="temakort-bunn">
                      <Gjennomsnitt id={t.id} />
                      <MdIconArrowForward aria-hidden="true" />
                    </span>
                  </Lenke>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
