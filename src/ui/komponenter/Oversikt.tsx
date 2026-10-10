/* Oversikten: det viktigste fra hver side, kort. Hver linje har sidens navn som lenke, ett tall og én eller to setninger. Tallene er
   de samme som på sidene selv, fordi de kommer fra de samme funksjonene i gull. Linjene står i de samme blokkene som i sidevelgeren,
   så temaene står under «Naturen i kommunen». */
import { Fragment } from 'react';
import { utenPlan } from '../../data/motor/egne.ts';
import {
  arealtall,
  endring,
  graaTall,
  inonTall,
  naturtemaet,
  planSum,
  planTall,
  utbredelse
} from '../../data/motor/gulldata.ts';
import { NATURTEMA } from '../../data/motor/naturtema.ts';
import { BLOKKER } from '../sider.ts';
import { ETT, TEMAORD } from './Naturtema.tsx';
import { Sidelenke } from './deler.tsx';
import { andelTekst, antallOrd, dekar, iTekst, stor } from '../tekst.ts';
import './Oversikt.css';

/* Én linje: tallet til høyre og teksten under */
interface Linje {
  tall: string;
  tekst: string;
}
const HENTER: Linje = { tall: '', tekst: 'Henter …' },
  ingenTall = (tekst: string): Linje => ({ tall: '', tekst });
/* Andelen av landarealet fra gull, som tillegg til en setning. Tomt når landarealet mangler (null). */
const avLand = (a: number | null) => (a !== null ? `, ${andelTekst(a)} av landarealet` : '');

/* Utbredelsesregnskapet: natur nå, og forskjellen fra 2017 */
function regnskap() {
  const T = arealtall();
  if (!T || T.tilstand === 'henter') return HENTER;
  if (T.tilstand !== 'ok') return ingenTall('Tallene kunne ikke hentes fra SSB.');
  const U = utbredelse(),
    natur = U!.klasser[0],
    E = endring(),
    d = E && !E.endret ? E.klasser[0].km2 : 0;
  return {
    tall: dekar(natur.km2),
    tekst:
      `Natur i ${U!.aar}${avLand(natur.andel)}.` +
      (Math.round(d * 1000)
        ? ` Ca. ${iTekst(Math.abs(d))} ${d < 0 ? 'mindre' : 'mer'} enn i ${E!.fra}, men forskjellen mellom årgangene er ikke målt endring.`
        : '')
  };
}

/* Verneområder, villrein og verdsatt natur: antall, areal og planlagt utbygging innenfor */
function naturtema(id: string) {
  const tema = NATURTEMA.find(x => x.id === id)!,
    t = { ...tema, ...TEMAORD[id] },
    T = naturtemaet(tema);
  if (!T) return HENTER;
  const { D, N } = T;
  if (D.feil) return ingenTall(`${t.navn} kunne ikke hentes fra Miljødirektoratet.`);
  if (!N.antall) return ingenTall(`Miljødirektoratet har ingen ${t.fl} registrert i kommunen.`);
  const verdi = N.hoyVerdi !== null ? ` Ca. ${iTekst(N.hoyVerdi)} har stor eller svært stor verdi.` : '',
    plan =
      utenPlan() || !D.regnet
        ? ''
        : N.plan
          ? ` Ca. ${iTekst(N.planKm2)} planlagt utbygging innenfor.`
          : ' Ingen planlagt utbygging innenfor.';
  return {
    tall: dekar(N.sum),
    tekst: `${stor(antallOrd(N.antall, ETT[id]))} ${N.antall === 1 ? t.en : t.fl}.${verdi}${plan}`
  };
}

/* Inngrepsfri natur og grått areal hentes som ett bilde av kommunen */
function inon() {
  const I = inonTall();
  if (I.tilstand === 'henter') return HENTER;
  if (I.tilstand === 'feil') return ingenTall('Inngrepsfri natur kunne ikke hentes fra Miljødirektoratet.');
  if (I.tilstand === 'ingen')
    return ingenTall('Ingen. Alt ligger nærmere enn én kilometer fra tyngre tekniske inngrep.');
  return { tall: dekar(I.sum), tekst: `Minst én kilometer fra tyngre tekniske inngrep${avLand(I.andelLand)}.` };
}
function graa() {
  const G = graaTall();
  if (G.tilstand === 'henter') return HENTER;
  if (G.tilstand === 'feil') return ingenTall('Grått areal kunne ikke hentes fra NIBIO.');
  if (G.tilstand === 'ingen') return ingenTall('Kartet over grå arealer har ingen flater i kommunen.');
  return {
    tall: dekar(G.sum),
    tekst: `Tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet${avLand(G.andelLand)}.`
  };
}

/* Utvikling fremover: natur og jordbruk som kommuneplanen setter av til utbygging */
function framtid() {
  if (utenPlan()) return ingenTall('Direktoratet for byggkvalitet (DiBK) har ingen kommuneplan for kommunen.');
  const P = planSum();
  if (P)
    return {
      tall: dekar(P.nat),
      tekst: `Natur som kommuneplanen setter av til framtidig utbygging. I tillegg ca. ${iTekst(P.jor)} jordbruk.${P.egne ? ' Egne områder er med.' : ''}${P.delvis ? ' Gjelder bare den delen av kommunen nettleseren har hentet kart for.' : ''}`
    };
  const tilstand = planTall();
  return tilstand === 'zoom'
    ? ingenTall('Zoom inn i kartet for å få et anslag.')
    : tilstand === 'feil'
      ? ingenTall('Arealet kunne ikke regnes ut.')
      : HENTER;
}

const LINJE: Record<string, () => Linje> = {
  regnskap,
  graa,
  rein: () => naturtema('rein'),
  inon,
  verdi: () => naturtema('verdi'),
  vern: () => naturtema('vern'),
  framtid
};

export default function Oversikt() {
  return (
    <section className="sammendrag" aria-labelledby="oversikt-tittel">
      <h2 className="md-typography-heading-s" id="oversikt-tittel">
        Oversikt
      </h2>
      <p>Det viktigste fra hver side. Velg navnet for å lese mer.</p>
      {BLOKKER.map(({ gruppe, sider }, b) => {
        const vis = sider.filter(([id]) => LINJE[id]);
        if (!vis.length) return null;
        return (
          <Fragment key={b}>
            {gruppe && <h3 className="md-typography-heading-xs">{gruppe}</h3>}
            <ul className="talliste">
              {vis.map(([id, navn]) => {
                const { tall, tekst } = LINJE[id]();
                return (
                  <li key={id}>
                    <span className="navn">
                      <Sidelenke id={id}>{navn}</Sidelenke>
                    </span>
                    <b className="tall">{tall}</b>
                    <p>{tekst}</p>
                  </li>
                );
              })}
            </ul>
          </Fragment>
        );
      })}
    </section>
  );
}
