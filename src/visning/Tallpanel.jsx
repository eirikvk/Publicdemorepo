/* Tallpanelet: arealet i kommunen fra SSB, planlagt utbygging, temaene, anslått utvikling og land og vann. Tallene hentes og regnes
   ut i motoren. Her gjøres de om til tekst, tabeller og stolper. */
import { app, gjeldende, KL, OPPLOSNINGER } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { ingenPlan } from '../motor/plan.js';
import { etterPlan, tolkVann } from '../motor/tall.js';
import Temaer from './Temaer.jsx';
import { Forklaring, Rute, Stripe, Talltabell } from './deler.jsx';
import { andelTekst, antallOrd, dekar, iTekst, medFortegn, nf, prosent } from './tekst.js';
import { MdAlertMessage } from './md.js';

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

/* Planlagt utbygging: status for kommuneplanen og arealet natur og jordbruk som settes av. */
function Planlagt() {
  const i = gjeldende(app.planInfo),
    ingen = ingenPlan(),
    navn = app.valgt ? app.valgt.navn : '';
  const status = !i
    ? ''
    : i.tilstand === 'sjekker'
      ? 'Sjekker om Direktoratet for byggkvalitet (DiBK) har en kommuneplan for kommunen …'
      : i.tilstand === 'feil'
        ? 'Fikk ikke sjekket om Direktoratet for byggkvalitet (DiBK) har en kommuneplan for kommunen.'
        : ingen
          ? `Direktoratet for byggkvalitet (DiBK) har ingen kommuneplan for ${navn}, så planlagt utbygging kan ikke vises eller regnes ut.`
          : `Kommuneplan hentet fra Direktoratet for byggkvalitet (DiBK)${i.kilde ? ': ' + i.kilde : ''}.${i.dekning < 0.6 ? ` Planen dekker ca. ${Math.round(i.dekning * 100)} % av kommunens flate, sjø medregnet.` : ''}`;
  const tilstand = app.planTall ? app.planTall.tilstand : 'tom',
    R = gjeldende(app.planRaster);
  let natur = '',
    jordbruk = '',
    note = '',
    egnemerk = '';
  if (tilstand !== 'ok' || !R) {
    natur = jordbruk = tilstand === 'regner' ? 'regner …' : '';
    note =
      tilstand === 'zoom'
        ? 'Zoom inn i kartet for å få et anslag. Arealet regnes ut for den delen av kommunen nettleseren har hentet kart for.'
        : tilstand === 'feil'
          ? 'Arealet kunne ikke regnes ut.'
          : '';
  } else {
    const m = OPPLOSNINGER[R.z] / 2,
      km2 = v => (v * m * m) / 1e6,
      der = R.delvis ? ' i det hentede kartet' : '';
    const n = R.n,
      { rn, rj } = R.sum,
      basis = R.basis,
      antall = R.antallEgne;
    egnemerk = !antall
      ? ''
      : `Tallene under inkluderer ${antall === 1 ? 'ett eget område' : antallOrd(antall) + ' egne områder'}. ${ingen ? 'Kommunen har ingen kommuneplan hos DiBK.' : basis.rn + basis.rj ? `Kommuneplanen alene setter av ca. ${iTekst(km2(basis.rn))} natur og ca. ${iTekst(km2(basis.rj))} jordbruk.` : 'Kommuneplanen alene setter ikke av natur eller jordbruk til utbygging' + der + '.'}`;
    natur = `ca. ${iTekst(km2(rn))}, ${prosent(rn, n.nat)} % av naturen${der}${antall ? '' : ` (${iTekst(km2(n.pnat))} med smale striper)`}`;
    jordbruk = `ca. ${iTekst(km2(rj))}, ${prosent(rj, n.jor)} % av jordbruket${der}${antall ? '' : ` (${iTekst(km2(n.pjor))} med smale striper)`}`;
    const felles =
      'Smale striper er felt som ikke er bredere enn rundt 40 meter noe sted, ofte langs eksisterende bebyggelse. Smale deler av et større felt regnes med. Stripene vises ikke i kartet med mindre du slår dem på under Tekniske valg. Anslag til illustrasjon, ikke offisiell statistikk.';
    if (R.delvis) {
      const a = km2(n.beb + n.jor + n.nat);
      note = `Gjelder bare den delen av kommunen nettleseren har hentet kart for: ca. ${iTekst(a)} land${app.ssbSum ? ` av ${iTekst(app.ssbSum)} (${prosent(Math.min(a, app.ssbSum), app.ssbSum)} %)` : ''}. Zoom inn og flytt kartet for å få med mer. Regnet ut i nettleseren med piksler på ${R.rute} meter. ${felles}`;
    } else note = `Regnet ut i nettleseren fra ${R.fliser} kartfliser med piksler på ${R.rute} meter. ${felles}`;
  }
  return (
    <section className="planlagt" aria-labelledby="plan-tittel">
      <h2 className="md-typography-heading-s" id="plan-tittel">
        <Rute id="plan" />
        Planlagt utbygging
      </h2>
      {ingen ? (
        <MdAlertMessage
          theme="warning"
          fullWidth
          role="status"
          label="Ingen kommuneplan hos DiBK"
          description={status}
        />
      ) : (
        status && (
          <p className="hint" role="status">
            {status}
          </p>
        )
      )}
      {!utenPlan() && (
        <ul className="talliste">
          <li>
            <span className="navn">
              <Rute id="pnat" />
              Natur som kommuneplanen setter av til framtidig utbygging
            </span>
            <small>
              <b>{natur}</b>
            </small>
          </li>
          <li>
            <span className="navn">
              <Rute id="pjor" />
              Jordbruk som kommuneplanen setter av til framtidig utbygging
            </span>
            <small>
              <b>{jordbruk}</b>
            </small>
          </li>
        </ul>
      )}
      {egnemerk && <p role="status">{egnemerk}</p>}
      {note && <p className="hint">{note}</p>}
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

export default function Tallpanel() {
  return (
    <div className="tallpanel">
      <Arealklasser />
      <Planlagt />
      <Temaer />
      <Utvikling />
      <LandOgVann />
    </div>
  );
}
