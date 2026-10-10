/* Utvikling fremover: hva kommuneplanen setter av til utbygging, og egne områder man kan tegne eller laste opp og sammenligne med
   planen. Tallene kommer ferdig regnet ut fra gull/planlagt.ts. */
import { byggPlanlagt } from '../../data/gull/planlagt.ts';
import { utenPlan } from '../../data/motor/egne.ts';
import { ingenPlan } from '../../data/motor/plan.ts';
import { app, gjeldende, type Planinfo } from '../../data/motor/tilstand.ts';
import Egne from './Egne.tsx';
import { Rute } from './deler.tsx';
import { antallOrd, iTekst, pst } from '../tekst.ts';
import { MdAlertMessage } from './md.ts';

/* Hvilken plan DiBK har, i tekst: plan-id, hvem som har levert den, og når den ble kopiert til DiBK */
export const planKilde = (p: Planinfo['plan']) =>
  p
    ? `plan ${p.id}${p.vert ? ' fra ' + p.vert : ''}${p.kopiert ? `, kopiert til DiBK ${p.kopiert[2]}.${p.kopiert[1]}.${p.kopiert[0]}` : ''}`
    : '';

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
          : `Kommuneplan hentet fra Direktoratet for byggkvalitet (DiBK)${i.plan ? ': ' + planKilde(i.plan) : ''}.${i.dekning! < 0.6 ? ` Planen dekker ca. ${Math.round(i.dekning! * 100)} % av kommunens flate, sjø medregnet.` : ''}`;
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
    const P = byggPlanlagt(R, app.ssbSum),
      der = P.delvis ? ' i det hentede kartet' : '',
      antall = P.antallEgne;
    egnemerk = !antall
      ? ''
      : `Tallene over inkluderer ${antall === 1 ? 'ett eget område' : antallOrd(antall) + ' egne områder'}. ${ingen ? 'Kommunen har ingen kommuneplan hos DiBK.' : !P.basis!.tom ? `Kommuneplanen alene setter av ca. ${iTekst(P.basis!.natur)} natur og ca. ${iTekst(P.basis!.jordbruk)} jordbruk.` : 'Kommuneplanen alene setter ikke av natur eller jordbruk til utbygging' + der + '.'}`;
    natur = `ca. ${iTekst(P.natur.km2)}, ${pst(P.natur.andel)} % av naturen${der}${antall ? '' : ` (${iTekst(P.natur.medStriper)} med smale striper)`}`;
    jordbruk = `ca. ${iTekst(P.jordbruk.km2)}, ${pst(P.jordbruk.andel)} % av jordbruket${der}${antall ? '' : ` (${iTekst(P.jordbruk.medStriper)} med smale striper)`}`;
    const felles =
      'Smale striper er felt som ikke er bredere enn rundt 40 meter noe sted, ofte langs eksisterende bebyggelse. Smale deler av et større felt regnes med. Stripene vises ikke i kartet med mindre du slår dem på under Tekniske valg på siden Om og metode. Anslag til illustrasjon, ikke offisiell statistikk.';
    if (P.hentet)
      note = `Gjelder bare den delen av kommunen nettleseren har hentet kart for: ca. ${iTekst(P.hentet.km2)} land${P.hentet.land ? ` av ${iTekst(P.hentet.land)} (${pst(P.hentet.andel)} %)` : ''}. Zoom inn og flytt kartet for å få med mer. Regnet ut i nettleseren med piksler på ${P.rute} meter. ${felles}`;
    else note = `Regnet ut i nettleseren fra ${P.fliser} kartfliser med piksler på ${P.rute} meter. ${felles}`;
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
