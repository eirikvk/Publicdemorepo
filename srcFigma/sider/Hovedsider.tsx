/* Hovedsidene i tvillingen: Oversikt, Utforsk naturen, Hjelp og veileder, og siden for en adresse som ikke finnes. Naturtapet og
   Utforsk i kart har egne filer. Oversikten følger skissene fra 17. oktober så nær som mulig, med tallene fra datamotoren. Det skissene
   viser som krever en dataplattform, står tomt, og det blå feltet om hva naturen ble bygget ned til (som utgår) viser kommuneplanen i
   stedet. Utforsk naturen er tom i skissene, så den er satt sammen av de samme delene. */
import { useState } from 'react';
import { KILDE } from '../../src/data/katalog.ts';
import { app } from '../../src/data/motor/tilstand.ts';
import type { Okosystemregnskap, Plassering } from '../../src/data/gull/syntetisk.ts';
import { HOVEDOKOSYSTEMER } from '../../src/data/solv/klasser.ts';
import { andelTekst, dekar, iTekst, pst } from '../tekst.ts';
import { MdIconAdd, MdIconClose } from '../md.ts';
import Kart, { KLASSER, PLAN, type Kartlag } from '../komponenter/Kart.tsx';
import { KLASSELAG } from '../kartlag.ts';
import {
  Baand,
  Endringsmerke,
  Fremhevet,
  Kilde,
  Lenke,
  MedSporsmal,
  Merket,
  SYNTETISK_TEKST,
  Syntetisk,
  Temagrupper,
  Trekkspill,
  useSporsmal,
  svar
} from '../komponenter/deler.tsx';
import { nedbygging, okosystemregnskap, oversiktKort, plansum, sammenligning } from '../tall.ts';
import { TEMAER } from '../temaer.ts';
import { FLAGG } from '../flagg.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
/* Kommunens navn i genitiv: Trondheims, Røros' */
const kommunens = () => {
  const k = kommunen();
  return /[sxz]$/i.test(k) ? k + "'" : k + 's';
};
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');

/* En liten andel, som i sammenligningen med Norge: én desimal, som ellers, og «< 0,1 %» når den er mindre */
const pst2 = (a: number | null) => (a === null ? '–' : andelTekst(a));

/* Kortet som er valgt på oversikten, og laget og merkelappen det gir i kartet */
type Klassevalg = keyof typeof KLASSELAG;
const KLASSEKART: Record<Klassevalg, [lag: Kartlag, merke: (kommune: string) => string]> = {
  nat: [
    { id: 'kl-nat', navn: 'Natur', kilde: 'Grunnkart for arealanalyse, NIBIO', ol: KLASSELAG.nat },
    k => `Naturen i ${k} i dag`
  ],
  jor: [
    { id: 'kl-jor', navn: 'Jordbruk', kilde: 'Grunnkart for arealanalyse, NIBIO', ol: KLASSELAG.jor },
    k => `Jordbruket i ${k} i dag`
  ],
  beb: [
    { id: 'kl-beb', navn: 'Bebygget', kilde: 'Grunnkart for arealanalyse, NIBIO', ol: KLASSELAG.beb },
    k => `Bebygget areal i ${k} i dag`
  ]
};
/* Navnene på kortene, som i skissene */
const KORTNAVN: Record<string, string> = { nat: 'Natur', jor: 'Jordbruk', beb: 'Bebygget' };

/* Hva hvert hovedøkosystem er, til radene i «Hva slags natur ble bygget ned?», og temasiden der det finnes en. Teksten om skog er fra
   skissene. */
const OKOSYSTEMET: Record<string, { tekst: string[]; tema?: [id: string, navn: string] }> = {
  bebygdOpparbeidetAreal: {
    tekst: [
      'Bebygd og opparbeidet areal er bygninger, veier, jernbane, parker, idrettsanlegg og annet areal som er bygd eller opparbeidet. Når natur eller jordbruk bygges ned, blir arealet bebygd.'
    ]
  },
  dyrketmark: { tekst: ['Dyrket mark er fulldyrka jord, som pløyes og brukes til åkervekster eller eng.'] },
  grasmark: {
    tekst: ['Grasmark er jordbruksareal med gras som ikke er fulldyrka, som overflatedyrka jord og innmarksbeite.']
  },
  skog: {
    tekst: [
      'Skog er områder med minst 6 trær pr. dekar. Trærne må være eller kunne bli minst 5 meter høye og være jevnt fordelt. I skogarealet inngår også skog på myr og innmarksbeite. Omtrent halvparten av alle arter som står på den norske rødlista lever i skog.',
      'Skogen er svært viktig for karbonopptak og -lagring. Skogen gir oss trevirke og vi kan høste av vilt, bær og sopp.'
    ],
    tema: ['skog', 'skog']
  },
  heiBuskmark: { tekst: ['Hei og buskmark er åpen fastmark med lyng, gras og busker, som fjellhei og kysthei.'] },
  liteVegetertMark: { tekst: ['Lite vegetert mark er bart fjell, ur, blokkmark, snø og is, der lite vokser.'] },
  vatmark: {
    tekst: ['Våtmark er åpen myr og annen våtmark, der jorda er vannmettet store deler av året.'],
    tema: ['vatmark', 'våtmark']
  },
  elverBekkerKanaler: { tekst: ['Elver, bekker og kanaler er rennende vann.'] },
  innsjoerVannmagasiner: { tekst: ['Innsjøer og vannmagasiner er innsjøer, tjern og regulerte magasiner.'] },
  kyststrenderSvabergDyner: {
    tekst: ['Kyststrender, svaberg og dyner er strender, svaberg og sanddyner langs kysten.']
  },
  hav: { tekst: ['Hav er sjøarealet innenfor kommunegrensen.'] }
};
/* Radene i rekkefølgen fra skissene */
const RADENE = [
  'bebygdOpparbeidetAreal',
  'dyrketmark',
  'grasmark',
  'skog',
  'heiBuskmark',
  'liteVegetertMark',
  'vatmark',
  'elverBekkerKanaler',
  'innsjoerVannmagasiner',
  'kyststrenderSvabergDyner',
  'hav'
];
const endringTekst = (d: number) => (d === 0 ? 'uendret' : `${d < 0 ? 'ned' : 'opp'} ${dekar(Math.abs(d))}`);

/* Hva slags natur ble bygget ned: en rad per hovedøkosystem med endringen fra regnskapet, som kan åpnes for å lese hva økosystemet
   er. Vann og hav er ikke med i de syntetiske endringstallene. */
function Endringer({ r }: { r: Okosystemregnskap }) {
  const [apen, settApen] = useState<string | null>(null);
  return (
    <div className="endringer">
      <div className="endringer-topp" aria-hidden="true">
        <span>Økosystem</span>
        <span>Endring</span>
        <span>Endring prosent</span>
      </div>
      <ul>
        {RADENE.map(kode => {
          const h = HOVEDOKOSYSTEMER.find(x => x.kode === kode)!,
            x = r.rader.find(y => y.kode === kode),
            o = OKOSYSTEMET[kode],
            er = apen === kode,
            andel = x && x.inngaende > 0 ? (x.endring / x.inngaende) * 100 : null;
          return (
            <li key={kode} className={er ? 'apen' : undefined}>
              <button type="button" aria-expanded={er} onClick={() => settApen(er ? null : kode)}>
                <b>{h.navn}</b>
                <span>{x ? endringTekst(x.endring) : '–'}</span>
                <span>{x ? <Endringsmerke d={x.endring} pst={andel} /> : null}</span>
                <span className="endring-mer">
                  {er ? 'Lukk' : 'mer'}
                  {er ? <MdIconClose aria-hidden="true" /> : <MdIconAdd aria-hidden="true" />}
                </span>
              </button>
              {er && (
                <div className="endring-tekst">
                  {o.tekst.map(t => (
                    <p key={t}>{t}</p>
                  ))}
                  {!x && <p className="hint">Vann og hav er ikke med i de syntetiske endringstallene.</p>}
                  {o.tema && (
                    <Lenke til={{ side: 'utforsk', tema: o.tema[0] }} className="pil-lenke md-link">
                      Mer om {o.tema[1]} →
                    </Lenke>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Et kort med kommunens plass blant kommunene: tittel, merket, hva det betyr, og en linje under. Merket står tomt (–) når tallet
   krever en dataplattform. */
function Plasskort({
  tittel,
  merke,
  tekst,
  under,
  god
}: {
  tittel: string;
  merke: string | null;
  tekst: string;
  under: string;
  god?: boolean;
}) {
  return (
    <li className={'plasskort' + (god ? ' god' : ' svak')}>
      <b>{tittel}</b>
      <span className={'plassmerke' + (merke ? '' : ' tom')}>{merke || '–'}</span>
      <p>{tekst}</p>
      <small>{under}</small>
    </li>
  );
}
/* Merket og linjen under for en plass, der 1 bygget ned mest */
function plassering(p: Plassering): [merke: string | null, under: string] {
  if (p.plass === null) return [null, 'Kan ikke sammenlignes'];
  const merke = p.plass <= 3 ? 'Bunn 3' : p.plass <= 10 ? 'Bunn 10' : `Nr. ${p.plass}`;
  return [
    merke,
    `Nr. ${p.plass} av ${p.av} kommuner som kan sammenlignes, svakere enn ${Math.floor(((p.av - p.plass) / p.av) * 100)} % av dem`
  ];
}
const DATAPLATTFORM = 'Krever dataplattform';

export function Oversikt() {
  const [vist, settVist] = useState<Klassevalg>('nat');
  const U = oversiktKort(),
    N = nedbygging(),
    S = sammenligning(),
    P = plansum(),
    R = okosystemregnskap(),
    k = kommunen(),
    jord = S.s === 'ok' && !S.v.endret ? plassering(S.v.jordbruk) : null,
    vat = S.s === 'ok' && !S.v.endret ? plassering(S.v.vatmark) : null,
    nedbygd = useSporsmal(['oversikt/nedbygd', 'naturregnskap']);
  return (
    <>
      <div className="innhold">
        <section className="oversikt-topp">
          <div className="oversikt-venstre">
            <h1 className="md-typography-heading-xl">Naturregnskap for {k} kommune</h1>
            {svar(U, u => (
              <ul className="klassekort">
                {u.klasser.map(x => (
                  <li key={x.id} className={'klassekort-' + x.id + (x.id === vist ? ' valgt' : '')}>
                    <button type="button" aria-pressed={x.id === vist} onClick={() => settVist(x.id as Klassevalg)}>
                      <span className="klassekort-topp">
                        <b>{KORTNAVN[x.id] || x.navn}</b>
                        {x.endring !== null && <Endringsmerke d={x.endring} pst={x.endring === 0 ? 0 : x.pst} />}
                      </span>
                      <span>
                        {prosent(x.andel)} av {kommunens()} landareal, {iTekst(x.km2)}
                      </span>
                      {x.endring !== null && (
                        <span>
                          {x.endring === 0
                            ? 'Uendret'
                            : `${x.endring < 0 ? 'Ned' : 'Opp'} ${iTekst(Math.abs(x.endring))}`}{' '}
                          ({u.fra}–{u.til})
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
            {U.s === 'ok' && U.v.syntetisk && <Syntetisk />}
            {N.s === 'ok' && N.v.flyttet && (
              <p className="hint">
                Kommunegrensen er flyttet siden {N.v.fra}. Endringen er regnet likevel, så den er mer usikker.
              </p>
            )}
            <div className="trekkspill-liste">
              <Trekkspill tittel="Hva vi legger i natur, jordbruk og bebygget?">
                <p>
                  Natur er skog, hei og buskmark, lite vegetert mark, våtmark og kyststrender, slik økosystemene deles
                  inn i naturregnskapet. Jordbruk er dyrket mark og grasmark. Bebygget er alt som er bygd eller
                  opparbeidet, som boliger, hytter, næring, veier og parker. Vann er ikke med.
                </p>
              </Trekkspill>
              <Trekkspill tittel="Hva er et naturregnskap?">
                <p>
                  Et naturregnskap viser hvor mye natur kommunen har, og hvordan den endrer seg. Her bygger det på åpne
                  data fra SSB, NIBIO, Miljødirektoratet og kommuneplanene hos DiBK.
                </p>
              </Trekkspill>
            </div>
          </div>
          <Kart
            lag={[{ ...KLASSER, av: true }, KLASSEKART[vist][0], PLAN]}
            enkel={KLASSEKART[vist][1](k)}
            enkelFarge={vist}
          />
        </section>
      </div>
      <Baand>
        <p className="baand-tekst">
          Norges natur bygges ned bit for bit.{' '}
          {S.s === 'ok' && !S.v.endret && S.v.naturtap.andelAvNorge !== null && (
            <>
              {k} bidrar med <Merket>{pst2(S.v.naturtap.andelAvNorge)}</Merket> av Norges totale naturtap, noe som vil
              si at kommunen ligger {S.v.naturtap.andelAvNorge >= S.v.naturtap.snitt ? 'over' : 'under'} gjennomsnittet
              for norske kommuner.
            </>
          )}
        </p>
        {S.s === 'henter' && <p className="hint">Regner ut hvor stor del av Norges naturtap det er …</p>}
        {S.s === 'ok' && S.v.syntetisk && <Syntetisk />}
      </Baand>
      <div className="innhold">
        <section className="nedbygd">
          <div className="seksjonstopp">
            <div className="korttittel">
              <h2 className="md-typography-heading-l">Hva slags natur ble bygget ned?</h2>
              {nedbygd.knapp}
            </div>
            <Lenke til={{ side: 'naturtapet' }} className="pil-lenke md-link">
              Mer om naturtapet →
            </Lenke>
          </div>
          {nedbygd.panel}
          {N.s === 'ok' && N.v.endret && (
            <p className="seksjonsingress">
              Kommunegrensen er flyttet siden {N.v.fra}, så hvor mye natur som er bygget ned, kan ikke regnes ut.
            </p>
          )}
          {N.s === 'ok' && !N.v.endret && (
            <p className="seksjonsingress">
              <span className="ingressmerke">{iTekst(N.v.natur.nedbygd)}</span>
              {N.v.natur.andel !== null && <> ({pst2(N.v.natur.andel)})</>} ble bygget ned i {k} mellom {N.v.fra} og{' '}
              {N.v.til}.
              {S.s === 'ok' && !S.v.endret && N.v.natur.andel !== null && S.v.natur.norge !== null && (
                <> Dette er {N.v.natur.andel >= S.v.natur.norge ? 'over' : 'under'} gjennomsnittet i Norge.</>
              )}{' '}
              Her kan du se nøyere på denne naturen, og hvilke økosystem som ble bygget ned i {k}.
            </p>
          )}
          {svar(R, r =>
            r.endret ? null : (
              <>
                <Endringer r={r} />
                {r.syntetisk && <Syntetisk />}
              </>
            )
          )}
          <div className="trekkspill-liste">
            <Trekkspill tittel="Hva er et økosystem?">
              <p>
                Et økosystem er et område med planter, dyr og andre levende organismer og miljøet de lever i, som en
                skog eller en myr. Her er arealet delt inn i elleve hovedøkosystemer, slik som i naturregnskapet.
              </p>
            </Trekkspill>
            <Trekkspill tittel="Hva er forskjellen fra økosystemtype og naturtyper i NiN?">
              <p>
                Økosystemtypene her er grove, og dekker hele kommunen. Naturtyper etter Natur i Norge (NiN) er mye mer
                detaljerte, og kartlegges i felt, bare i noen områder. Kartlagte naturtyper finner du under Verdsatte
                naturtyper.
              </p>
            </Trekkspill>
            <Trekkspill tittel="Hvor kommer tallene fra?">
              <p>{SYNTETISK_TEKST}</p>
              <p>Vann og hav er ikke med i de syntetiske endringstallene.</p>
              <Kilde kilder={['ssb']} />
            </Trekkspill>
          </div>
        </section>
      </div>
      <Baand speilet>
        <p className="baand-tekst">
          {P ? (
            <>
              Kommuneplanen setter av <Merket>{iTekst(P.nat)}</Merket> natur og <Merket>{iTekst(P.jor)}</Merket>{' '}
              jordbruk til utbygging.
            </>
          ) : (
            'Hvor mye natur kommuneplanen setter av til utbygging, regnes ut når kartet for kommunen er hentet.'
          )}
        </p>
        <Lenke til={{ side: 'naturtapet' }} className="pil-lenke md-link baand-lenke">
          Mer om naturtap →
        </Lenke>
      </Baand>
      <div className="innhold">
        <section className="sammenligning">
          <MedSporsmal forklaring={['oversikt/sammenligning', 'sammenligning']}>
            <h2 className="md-typography-heading-l">{k} sammenlignet med resten av Norge</h2>
          </MedSporsmal>
          <p className="seksjonsingress">
            Vi har sammenlignet kart og naturdata for alle Norges kommuner og trekker frem tre høydepunkt og tre
            forbedringsområder.
          </p>
          <h3 className="md-typography-heading-s">Tre høydepunkt</h3>
          <ul className="plasskortene">
            <Plasskort
              god
              tittel="Villreinområder"
              merke={null}
              tekst={`av alle villreinområdene i Norge ligger i ${k}`}
              under={DATAPLATTFORM}
            />
            <Plasskort
              god
              tittel="Naturskog"
              merke={null}
              tekst="av de kommunene med mest naturskog i Norge"
              under={DATAPLATTFORM}
            />
            <Plasskort
              god
              tittel="Kartleggingsgrad"
              merke={null}
              tekst="plass av alle 357 kommuner på kartleggingsgrad i Norge"
              under={DATAPLATTFORM}
            />
          </ul>
          <h3 className="md-typography-heading-s">Tre forbedringsområder</h3>
          <ul className="plasskortene">
            <Plasskort
              tittel="Landbruksjord"
              merke={jord ? jord[0] : null}
              tekst={`av kommunene som har bygget ned mest landbruksjord fra ${S.s === 'ok' ? S.v.fra : '2017'} til ${S.s === 'ok' ? S.v.til : '2024'}`}
              under={jord ? jord[1] : S.s === 'henter' ? 'Henter …' : 'Kan ikke sammenlignes'}
            />
            <Plasskort
              tittel="Våtmark"
              merke={vat ? vat[0] : null}
              tekst={`av kommunene som har bygget ned mest våtmark fra ${S.s === 'ok' ? S.v.fra : '2017'} til ${S.s === 'ok' ? S.v.til : '2024'}`}
              under={vat ? vat[1] : S.s === 'henter' ? 'Henter …' : 'Kan ikke sammenlignes'}
            />
            <Plasskort
              tittel="Inngrepsfri natur"
              merke={null}
              tekst="blant alle Norges kommuner når det kommer til størrelse på inngrepsfri natur"
              under={DATAPLATTFORM}
            />
          </ul>
          {S.s === 'ok' && S.v.syntetisk && <Syntetisk />}
          <div className="trekkspill-liste">
            <Trekkspill tittel="Hvor kommer tallene fra?">
              <p>
                Landbruksjord og våtmark som er bygget ned, og skog og våtmark mot gjennomsnittet under «Utforsk
                naturen», er regnet ut av SSBs tall for alle kommuner. Plassen er blant de{' '}
                {S.s === 'ok' ? S.v.jordbruk.av : 352} kommunene som kan sammenlignes med 2017. Skog og våtmark er her
                SSBs arealklasser, ikke grunnkartet som på temasidene.
              </p>
              <p>{SYNTETISK_TEKST}</p>
              <p>
                Villreinområder, naturskog, kartleggingsgrad og inngrepsfri natur krever kartdata regnet ut på forhånd
                for alle kommuner, en dataplattform. Til den finnes, står de tomme.
              </p>
            </Trekkspill>
            <Trekkspill tittel="Hva legger vi i høydepunkt og forbedringspunkt?">
              <p>
                Et høydepunkt er noe kommunen har mye av, eller gjør bedre enn de fleste kommuner. Et forbedringsområde
                er noe kommunen gjør svakere enn de fleste, som å bygge ned mye landbruksjord eller våtmark.
              </p>
            </Trekkspill>
          </div>
        </section>
        <section className="utforsk-del">
          <div className="seksjonstopp">
            <h2 className="md-typography-heading-l">Utforsk naturen i {k}</h2>
            <Lenke til={{ side: 'utforsk' }} className="mer-lenke md-link">
              Mer →
            </Lenke>
          </div>
          <Temagrupper oversikt />
        </section>
      </div>
    </>
  );
}

export function Utforsk() {
  return (
    <div className="innhold">
      <section className="sidetopp">
        <h1 className="md-typography-heading-xl">Utforsk naturen i {kommunen()}</h1>
        <p className="ingress">
          Velg et perspektiv for å se hvor mye det er av det i kommunen, hvor det ligger, og hvor mye som er satt av til
          utbygging.
        </p>
      </section>
      <Temagrupper />
    </div>
  );
}

export function Hjelp() {
  return (
    <div className="innhold smal">
      <section className="sidetopp">
        <h1 className="md-typography-heading-xl">Hjelp og veileder</h1>
        <p className="ingress">
          Dette er en prototyp. Utseendet og navigeringen er fra Figma-skissene for naturregnskapet. Tallene og kartet
          kommer fra den samme datamotoren som dagens løsning, som henter alt direkte fra åpne kilder.
        </p>
      </section>
      <h2 className="md-typography-heading-m">Hva som er ekte, og hva som mangler</h2>
      <p>
        Alle tall på sidene er ekte og gjelder kommunen du har valgt. Der skissene viser noe datamotoren ikke har ennå,
        står det en ramme merket «Ikke laget ennå», med det som trengs. Bildene fra skissene er ikke med, fordi
        rettighetene ikke er avklart. Temaene har i stedet en enkel illustrasjon som er laget med KI, og merket med det.
      </p>
      <p>
        Naturtapet og Utforsk i kart er ikke tegnet i skissene. Der er oppsettet og teksten et forslag laget med KI,
        satt sammen av de samme delene som de tegnede sidene, og merket øverst på siden.
      </p>
      {FLAGG.egneAnalyser && (
        <p>
          På Naturtapet kan du lage egne analyser: tegne et område i kartet eller laste opp en plan som GeoJSON. Tallene
          for planlagt utbygging regnes da med området i stedet for kommuneplanen der det ligger, med de samme analysene
          som for kommuneplanen, og Naturtapet viser forskjellen. Ingenting lagres eller sendes fra nettleseren, og
          områdene forsvinner når siden lukkes.
        </p>
      )}
      <h2 className="md-typography-heading-m">Kildene</h2>
      <ul className="kildeliste">
        {Object.values(KILDE).map(k => (
          <li key={k.adresse}>
            <a href={k.adresse} target="_blank" rel="noopener">
              {k.datasett}
            </a>
            , {k.navn}. Lisens: {k.lisens}.
          </li>
        ))}
      </ul>
      <h2 className="md-typography-heading-m">Mer</h2>
      <p>
        <a href={`../#${app.valgt ? app.valgt.nr : ''}/om`}>Om og metode i dagens løsning</a> forklarer hvordan tallene
        er regnet ut. Temaene her er {TEMAER.length}, i tre grupper.
      </p>
    </div>
  );
}

export function Ukjent() {
  return (
    <div className="innhold smal">
      <section className="sidetopp">
        <h1 className="md-typography-heading-xl">Fant ikke siden</h1>
        <p className="ingress">Adressen finnes ikke. Kanskje lenken er gammel, eller det er en skrivefeil.</p>
      </section>
      <Fremhevet>
        <Lenke til={{ side: 'oversikt' }}>Gå til oversikten for {kommunen()}</Lenke>
      </Fremhevet>
    </div>
  );
}
