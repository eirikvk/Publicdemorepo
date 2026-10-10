/* Små byggeklosser som designsystemet ikke har: fargeruter, stolper som viser en fordeling, tegnforklaringer, linjer i en liste
   med tall, lenker mellom sidene og tabeller med tall. Fargene er kartets egne og ligger som CSS-variabler, se FARGER i
   ui/farger.ts. */
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { adresse, velgSide } from '../sider.ts';
import { dekar, prosent } from '../tekst.ts';
import './deler.css';

/* Fargerute for et kartlag eller en klasse. id er navnet på fargen, for eksempel beb eller verdi2. Lag med flere farger (plan,
   inon, graa, verdi) og lag som tegnes som omriss (vern, rein) får egen utforming i deler.css, ut fra data-lag. */
export const Rute = ({ id, className = '' }: { id?: string; className?: string }) => (
  <i
    className={'rute ' + className}
    data-lag={id || undefined}
    style={id ? ({ '--c': `var(--${id})` } as CSSProperties) : undefined}
    aria-hidden="true"
  />
);

/* En stolpe delt etter verdiene i deler: [navn, farge, verdi]. Farge er en CSS-variabel (--beb) eller en klasse (kjent, tom).
   hva er navnet på det hele, til skjermlesere. tittel er teksten som vises når man holder over en del. */
export type Stripedel = [navn: string, farge: string, verdi: number, tittel?: string];
export function Stripe({ deler, hva, className = '' }: { deler: Stripedel[]; hva?: string; className?: string }) {
  const sum = deler.reduce((s, d) => s + d[2], 0),
    synlige = deler.filter(d => d[2] > 0);
  return (
    <div
      className={'stripe ' + className}
      role="img"
      aria-label={(hva ? hva + ': ' : '') + synlige.map(d => `${d[0]} ${prosent(d[2], sum)} prosent`).join(', ')}
    >
      {synlige.map(([navn, farge, v, tittel]) => (
        <i
          key={navn}
          className={farge.startsWith('--') ? undefined : farge}
          style={{ flex: `${v} 1 0`, background: farge.startsWith('--') ? `var(${farge})` : undefined }}
          title={tittel || `${navn}: ${dekar(v)}`}
        />
      ))}
    </div>
  );
}

/* Tegnforklaring på én linje under en stolpe: [navn, farge, tall]. */
export const Forklaring = ({ deler }: { deler: [navn: string, farge: string, tall: ReactNode][] }) => (
  <div className="forklaring">
    {deler.map(([navn, farge, tall]) => (
      <span key={navn}>
        {farge.startsWith('--') ? <Rute id={farge.slice(2)} /> : <Rute className={farge} />}
        {navn} <b>{tall}</b>
      </span>
    ))}
  </div>
);

/* En linje i en tegnforklaring: fargerute og navn, tall til høyre, og en forklaring under hvis det er oppgitt. */
export const Fargelinje = ({
  id,
  navn,
  tall,
  under,
  children
}: {
  id: string;
  navn: ReactNode;
  tall: ReactNode;
  under?: ReactNode;
  children?: ReactNode;
}) => (
  <li>
    <b className="navn">
      <Rute id={id} />
      {navn}
    </b>
    <span className="tall">{tall}</span>
    {(under || children) && (
      <small>
        {under}
        {children}
      </small>
    )}
  </li>
);

/* Lenke til en annen side i sidevelgeren. Lenken har sidens adresse, så den kan også åpnes i ny fane. Et vanlig trykk bytter side
   her, og flytter fokus og visningen til toppen av den nye siden. */
export function Sidelenke({ id, children }: { id: string; children: ReactNode }) {
  const gaa = (e: MouseEvent) => {
    e.preventDefault();
    velgSide(id);
    /* Siden som nettopp er valgt, kan ikke få fokus før nettleseren har tegnet den */
    setTimeout(() => {
      const s = document.getElementById('side-' + id);
      if (!s) return;
      s.focus({ preventScroll: true });
      if (s.getBoundingClientRect().top < 0) s.scrollIntoView();
    }, 50);
  };
  return (
    <a className="md-link sidelenke" href={adresse(id)} onClick={gaa}>
      {children}
    </a>
  );
}

/* Tabell med navn i første kolonne og tall i resten. kolonner er overskriftene. Hver rad er { navn, farge, tall, klasse }, der
   tall er cellene som [tekst, mindre tall under] og klasse kan være sum, eller { gruppe } for en mellomoverskrift. tittel står over
   tabellen. */
export type Tabellrad =
  | { gruppe: string }
  | { navn: ReactNode; farge?: string | null; tall: [tekst: ReactNode, under?: ReactNode][]; klasse?: string };
export function Talltabell({ tittel, kolonner, rader }: { tittel?: string; kolonner: string[]; rader: Tabellrad[] }) {
  return (
    <div className="tabellramme">
      <table className="talltabell">
        {tittel && <caption className="md-typography-label-s">{tittel}</caption>}
        <thead>
          <tr>
            {kolonner.map((t, i) => (
              <th key={t} scope="col" className={i ? 'tall' : undefined}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rader.map((r, i) =>
            'gruppe' in r ? (
              <tr key={i} className="gruppe">
                <th colSpan={kolonner.length} scope="colgroup">
                  {r.gruppe}
                </th>
              </tr>
            ) : (
              <tr key={i} className={r.klasse}>
                <th scope="row">
                  <span className="navn">
                    {r.farge && <Rute id={r.farge} />}
                    {r.navn}
                  </span>
                </th>
                {r.tall.map(([tekst, under], j) => (
                  <td key={j} className="tall">
                    {tekst}
                    {under ? <small>{under}</small> : null}
                  </td>
                ))}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
