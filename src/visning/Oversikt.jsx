/* Oversikten: arealet i kommunen fra SSB, utviklingen siden 2017, og land og vann. Tallene hentes og regnes ut i motoren. Her
   gjøres de om til tekst, tabeller og stolper. */
import { app, gjeldende, KL } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { etterPlan, tolkVann } from '../motor/tall.js';
import { Forklaring, Rute, Stripe, Talltabell } from './deler.jsx';
import { andelTekst, dekar, iTekst, medFortegn, nf, prosent } from './tekst.js';
import './Oversikt.css';

function Arealklasser() {
  const T = app.arealtall,
    ok = !!T && T.tilstand === 'ok',
    a = ok ? T.a : null,
    sum = ok ? a[0] + a[1] + a[2] : 0;
  return (
    <section aria-labelledby="areal-tittel">
      <h2 className="md-typography-heading-s" id="areal-tittel">
        Areal i kommunen, SSB{ok ? ' ' + T.aar : ''}
      </h2>
      <p className="total">
        {ok ? (
          <>
            Landareal: <b>{dekar(sum)}</b>
          </>
        ) : T && T.tilstand === 'feil' ? (
          'Tallene kunne ikke hentes'
        ) : (
          'Henter …'
        )}
      </p>
      {ok && (
        <Stripe
          hva="Arealet i kommunen"
          deler={KL.map(([id, navn], i) => [
            navn,
            '--' + id,
            Math.max(a[i], 0.0001),
            `${navn}: ${dekar(a[i])}, ${prosent(a[i], sum)} %`
          ])}
        />
      )}
      <ul className="talliste">
        {KL.map(([id, navn], i) => (
          <li key={id}>
            <span className="navn">
              <Rute id={id} />
              {navn}
            </span>
            <span className="tall">
              {ok ? dekar(a[i]) : '–'} <b className="andel">{ok ? andelTekst((a[i] / sum) * 100) : '–'}</b>
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">Kilde: Statistisk sentralbyrå (SSB), tabell 09594. Vann er ikke med.</p>
    </section>
  );
}

/* Anslått utvikling på tre tidspunkt: SSBs tall for 2017, SSBs nyeste tall, og nyeste tall med planlagt utbygging trukket fra natur
   og jordbruk og lagt til bebygd. */
function Utvikling() {
  const H = gjeldende(app.historie);
  if (!H) return null;
  if (H.endret)
    return (
      <section className="utvikling" aria-labelledby="utvikling-tittel">
        <h2 className="md-typography-heading-s" id="utvikling-tittel">
          Anslått utvikling
        </h2>
        <p>
          Kommunens flate er ikke den samme i SSBs tall for {H.fra} og {H.til}, trolig fordi grensen er flyttet. Tallene
          kan derfor ikke sammenlignes.
        </p>
      </section>
    );
  const P = app.planSum && app.planSum.nr === app.valgt.nr && !utenPlan() ? app.planSum : null,
    etter = P ? etterPlan(H.a1, P) : null;
  /* Hele dekar i tabellen, og endringen med fortegn */
  const hele = km2 => nf(Math.round(km2 * 1000), 0),
    endr = km2 => medFortegn(Math.round(km2 * 1000), v => nf(v, 0));
  const siden = KL.map(([, navn], i) => {
    const d = H.a1[i] - H.a0[i];
    return `${navn.toLowerCase()} ${Math.round(d * 1000) ? `${d < 0 ? 'ned' : 'opp'} ${iTekst(Math.abs(d))} (${prosent(Math.abs(d), H.a0[i])} %)` : 'uendret'}`;
  })
    .reverse()
    .join(', ');
  const tekst =
    `Fra ${H.fra} til ${H.til}: ${siden}.` +
    (P
      ? ` Bygges alt kommuneplanen setter av, går ca. ${iTekst(P.nat)} natur og ca. ${iTekst(P.jor)} jordbruk over til bebygd.${P.delvis ? ' Det gjelder bare den delen av kommunen nettleseren har hentet kart for.' : ''}`
      : utenPlan()
        ? ' DiBK har ingen kommuneplan for kommunen, så siste kolonne er tom.'
        : !app.oversikter[app.valgt.nr]
          ? ' Zoom inn i kartet for å få et anslag på planlagt utbygging i siste kolonne.'
          : ' Siste kolonne fylles ut når planlagt utbygging er regnet ut.');
  return (
    <section className="utvikling prosa" aria-labelledby="utvikling-tittel">
      <h2 className="md-typography-heading-s" id="utvikling-tittel">
        Anslått utvikling
      </h2>
      <Talltabell
        kolonner={[
          'daa',
          H.fra,
          H.til,
          P && P.egne ? 'Med planlagt utbygging og egne områder' : 'Med planlagt utbygging'
        ]}
        rader={KL.map(([id, navn], i) => ({
          navn,
          farge: id,
          tall: [
            [hele(H.a0[i])],
            [hele(H.a1[i]), endr(H.a1[i] - H.a0[i])],
            etter ? [hele(etter[i]), endr(etter[i] - H.a1[i])] : ['–']
          ]
        }))}
      />
      <p>{tekst}</p>
      <p className="hint">
        Anslag, ikke statistikk over endring. SSB skriver at tabellen ikke kan brukes til å beregne arealendringer
        mellom årganger, fordi datagrunnlaget blir mer fullstendig over tid. Noe av forskjellen fra {H.fra} kan derfor
        skyldes bedre kartlegging. SSB har varslet egne tabeller for arealendringer. Planlagt utbygging er regnet ut i
        nettleseren uten smale striper.
      </p>
    </section>
  );
}

/* Land og vann: land, innsjø og elv er SSBs tall. Hav er regnet ut som kommunens flate minus land og ferskvann. */
function LandOgVann() {
  const V = tolkVann(app.flate, app.ssbSum, app.ferskvann);
  return (
    <section className="vann" aria-labelledby="vann-tittel">
      <h2 className="md-typography-heading-s" id="vann-tittel">
        Land og vann
      </h2>
      {V && (
        <>
          <Stripe hva="Kommunens flate" deler={V.deler.map(([id, navn, v]) => [navn, '--' + id, v])} />
          <Forklaring
            deler={V.deler.map(([id, navn, v]) => [navn, '--' + id, `${id === 'hav' ? 'ca. ' : ''}${dekar(v)}`])}
          />
          <p className="hint">
            {V.hav
              ? 'Land, innsjø og elv er SSBs tall. Hav er regnet ut som kommunens flate (grensen fra Kartverket) minus land og ferskvann.'
              : 'Land, innsjø og elv er SSBs tall. Kommunen har ikke hav.'}
          </p>
        </>
      )}
    </section>
  );
}

export default function Oversikt() {
  return (
    <>
      <Arealklasser />
      <Utvikling />
      <LandOgVann />
    </>
  );
}
