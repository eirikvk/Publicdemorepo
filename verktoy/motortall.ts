/* Tallene motoren har regnet ut, hentet fra tilstanden i siden (window.motor, som siden setter med ?teknisk). Brukes av
   regresjonstesten, så tallene kan sammenlignes direkte og ikke bare som tekst. Funksjonen kjøres i nettleseren.
   Testen leser også eldre utgaver av siden, der tilstanden har en annen form. Derfor er tilstanden beskrevet som fri (Fritt) her,
   og ikke med typene fra src: verdiene rundes av og sammenlignes som de er, og navn som bare finnes i eldre utgaver, leses også. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fritt = any;
export interface Motor {
  app: Fritt;
  ui?: Fritt;
  NATURTEMA?: Fritt;
  NATURLAG?: Fritt /* temaene, under det gamle navnet */;
  readonly kart: Fritt;
}
declare global {
  interface Window {
    motor?: Motor;
  }
}
export function motortall() {
  const M = window.motor;
  if (!M) return null;
  const A = M.app,
    T: Fritt[] = M.NATURTEMA || M.NATURLAG /* temaene, under det nye eller det gamle navnet */,
    side = (id: string) => (M.ui ? M.ui.side === id : null),
    r = (x: unknown) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x),
    rund = (o: Fritt): Fritt =>
      o == null
        ? o
        : Array.isArray(o) || ArrayBuffer.isView(o)
          ? Array.from(o as ArrayLike<Fritt>, rund)
          : typeof o === 'object'
            ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rund(v)]))
            : r(o);
  const plukk = (o: Fritt, ...navn: string[]) => (o ? Object.fromEntries(navn.map(n => [n, rund(o[n])])) : null);
  const R = A.planRaster && A.valgt && A.planRaster.nr === A.valgt.nr ? A.planRaster : null;
  const sum = (o: Fritt[], f: string) => o.reduce((s, x) => s + (x[f] || 0), 0);
  return {
    valgt: A.valgt && A.valgt.nr,
    arealtall: plukk(A.arealtall, 'tilstand', 'a', 'aar'),
    ferskvann: rund(A.ferskvann),
    flate: r(A.flate),
    historie: plukk(A.historie, 'fra', 'til', 'a0', 'a1', 'endret'),
    planInfo: A.planInfo && {
      ...plukk(A.planInfo, 'tilstand', 'dekning'),
      /* teksten om planen: før lå den ferdig i tilstanden, nå lages den av opplysningene */
      kilde:
        'kilde' in A.planInfo
          ? A.planInfo.kilde
          : A.planInfo.plan
            ? `plan ${A.planInfo.plan.id}${A.planInfo.plan.vert ? ' fra ' + A.planInfo.plan.vert : ''}${A.planInfo.plan.kopiert ? `, kopiert til DiBK ${A.planInfo.plan.kopiert[2]}.${A.planInfo.plan.kopiert[1]}.${A.planInfo.plan.kopiert[0]}` : ''}`
            : A.planInfo.tilstand === 'ok' || A.planInfo.tilstand === 'ingen'
              ? ''
              : undefined
    },
    planTall: A.planTall && A.planTall.tilstand,
    plan: R && {
      ...plukk(R, 'n', 'sum', 'iDag', 'delvis', 'fliser', 'rute', 'w', 'h', 'antallEgne', 'egneTall'),
      basis: R.basis ? { rn: R.basis.rn, rj: R.basis.rj } : null
    },
    planSum: rund(A.planSum),
    tema: T.map(t => {
      const D = t.data;
      if (!D || !A.valgt || D.nr !== A.valgt.nr) return { id: t.id, data: null };
      const o = D.omrader || [],
        /* ruter med planlagt utbygging per område: før lå de på områdene, nå i egne lister i temaets data */
        per = (f: string): number[] => (D[f] ? Array.from(D[f]) : o.map((x: Fritt) => x[f] || 0));
      return {
        id: t.id,
        feil: !!D.feil,
        sum: r(D.sum),
        antall: o.length,
        klasser: rund(D.klasser || null),
        regnet: !!D.regnet,
        plan: per('plan').reduce((s, x) => s + x, 0),
        smal: per('smal').reduce((s, x) => s + x, 0),
        berort: per('plan').filter(x => x).length,
        kryss: D.kryss ? { S: rund(D.kryss.S), P: D.kryss.P ? rund(D.kryss.P) : null } : null,
        gap: D.gap ? { nat: D.gap.nat, ukjent: D.gap.ukjent, plan: D.gap.plan ? rund(D.gap.plan) : null } : null,
        kartlagt: D.ekstra ? r(D.ekstra.km2) : null,
        inne: D.inne ? rund(D.inne) : D.ekstra && D.ekstra.inne ? rund(D.ekstra.inne) : null
      };
    }),
    inon: plukk(A.inon, 'tilstand', 'soner', 'sum'),
    graa: plukk(A.graa, 'tilstand', 'trinn', 'sum'),
    graaKryss: plukk(A.graaKryss, 'S', 'P', 'bebygd', 'gront', 'delvis', 'antallEgne'),
    egne: A.egne.map((g: Fritt) => ({
      navn: g.navn,
      kilde: g.kilde,
      km2: r(g.km2),
      deler: g.deler.length,
      tall: rund(g.tall)
    })),
    vis: {
      inon: M.ui ? side('inon') : A.inonPaa,
      graa: M.ui ? side('graa') : A.graaPaa,
      smale: M.ui ? M.ui.visSmale : A.visSmale
    },
    tema_paa: T.map(t => (M.ui ? side(t.id) : t.paa))
  };
}
