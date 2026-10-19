/* Naturtapet: hvor mye natur og jordbruk kommuneplanen setter av til utbygging, hvor mye av det som ligger i verdifull natur, og hva som
   ble bygget ned fra 2017 til 2024. Siden er tom i skissene, så den følger malen for temasidene: toppen med ikon, ingress, trekkspill
   og illustrasjon, tallkortene, kartet, figurene med tekst og kilde, ofte stilte spørsmål, ressurser og flisene til temaene. Fremover
   (kommuneplanen) står først, og et blått bånd, som på oversikten, leder over til det som alt er bygget ned (SSB). Tallene kommer fra
   datamotoren (tall.ts), og teksten er et KI-generert forslag, merket øverst.

   Egne analyser (komponenter/Egne.tsx): ved kartet kan man tegne et område eller laste opp en plan. Da er tallene på siden regnet
   med området i stedet for kommuneplanen der det ligger, og hvert tall viser også kommuneplanen alene: endringen under tallkortene,
   hule og fylte stolper i figurene, og grått areal i begge. Kortene for områdene står rett under kartet. */
import { KILDE } from '../../src/data/katalog.ts';
import { app } from '../../src/data/motor/tilstand.ts';
import { andelTekst, dekar, iTekst, pst } from '../tekst.ts';
import { lastOppPlan } from '../../src/data/motor/egne.ts';
import Kart, { EGNE, KLASSER, PLAN } from '../komponenter/Kart.tsx';
import { EgneMerke, EgneOmrader, EgneVerktoy, Endring, Tegnelinje, harEgne } from '../komponenter/Egne.tsx';
import { FLAGG } from '../flagg.ts';
import Tabell from '../komponenter/Tabell.tsx';
import {
  Baand,
  Figur,
  Forslag,
  Fremhevet,
  Helt,
  Lenke,
  Liggende,
  Merket,
  NestePerspektiv,
  Parstolper,
  type Par,
  Ressurser,
  SYNTETISK_TEKST,
  Sporsmal,
  Syntetisk,
  Tallkort,
  Trekkspill,
  svar
} from '../komponenter/deler.tsx';
import {
  egenRad,
  egne,
  graaIPlan,
  naturtema,
  nedbygging,
  okosystemregnskap,
  planPerOkosystem,
  planlagt
} from '../tall.ts';
import { RESTKLASSER, okosystemfarge } from '../temalag.ts';
import type { Tema } from '../temaer.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');
const regnes = <span className="henter">Regnes ut …</span>;

/* Toppen av siden, som en temaside: tittelen, ingressen og fargen bak illustrasjonen */
const toppen = (): Tema => ({
  id: 'naturtapet',
  navn: `Naturtapet i ${kommunen()}`,
  gruppe: '',
  kartside: 'oversikt',
  farge: 'beb',
  ingress:
    'Naturtap er natur som blir bygget ned, eller endret så mye at den ikke lenger er natur. Arealendringer er den største trusselen mot naturmangfoldet, og det meste skjer bit for bit, gjennom mange små inngrep.\n\nHer ser du hvor mye natur og jordbruk kommuneplanen setter av til utbygging, hvor mye av det som ligger i verdifull natur, og hvor mye som ble bygget ned fra 2017 til 2024.'
});

/* Planlagt utbygging per økosystemtype med kommuneplanen alene og med egne områder, fra gull.egneOkosystemer. Restklassene står
   bare med når de har noe. */
function okosystemPar(): Par[] | null {
  const O = egne().oko;
  return O
    ? O.kommune
        .filter(r => r.ny > 0 || !!r.plan || !RESTKLASSER.includes(r.navn))
        .map(r => ({ navn: r.navn, farge: okosystemfarge(r.navn), for: r.plan, etter: r.ny, endring: r.endring }))
    : null;
}

export default function Naturtapet() {
  const P = planlagt(),
    PD = planPerOkosystem(),
    R = okosystemregnskap(),
    N = nedbygging(),
    G = graaIPlan(),
    k = kommunen(),
    E = harEgne() ? egne() : null,
    temaer = (
      [
        ['Verneområder', 'vern', 'vern'],
        ['Villreinområder', 'rein', 'rein'],
        ['Verdsatt natur', 'verdi', 'verdi2']
      ] as const
    ).map(([navn, id, farge]) => ({ navn, id, farge, plan: naturtema(id).plan })),
    /* Med egne områder: temaene fra sammenligningen. Et tema kommunen ikke har, står med null. */
    harPlan = !!E && !!E.rader && E.rader.kommune.some(r => r.plan !== null),
    temaPar: Par[] | null =
      E && E.rader
        ? temaer.map(t => {
            const r = egenRad(t.id);
            return r
              ? { navn: t.navn, farge: t.farge, for: r.plan, etter: r.ny, endring: r.endring }
              : { navn: t.navn, farge: t.farge, for: harPlan ? 0 : null, etter: 0, endring: 0 };
          })
        : null,
    oko = E ? okosystemPar() : null,
    graaRad = E ? egenRad('graa2') : null;
  return (
    <>
      <div className="innhold">
        <Forslag />
        <Helt tema={toppen()} ikon="utbygging" bilde="naturtap">
          <Trekkspill tittel="Hva regnes som naturtap her?">
            <p>
              Her er naturtap natur og jordbruk som blir bygget ned: bygninger, veier og annet som anlegges. Natur som
              endres på andre måter, som ved hogst, grøfting eller gjengroing, er ikke med.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hvordan henger planen og regnskapet sammen?">
            <p>
              Planlagt utbygging er areal kommuneplanen setter av til bebyggelse, anlegg eller samferdsel, men som ikke
              er bygd ennå. Regnskapet fra SSB viser det som alt er bygget ned. Sammen viser de naturtapet fremover og
              bakover.
            </p>
          </Trekkspill>
        </Helt>
        <EgneMerke />
        <Tallkort
          kort={[
            [
              'Natur satt av til utbygging',
              P ? (
                <>
                  {iTekst(P.natur.km2)}
                  {E && <Endring r={egenRad('pnat')} />}
                </>
              ) : (
                regnes
              ),
              ['naturtapet/kort-natur', 'planlagt']
            ],
            [
              'Andel av naturen i kommunen',
              P ? (
                <>
                  {prosent(P.natur.andel)}
                  {E && <Endring r={egenRad('pnat')} andel />}
                </>
              ) : (
                regnes
              ),
              ['naturtapet/kort-andel', 'planlagt']
            ],
            [
              'Jordbruk satt av til utbygging',
              P ? (
                <>
                  {iTekst(P.jordbruk.km2)}
                  {E && <Endring r={egenRad('pjor')} />}
                </>
              ) : (
                regnes
              ),
              ['naturtapet/kort-jordbruk', 'planlagt']
            ]
          ]}
        />
        <div className="trekkspill-liste etter-tallkort">
          <Trekkspill tittel="Hvor er tallene hentet fra?">
            <p>
              Planlagt utbygging er arealformål for utbygging i kommuneplanen hos DiBK, som ennå ikke er bygd, krysset
              med dagens arealklasser fra NIBIO. Smale striper er ikke med i tallene. Andelen er av naturen i kommunen i
              dag.
            </p>
          </Trekkspill>
        </div>
      </div>
      <Kart
        lag={FLAGG.egneAnalyser ? [EGNE, PLAN, KLASSER] : [PLAN, KLASSER]}
        underLag={FLAGG.egneAnalyser && <EgneVerktoy />}
        verktoy={FLAGG.egneAnalyser && <Tegnelinje />}
        slipp={FLAGG.egneAnalyser ? lastOppPlan : undefined}
        etter={
          <div className="trekkspill-liste">
            <Trekkspill tittel="Hva viser kartet?">
              <p>
                Dagens arealklasser fra grunnkartet, med planlagt utbygging fra kommuneplanen oppå: svart der planen
                setter av natur, og brunt der den setter av jordbruk. Hvert lag kan slås av og på. I{' '}
                <Lenke til={{ side: 'kart' }} className="md-link">
                  Utforsk i kart
                </Lenke>{' '}
                kan du se planlagt utbygging sammen med hvert av temaene, som verneområder og verdsatte naturtyper.
              </p>
              {FLAGG.egneAnalyser && (
                <p>
                  Egne områder har blått omriss med nummer: helt for utbygging og stiplet for ikke utbygging. En
                  opplastet plan har ikke omriss, men vises i planlagt utbygging.
                </p>
              )}
            </Trekkspill>
          </div>
        }
      />
      <div className="innhold">
        <EgneOmrader />
        <Figur
          tittel={
            E ? 'Hva slags natur som settes av til utbygging' : 'Hva slags natur kommuneplanen setter av til utbygging'
          }
          forklaring={['naturtapet/figur-okosystemtype', 'planPerOkosystem']}
          tekst={
            E ? (
              <p>
                Natur og jordbruk som settes av til utbygging, per økosystemtype i grunnkartet: med kommuneplanen alene
                (hul stolpe) og med egne områder (fylt stolpe), og forskjellen. Myr og beite med trær er med i skogen.
                Smale striper er ikke med.
              </p>
            ) : (
              <p>
                Natur og jordbruk som kommuneplanen setter av til utbygging, per økosystemtype i grunnkartet, og hvor
                stor del av typen i kommunen det er. Myr og beite med trær er med i skogen. Smale striper er ikke med.
              </p>
            )
          }
          kilder={['grunnkart', 'dibk']}
        >
          {E ? (
            oko && oko.some(r => r.etter > 0 || !!r.for) ? (
              <Parstolper hva="Satt av til utbygging per økosystemtype, med og uten egne områder" data={oko} />
            ) : oko ? (
              <p>Verken kommuneplanen eller egne områder setter av natur eller jordbruk til utbygging.</p>
            ) : E.venter ? (
              <p className="henter">Regner ut planlagt utbygging per økosystemtype …</p>
            ) : (
              <p className="mangler-tall">Kunne ikke regnes ut for kommunen</p>
            )
          ) : (
            svar(
              PD,
              p => {
                const rader = p.rader.filter(r => r.km2 > 0 || !RESTKLASSER.includes(r.navn)),
                  andel = new Map(rader.map(r => [r.navn, r.andel]));
                return rader.some(r => r.km2 > 0) ? (
                  <Liggende
                    hva="Satt av til utbygging per økosystemtype"
                    data={rader.map(r => ({ navn: r.navn, km2: r.km2, farge: okosystemfarge(r.navn) }))}
                    tekst={x => {
                      const a = andel.get(x.navn);
                      return `${iTekst(x.km2)}${a !== null && a !== undefined ? ` (${andelTekst(a)} av typen)` : ''}`;
                    }}
                  />
                ) : (
                  <p>Kommuneplanen setter ikke av natur eller jordbruk til utbygging.</p>
                );
              },
              'Kommunen har ingen kommuneplan med utbygging hos DiBK.'
            )
          )}
        </Figur>
        <Figur
          tittel="Planlagt utbygging i verdifull natur"
          forklaring={['naturtapet/figur-verdifull-natur', 'planIVerdifull']}
          tekst={
            <p>
              Hvor mye av den planlagte utbyggingen som ligger i verneområder, villreinområder og verdsatt natur
              {E ? ', med kommuneplanen alene (hul stolpe) og med egne områder (fylt stolpe)' : ''}. Der temaene
              overlapper, telles utbyggingen i hvert av dem.
            </p>
          }
          kilder={['dibk', 'vern', 'villrein', 'verdsatt']}
        >
          {E ? (
            temaPar ? (
              <Parstolper hva="Planlagt utbygging per tema, med og uten egne områder" data={temaPar} />
            ) : (
              <p className="henter">Regnes ut …</p>
            )
          ) : temaer.every(t => t.plan) ? (
            <Liggende
              hva="Planlagt utbygging per tema"
              data={temaer.map(t => ({ navn: t.navn, km2: t.plan!.planKm2, farge: t.farge }))}
            />
          ) : (
            <p className="henter">Regnes ut når kartet for kommunen er hentet …</p>
          )}
        </Figur>
        {G && G.plan && (
          <Fremhevet>
            <b>
              Av ca. {iTekst(G.plan.km2)} planlagt utbygging på land ligger ca. {iTekst(G.plan.graa)} (
              {prosent(G.plan.andelGraa)}) på grått areal, som alt er tatt i bruk.
            </b>
            {graaRad && graaRad.plan !== null && (
              <span>
                Med kommuneplanen alene er det ca. {iTekst(graaRad.plan)}
                {Math.abs(graaRad.endring) * 1000 < 0.5
                  ? ', det samme'
                  : `, altså ${iTekst(Math.abs(graaRad.endring))} ${graaRad.endring > 0 ? 'mindre' : 'mer'}`}
                .
              </span>
            )}
            <span>Her er all planlagt utbygging med, også på bebygd areal og i smale striper.</span>
          </Fremhevet>
        )}
      </div>
      <Baand speilet>
        <p className="baand-tekst">
          {N.s === 'ok' && !N.v.endret ? (
            <>
              Mellom {N.v.fra} og {N.v.til} ble <Merket>{iTekst(N.v.natur.nedbygd)}</Merket> natur og{' '}
              <Merket>{iTekst(N.v.jordbruk.nedbygd)}</Merket> jordbruk bygget ned i {k}.
            </>
          ) : N.s === 'ok' ? (
            `Kommunegrensen er flyttet siden ${N.v.fra}, så hvor mye som ble bygget ned i ${k}, kan ikke regnes ut.`
          ) : (
            `Hvor mye som ble bygget ned i ${k} fra 2017 til 2024, regnes ut.`
          )}
        </p>
        {N.s === 'ok' && N.v.syntetisk && <Syntetisk />}
      </Baand>
      <div className="innhold">
        <Figur
          tittel="Regnskapet fra SSB"
          forklaring={['naturtapet/figur-regnskap', 'naturregnskap']}
          tekst={
            <>
              <p>
                Arealet per hovedøkosystem på land i 2017 (inngående), endringen mot bebygd, og arealet i 2024
                (utgående).
              </p>
              <p className="hint">{SYNTETISK_TEKST}</p>
            </>
          }
          kilder={['ssb']}
        >
          {svar(R, r =>
            r.endret ? (
              <p>Kommunegrensen er flyttet, så årene kan ikke sammenlignes.</p>
            ) : (
              <>
                <Tabell
                  hva="Regnskapet per hovedøkosystem"
                  kolonner={[
                    { navn: 'Økosystemtype' },
                    { navn: r.fra, tall: true, ikkeMobil: true },
                    { navn: 'Endring', tall: true },
                    { navn: r.til, tall: true }
                  ]}
                  rader={r.rader
                    .filter(x => x.utgaende > 0 || x.endring !== 0)
                    .map(x => [
                      x.navn,
                      dekar(x.inngaende),
                      (x.endring < 0 ? '−' : x.endring > 0 ? '+' : '') + dekar(Math.abs(x.endring)),
                      dekar(x.utgaende)
                    ])}
                />
                {r.syntetisk && <Syntetisk />}
              </>
            )
          )}
        </Figur>
        <Figur
          tittel="Målt naturtap over tid"
          tekst={
            <p>
              Hvor mye natur som er bygget ned hvert år, målt i kartet i stedet for å trekke to årganger av statistikken
              fra hverandre.
            </p>
          }
          kilder={[]}
          tom="kart over arealklassene for flere år, så endringen kan måles."
        />
        <Sporsmal
          liste={[
            [
              'Er planlagt utbygging det samme som naturtap?',
              <p>
                Nei. Planlagt utbygging er areal kommuneplanen setter av, men som ikke er bygd ennå. Noe blir bygd, noe
                tar lang tid, og noe kan bli tatt ut av planen når den rulleres. Naturtapet skjer først når arealet
                bygges ned.
              </p>
            ],
            [
              'Hvorfor er tallene fra SSB syntetiske?',
              <p>
                SSBs tabeller for naturregnskapet publiseres 25. november 2026. Til da står det tall laget av SSBs
                arealstatistikk for 2017 og 2024 med en fast regel. De gir riktig størrelsesorden, men er ikke målt
                endring.
              </p>
            ],
            [
              'Hva kan kommunen gjøre for å bygge ned mindre natur?',
              <p>
                Kommunen kan ta ut utbyggingsområder som ikke er bygd, bygge tettere på areal som alt er tatt i bruk, og
                legge vekt på naturverdiene når planen rulleres. Noen kommuner har vedtatt arealnøytralitet: ny
                utbygging på natur skal veies opp ved at like mye areal blir natur igjen.
              </p>
            ]
          ]}
        />
        <Ressurser
          lenker={[
            ['Kommuneplaner hos DiBK', KILDE.dibk.adresse],
            ['SSB, tabell 09594', KILDE.ssb.adresse],
            ['Utvikling fremover i dagens løsning', `../#${app.valgt ? app.valgt.nr : ''}/framtid`]
          ]}
        />
        <NestePerspektiv />
      </div>
    </>
  );
}
