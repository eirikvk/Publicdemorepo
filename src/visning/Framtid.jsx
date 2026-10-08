/* Utvikling fremover: hva kommuneplanen setter av til utbygging, og egne områder man kan tegne eller laste opp og sammenligne med
   planen. */
import { app, gjeldende, OPPLOSNINGER } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { ingenPlan } from '../motor/plan.js';
import Egne from './Egne.jsx';
import { Rute } from './deler.jsx';
import { antallOrd, iTekst, prosent } from './tekst.js';
import { MdAlertMessage } from './md.js';

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
      : `Tallene over inkluderer ${antall === 1 ? 'ett eget område' : antallOrd(antall) + ' egne områder'}. ${ingen ? 'Kommunen har ingen kommuneplan hos DiBK.' : basis.rn + basis.rj ? `Kommuneplanen alene setter av ca. ${iTekst(km2(basis.rn))} natur og ca. ${iTekst(km2(basis.rj))} jordbruk.` : 'Kommuneplanen alene setter ikke av natur eller jordbruk til utbygging' + der + '.'}`;
    natur = `ca. ${iTekst(km2(rn))}, ${prosent(rn, n.nat)} % av naturen${der}${antall ? '' : ` (${iTekst(km2(n.pnat))} med smale striper)`}`;
    jordbruk = `ca. ${iTekst(km2(rj))}, ${prosent(rj, n.jor)} % av jordbruket${der}${antall ? '' : ` (${iTekst(km2(n.pjor))} med smale striper)`}`;
    const felles =
      'Smale striper er felt som ikke er bredere enn rundt 40 meter noe sted, ofte langs eksisterende bebyggelse. Smale deler av et større felt regnes med. Stripene vises ikke i kartet med mindre du slår dem på under Tekniske valg på siden Om og metode. Anslag til illustrasjon, ikke offisiell statistikk.';
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

export default function Framtid() {
  return (
    <>
      <Planlagt />
      <Egne />
    </>
  );
}
