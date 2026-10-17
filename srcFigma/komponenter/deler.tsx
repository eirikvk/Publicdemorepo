/* Delene sidene i tvillingen er bygd av, etter Figma-skissene: brødsmuler, toppen av en temaside, tallkort, trekkspill, figurer med
   tekst og kilde, stolper, flisene for temaene, ressurser, og en ramme for det som ikke er laget ennå. Bildene fra skissene er ikke med
   (rettighetene er ikke avklart), så hvert tema har en KI-generert illustrasjon i stedet, merket med det. */
import { useId, type ReactNode } from 'react';
import { KILDE } from '../../src/data/katalog.ts';
import { MdAccordionItem, MdIconArrowForward, MdIconChevronForward, MdIconOpenInNew } from '../md.ts';
import { andelTekst, iTekst, pst } from '../../src/ui/tekst.ts';
import { lenke, type Rute } from '../navigasjon.ts';
import { Illustrasjon } from '../illustrasjoner.tsx';
import { GRUPPER, TEMAER, type Tema } from '../temaer.ts';
import { sammenligning, temaflis, type Svar } from '../tall.ts';

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

/* Ikonet for et tema i den runde flaten ved tittelen, som i skissene: en gran for skog, en øyenstikker for våtmark, et reinsdyrhode
   for villrein, hus og tre for bynaturen, og en bok for de andre (som skissene) */
const IKON: Record<string, ReactNode> = {
  skog: <path d="M12 3v18M12 6 9 9m3-3 3 3m-3 1-4 4m4-4 4 4m-4 0-5 4m5-4 5 4" />,
  vatmark: (
    <>
      <path d="M12 6v15" />
      <ellipse cx="7" cy="8" rx="5" ry="1.8" transform="rotate(-18 7 8)" />
      <ellipse cx="17" cy="8" rx="5" ry="1.8" transform="rotate(18 17 8)" />
      <ellipse cx="7.8" cy="12" rx="4.2" ry="1.6" transform="rotate(14 7.8 12)" />
      <ellipse cx="16.2" cy="12" rx="4.2" ry="1.6" transform="rotate(-14 16.2 12)" />
    </>
  ),
  villrein: (
    <path d="M9.5 21 8 14a4 4 0 0 1 8 0l-1.5 7zM8.5 11 5 5m0 0L3 6m2-1 1-2.5M15.5 11 19 5m0 0 2 1m-2-1-1-2.5M7 8H4.5m12.5 0h2.5" />
  ),
  bynatur: <path d="M3 21V10h6v11m0 0V5h6v16m3 0v-5m0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 21h20" />,
  bok: <path d="M6 3.5h11.5v14H7.5A1.5 1.5 0 0 0 6 19V3.5zm0 15.5a1.5 1.5 0 0 0 1.5 1.5h10v-3M9.5 3.5v14" />
};
export const TemaIkon = ({ id }: { id: string }) => (
  <span className="temaikon" aria-hidden="true">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {IKON[id] || IKON.bok}
    </svg>
  </span>
);

/* Toppen av en temaside: ikonet og tittelen, ingressen (avsnitt skilt med tom linje), trekkspillene under, og bildet ved siden av
   (under ingressen på mobil) */
export function Helt({ tema, children }: { tema: Tema; children?: ReactNode }) {
  return (
    <section className="helt">
      <div className="helt-tekst">
        <h1>
          <TemaIkon id={tema.id} />
          {tema.navn}
        </h1>
        {tema.ingress.split('\n\n').map(a => (
          <p className="ingress" key={a}>
            {a}
          </p>
        ))}
      </div>
      <Bilde tema={tema.id} farge={tema.farge} />
      {children && <div className="trekkspill-liste">{children}</div>}
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

/* Tallkortene øverst: [etikett, tallet] */
export const Tallkort = ({ kort }: { kort: [etikett: string, tall: ReactNode][] }) => (
  <dl className="tallkort">
    {kort.map(([etikett, tall]) => (
      <div key={etikett}>
        <dt>{etikett}</dt>
        <dd>{tall}</dd>
      </div>
    ))}
  </dl>
);

/* Kilden under en figur, med lenke til datasettet */
export function Kilde({ kilder }: { kilder: (keyof typeof KILDE)[] }) {
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
   figuren ikke laget ennå (tom), står flaten tom med et merke og hva som trengs. */
export function Figur({
  tittel,
  tekst,
  kilder,
  children,
  etter,
  tom,
  merke
}: {
  tittel: string;
  tekst: ReactNode;
  kilder: (keyof typeof KILDE)[];
  children?: ReactNode;
  etter?: ReactNode;
  tom?: string;
  merke?: string;
}) {
  return (
    <section className="figur">
      <div className="figur-tekst">
        <h2 className="figur-tittel">{tittel}</h2>
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

/* Stående stolper med arealet over og navnet under, i kartets farger */
export interface Stolpe {
  navn: string;
  km2: number;
  farge: string;
  under?: string;
}
export function Stolper({ data, hva }: { data: Stolpe[]; hva: string }) {
  const maks = Math.max(...data.map(d => d.km2), 1e-9);
  return (
    <figure className="stolper" aria-label={hva}>
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
            {d.navn}
            {d.under && <small>{d.under}</small>}
          </span>
        </div>
      ))}
    </figure>
  );
}

/* Et kakediagram med navnet og arealet ved hver bit, som i skissene. prikker gir biten et prikkete mønster (tresatt myr og beite).
   Navnene står utenfor kaken, på samme side som biten, og flyttes fra hverandre når de ville kommet for tett. */
export function Kake({ data, hva }: { data: (Stolpe & { prikker?: boolean })[]; hva: string }) {
  const id = useId().replace(/:/g, ''),
    sum = data.reduce((a, d) => a + d.km2, 0) || 1,
    R = 158,
    cx = 400,
    cy = 220;
  let v = -Math.PI / 2;
  /* De minste bitene først, så de står øverst til høyre, som i skissene */
  const biter = [...data]
    .filter(d => d.km2 > 0)
    .sort((a, b) => a.km2 - b.km2)
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

/* Et felt i skissen som ikke er laget ennå: hva det skal vise, og hva som trengs. merke står øverst (til vanlig «Ikke laget ennå»). */
export const Mangler = ({ tittel, trenger, merke }: { tittel: string; trenger: string; merke?: string }) => (
  <section className="mangler">
    <span className="mangler-merke">{merke || 'Ikke laget ennå'}</span>
    <h2 className="md-typography-heading-s">{tittel}</h2>
    <p>Krever: {trenger}</p>
  </section>
);

/* En fremhevet melding, som planlagt utbygging i temaet */
export const Fremhevet = ({ children, varsel }: { children: ReactNode; varsel?: boolean }) => (
  <div className={'fremhevet' + (varsel ? ' varsel' : '')}>{children}</div>
);

/* Ressurser: lenker ut, i to kolonner */
export function Ressurser({ lenker }: { lenker: [tekst: string, url: string][] }) {
  return (
    <section className="ressurser">
      <h2 className="md-typography-heading-s">Ressurser</h2>
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

/* Ofte stilte spørsmål: [spørsmål, svar] */
export function Sporsmal({ liste }: { liste: [sporsmal: string, svar: ReactNode][] }) {
  return (
    <section className="sporsmal">
      <h2 className="md-typography-heading-s">Ofte stilte spørsmål</h2>
      {liste.map(([s, sv]) => (
        <Trekkspill key={s} tittel={s}>
          {sv}
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
      <h2 className="md-typography-heading-s">Utforsk neste perspektiv</h2>
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
          <h3>{g}</h3>
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
