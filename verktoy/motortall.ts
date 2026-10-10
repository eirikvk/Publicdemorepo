/* Tallene datamotoren har regnet ut, hentet fra window.motor, som siden setter med ?teknisk (se src/ui/teknisk.ts). Brukes av
   regresjonstesten, så tallene kan sammenlignes direkte og ikke bare som tekst. Funksjonen kjøres i nettleseren, så den kan bare
   bruke det som finnes i siden: typene hentes fra src, men ingen funksjoner. */
import type { Motor } from '../src/ui/teknisk.ts';

export function motortall() {
  const M: Motor | undefined = window.motor;
  if (!M) return null;
  const A = M.app,
    side = (id: string) => M.ui.side === id,
    r = (x: unknown) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x),
    rund = (o: unknown): unknown =>
      o == null
        ? o
        : Array.isArray(o) || ArrayBuffer.isView(o)
          ? Array.from(o as ArrayLike<unknown>, rund)
          : typeof o === 'object'
            ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rund(v)]))
            : r(o);
  /* Utvalgte felt fra o, avrundet */
  const plukk = <T extends object, K extends keyof T>(o: T | null, ...navn: K[]) =>
    o ? Object.fromEntries(navn.map(n => [n, rund(o[n])])) : null;
  const R = A.planRaster && A.valgt && A.planRaster.nr === A.valgt.nr ? A.planRaster : null;
  return {
    valgt: A.valgt && A.valgt.nr,
    arealtall: plukk(A.arealtall, 'tilstand', 'a', 'aar'),
    ferskvann: rund(A.ferskvann),
    flate: r(A.flate),
    historie: plukk(A.historie, 'fra', 'til', 'a0', 'a1', 'endret'),
    planInfo: plukk(A.planInfo, 'tilstand', 'dekning', 'plan'),
    planTall: A.planTall && A.planTall.tilstand,
    plan: R && {
      ...plukk(R, 'n', 'sum', 'iDag', 'delvis', 'fliser', 'rute', 'w', 'h', 'antallEgne', 'egneTall'),
      basis: R.basis ? { rn: R.basis.rn, rj: R.basis.rj } : null
    },
    planSum: rund(A.planSum),
    tema: M.NATURTEMA.map(t => {
      const D = t.data;
      if (!D || !A.valgt || D.nr !== A.valgt.nr) return { id: t.id, data: null };
      /* ruter med planlagt utbygging per område, og av dem i smale striper */
      const plan = Array.from(D.plan || []),
        smal = Array.from(D.smal || []);
      return {
        id: t.id,
        feil: !!D.feil,
        sum: r(D.sum),
        antall: D.omrader.length,
        klasser: rund(D.klasser || null),
        regnet: !!D.regnet,
        plan: plan.reduce((s, x) => s + x, 0),
        smal: smal.reduce((s, x) => s + x, 0),
        berort: plan.filter(x => x).length,
        kryss: D.kryss ? { S: rund(D.kryss.S), P: D.kryss.P ? rund(D.kryss.P) : null } : null,
        gap: D.gap ? { nat: D.gap.nat, ukjent: D.gap.ukjent, plan: D.gap.plan ? rund(D.gap.plan) : null } : null,
        kartlagt: D.ekstra ? r(D.ekstra.km2) : null,
        inne: D.inne ? rund(D.inne) : null
      };
    }),
    inon: plukk(A.inon, 'tilstand', 'soner', 'sum'),
    graa: plukk(A.graa, 'tilstand', 'trinn', 'sum'),
    graaKryss: plukk(A.graaKryss, 'S', 'P', 'bebygd', 'gront', 'delvis', 'antallEgne'),
    egne: A.egne.map(g => ({ navn: g.navn, kilde: g.kilde, km2: r(g.km2), deler: g.deler.length, tall: rund(g.tall) })),
    vis: { inon: side('inon'), graa: side('graa'), smale: M.ui.visSmale },
    tema_paa: M.NATURTEMA.map(t => side(t.id))
  };
}
