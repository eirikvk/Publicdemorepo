/* «Utforsk i kart»: hele kommunen i ett stort kart, med temaene fra «Utforsk naturen». Siden er tom i skissene, så den er satt sammen
   av delene fra de tegnede sidene. Temaet velges med designsystemets filterbrikker over kartet, i gruppene fra «Utforsk naturen», og
   står i adressen (#5001/kart/skog), så et kart kan deles. Hvert tema har de samme kartlagene som på temasiden (temalag.ts), og planlagt
   utbygging kan slås på i alle, så man ser hvor kommuneplanen setter av areal i temaet. Uten tema viser kartet dagens arealklasser og
   planlagt utbygging. Under lagene står tallene for temaet i kommunen og lenken til temasiden. */
import { app } from '../../src/data/motor/tilstand.ts';
import { andelTekst, iTekst, pst } from '../tekst.ts';
import { MdFilterChip } from '../md.ts';
import Kart, { KLASSER, PLAN, type Kartlag } from '../komponenter/Kart.tsx';
import { Forslag, Lenke, Temasymbol, svar } from '../komponenter/deler.tsx';
import { figma, velgKartTema } from '../navigasjon.ts';
import { graaIPlan, naturtema, planPerOkosystem, plansum, temaflis } from '../tall.ts';
import { TEMALAG } from '../temalag.ts';
import { GRUPPER, TEMAER, temaet } from '../temaer.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');

/* Valgene over kartet: dagens arealklasser, og temaene i gruppene fra «Utforsk naturen» */
const VALG: [gruppe: string, valg: { id?: string; navn: string }[]][] = [
  ['Arealbruk', [{ navn: 'Dagens arealklasser' }]],
  ...GRUPPER.map((g): [string, { id?: string; navn: string }[]] => [
    g,
    TEMAER.filter(t => t.gruppe === g).map(t => ({ id: t.id, navn: t.navn }))
  ])
];
/* Planlagt utbygging, som kan slås på over temaet */
const PLAN_AV: Kartlag = { ...PLAN, av: true };
/* Lagene for temaet: lagene fra temasiden og planlagt utbygging, skjult til man slår den på (bynaturen har den alt). Uten tema dagens
   arealklasser og planlagt utbygging. */
const LAG: Record<string, Kartlag[]> = Object.fromEntries(
  Object.entries(TEMALAG).map(([id, L]) => [id, L.some(l => l.id === 'plan') ? L : [...L, PLAN_AV]])
);
const UTEN_TEMA = [KLASSER, PLAN];

/* Planlagt utbygging i temaet, i en setning, når kommuneplanen er regnet ut for det. Inngrepsfri natur krysses ikke med planen. */
function iPlanen(id: string) {
  const tema = (t: 'vern' | 'rein' | 'verdi', hvor: string) => {
    const P = naturtema(t).plan;
    return P ? `Planlagt utbygging ${hvor}: ${iTekst(P.planKm2)}.` : null;
  };
  switch (id) {
    case 'verneomrader':
      return tema('vern', 'i verneområdene');
    case 'villrein':
      return tema('rein', 'i villreinområdene');
    case 'verdsatte-naturtyper':
      return tema('verdi', 'i verdsatte naturtyper');
    case 'skog':
    case 'vatmark': {
      const P = planPerOkosystem();
      if (P.s !== 'ok') return null;
      const r = P.v.rader.find(x => x.navn === (id === 'skog' ? 'Skog' : 'Våtmark'));
      return r
        ? `Satt av til utbygging: ${iTekst(r.km2)}, ${r.andel === null ? '–' : andelTekst(r.andel)} av ${r.navn.toLowerCase()}en.`
        : null;
    }
    case 'bynatur': {
      const G = graaIPlan();
      return G && G.plan ? `${prosent(G.plan.andelGraa)} av den planlagte utbyggingen ligger på grått areal.` : null;
    }
  }
  return null;
}

/* Tallene for det som er valgt, under lagene: arealet og andelen av landarealet, planlagt utbygging i temaet, og lenken til siden */
function Omtale({ id }: { id?: string }) {
  const t = temaet(id);
  if (!t) {
    const P = plansum();
    return (
      <div className="kartomtale">
        <b className="kartomtale-navn">
          <Temasymbol id="arealklasser" />
          Dagens arealklasser
        </b>
        <p>
          {P ? (
            <>
              Kommuneplanen setter av {iTekst(P.nat)} natur og {iTekst(P.jor)} jordbruk til utbygging.
            </>
          ) : (
            <span className="henter">Regner ut planlagt utbygging …</span>
          )}
        </p>
        <Lenke til={{ side: 'naturtapet' }} className="pil-lenke md-link">
          Mer om naturtapet →
        </Lenke>
      </div>
    );
  }
  const S = temaflis(t.id),
    plan = S.s === 'ingen' ? null : iPlanen(t.id);
  return (
    <div className="kartomtale">
      <b className="kartomtale-navn">
        <Temasymbol id={t.id} />
        {t.navn} i {kommunen()}
      </b>
      <p>
        {svar(
          S,
          v => `${iTekst(v.km2)}${v.andel !== null ? `, ${prosent(v.andel)} av landarealet` : ''}.`,
          `${kommunen()} har ingen ${t.navn.toLowerCase()}.`
        )}
        {plan && <> {plan}</>}
      </p>
      <Lenke til={{ side: 'utforsk', tema: t.id }} className="pil-lenke md-link">
        Mer om {t.navn.replace(/ \(.*\)$/, '').toLowerCase()} →
      </Lenke>
    </div>
  );
}

export default function Utforskkart() {
  const id = figma.rute.tema,
    t = temaet(id);
  return (
    <>
      <div className="innhold">
        <section className="sidetopp">
          <Forslag />
          <h1 className="md-typography-heading-xl">Utforsk {kommunen()} i kart</h1>
          <p className="ingress">
            Velg et tema, og se det i kartet med de samme lagene som på siden om temaet. Slå på planlagt utbygging for å
            se hvor kommuneplanen setter av areal i temaet, og trykk i kartet for å se hva som er der.
          </p>
        </section>
        <div className="kartvalg" role="group" aria-label="Tema i kartet">
          {VALG.map(([gruppe, valg]) => (
            <div key={gruppe} className="kartvalg-gruppe">
              <span className="md-typography-label-s">{gruppe}</span>
              <ul>
                {valg.map(v => (
                  <li key={v.navn}>
                    <MdFilterChip label={v.navn} active={v.id === id} onClick={() => velgKartTema(v.id)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <Kart stor lag={t ? LAG[t.id] : UTEN_TEMA} etter={<Omtale id={t ? t.id : undefined} />} />
    </>
  );
}
