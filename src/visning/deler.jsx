/* Små byggeklosser som designsystemet ikke har: fargeruter, stolper som viser en fordeling, tegnforklaringer og celler med et mindre
   tall under. Fargene er kartets egne og ligger som CSS-variabler, se FARGER i motor/felles.js. */
import { dekar, nf } from '../motor/felles.js';

/* Fargerute for et kartlag eller en klasse. id er navnet på fargen, for eksempel beb eller verdi2. Lag med flere farger (plan,
   inon, graa, verdi) og lag som tegnes som omriss (vern, rein) får egen utforming i stil.css, ut fra data-lag. */
export const Rute = ({ id, className = '' }) => (
  <i
    className={'rute ' + className}
    data-lag={id || undefined}
    style={id ? { '--c': `var(--${id})` } : undefined}
    aria-hidden="true"
  />
);

/* En stolpe delt etter verdiene i deler: [navn, farge, verdi]. Farge er en CSS-variabel (--beb) eller en klasse (kjent, tom).
   hva er navnet på det hele, til skjermlesere. */
export function Stripe({ deler, hva, className = '' }) {
  const sum = deler.reduce((s, d) => s + d[2], 0),
    synlige = deler.filter(d => d[2] > 0);
  return (
    <div
      className={'stripe ' + className}
      role="img"
      aria-label={(hva ? hva + ': ' : '') + synlige.map(d => `${d[0]} ${nf((d[2] / sum) * 100)} prosent`).join(', ')}
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
export const Forklaring = ({ deler }) => (
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
export const Fargelinje = ({ id, navn, tall, under, children }) => (
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

/* Tall i løpende tekst: til og med tolv skrives med bokstaver, som Miljødirektoratets språkprofil sier. en er ordet for 1, som
   avhenger av kjønnet på det som telles (ett område, én lokalitet). */
const ORD = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv'];
export const antallOrd = (n, en = 'én') =>
  n === 1 ? en : Number.isInteger(n) && n >= 0 && n <= 12 ? ORD[n] : nf(n, 0);
export const stor = t => t.charAt(0).toUpperCase() + t.slice(1);

/* En celle i en tabell, med et mindre tall under hvis det er oppgitt. */
export const Celle = ({ tekst, under }) => (
  <td className="tall">
    {tekst}
    {under ? <small>{under}</small> : null}
  </td>
);
