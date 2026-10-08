/* Regresjonstest for siden. Bygger siden, kjører et fast sett handlinger i en mobilnettleser (Chromium via Playwright), og lagrer
   tallene motoren har regnet ut, teksten siden viser og skjermbilder av kartet. To kjøringer kan sammenlignes, så en endring i koden
   kan sjekkes mot en tidligere utgave. Tallene kommer fra åpne tjenester og endrer seg over tid, så en referanse må tas samme dag.

   Kjør:        node verktoy/regresjon.js ut/ny
   Mot git:     node verktoy/regresjon.js ut/ny --mot HEAD~1
   Sammenlign:  node verktoy/regresjon.js --sammenlign ut/gammel ut/ny
   Bare noen:   node verktoy/regresjon.js ut/ny --bare trondheim,oslo
   Ferdig bygg: node verktoy/regresjon.js ut/ny --kilde dist

   Trenger pakken playwright og en Chromium. Stien til Chromium kan settes med CHROMIUM, ellers brukes Playwrights egen.
   Går nettet gjennom en proxy, leses den fra HTTPS_PROXY. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { motortall } from './motortall.js';

const HER = path.dirname(fileURLToPath(import.meta.url)),
  ROT = path.resolve(HER, '..');
const TYPER = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.geojson': 'application/geo+json'
};
const TESTPLAN = path.join(HER, 'testdata', 'testplan-bygg.geojson');

/* Bygger siden fra mappen rot til en midlertidig mappe og gir stien tilbake. */
export function bygg(rot) {
  const ut = fs.mkdtempSync(path.join(os.tmpdir(), 'bygg-'));
  execSync(`npx vite build --outDir "${ut}" --emptyOutDir --logLevel error`, { cwd: rot, stdio: 'inherit' });
  return ut;
}

async function startNettleser() {
  const valg = {};
  if (process.env.CHROMIUM) valg.executablePath = process.env.CHROMIUM;
  else if (fs.existsSync('/opt/pw-browsers/chromium')) valg.executablePath = '/opt/pw-browsers/chromium';
  if (process.env.HTTPS_PROXY) valg.proxy = { server: process.env.HTTPS_PROXY };
  return chromium.launch(valg);
}

/* Hvordan testen bruker siden: adresse, knapper og hvor tekstene står. Samlet her, så resten av testen ikke avhenger av utformingen. */
export const SIDEN = {
  adresse: nr => `index.html?teknisk#${nr}`,
  kart: '.kartflate',
  laster: () => !!(window.motor && window.motor.app.laster),
  lag: (p, id) => p.locator(`[data-lag-knapp="${id}"]`).click(),
  tegn: p => p.locator('#tegnknapp').click(),
  ferdig: p => p.getByRole('button', { name: 'Ferdig', exact: true }).click(),
  ikkeUtbygging: p => p.getByLabel('Ikke utbygging').check(),
  slett: p =>
    p
      .getByRole('button', { name: /^Slett / })
      .first()
      .click(),
  lastOpp: (p, fil) => p.setInputFiles('#planfil', fil),
  visForste: async (p, id) => {
    await p.locator(`#tema-${id} > summary`).click();
    await p.locator(`#tema-${id} .omrader li button`).first().click();
  },
  byttKommune: async (p, fylke, nr, navn) => {
    const k = p.getByRole('combobox', { name: 'Kommune' });
    await k.click();
    await k.fill(navn);
    await p.getByRole('option', { name: navn, exact: true }).click();
  },
  probe: p => p.locator('.probe').innerText(),
  vist: p => p.locator('.vistmerke').innerText(),
  /* Tekstene i tallpanelet. Temaene leses med textContent, så detaljene kommer med også når de er lukket. */
  tekster: p =>
    p.evaluate(() => {
      const t = sel =>
        [...document.querySelectorAll(sel)]
          .map(e => e.innerText.replace(/\s*\n\s*/g, ' | ').trim())
          .filter(Boolean)
          .join('\n');
      const ut = {
        total: t('.total'),
        klasser: t('.klasser'),
        planlagt: t('.planlagt'),
        utvikling: t('.utvikling'),
        vann: t('.vann'),
        kartfot: t('.kartfot')
      };
      for (const d of document.querySelectorAll('.temarad')) ut[d.id] = d.textContent.replace(/\s+/g, ' ').trim();
      return ut;
    }),
  egne: p =>
    p.evaluate(() =>
      [...document.querySelectorAll('.egne .kort, .egne .md-alert-message')]
        .map(e => e.innerText.replace(/\s*\n\s*/g, ' | ').trim())
        .join('\n')
    )
};

/* En side som serverer filene i kilde på http://demo.test/. */
async function nySide(nettleser, kilde, feil, omskriv) {
  const ctx = await nettleser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 900 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true
  });
  const p = await ctx.newPage();
  let iGang = 0,
    sist = Date.now();
  const ferdig = () => {
    iGang = Math.max(0, iGang - 1);
    sist = Date.now();
  };
  p.on('request', () => {
    iGang++;
    sist = Date.now();
  });
  p.on('requestfinished', ferdig);
  p.on('requestfailed', ferdig);
  p.on('pageerror', e => feil.push('sidefeil: ' + e.message));
  await p.route('http://demo.test/**', r => {
    const fil = path.join(
      kilde,
      decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '') || 'index.html'
    );
    if (!fil.startsWith(kilde) || !fs.existsSync(fil)) return r.fulfill({ status: 404, body: 'finnes ikke' });
    const ny = omskriv && omskriv(fil, () => fs.readFileSync(fil, 'utf8'));
    if (ny) return r.fulfill({ contentType: TYPER[path.extname(fil)], body: ny });
    return r.fulfill({ path: fil, contentType: TYPER[path.extname(fil)] || 'application/octet-stream' });
  });
  /* Venter til det ikke har gått noen kall på en stund og siden selv ikke henter kart, og litt til for utregningene som følger. */
  p.rolig = async (stille = 1300, maks = 45000) => {
    const t0 = Date.now();
    await p.waitForTimeout(400); /* kartet rekker å be om det det trenger */
    while (Date.now() - t0 < maks) {
      if (!iGang && Date.now() - sist >= stille && !(await p.evaluate(p.siden.laster))) break;
      await p.waitForTimeout(150);
    }
    await p.waitForTimeout(500);
  };
  p.flytt = async (x, y, res) => {
    await p.evaluate(
      ([x, y, res]) => {
        const v = window.motor.kart.getView();
        if (x !== null) v.setCenter([x, y]);
        v.setResolution(res);
      },
      [x, y, res]
    );
    await p.rolig();
  };
  p.motor = () => p.evaluate(motortall);
  return p;
}

const trykk = async (p, gjor, vent = 1200) => {
  await gjor;
  await p.waitForTimeout(vent);
  await p.rolig(600);
};
const vent = (p, R, navn, sjekk, tid = 70000) =>
  p.waitForFunction(sjekk, null, { timeout: tid }).catch(() => R.feil.push(navn + ': ble ikke ferdig utregnet'));

export const SCENARIER = {
  /* Kommune med lagret oversiktsbilde: alt regnes ut for hele kommunen når siden åpnes. */
  async trondheim(p, R, S) {
    await p.goto('http://demo.test/' + S.adresse('5001'));
    await vent(p, R, 'trondheim', () => {
      const M = window.motor;
      if (!M || !M.app.valgt) return false;
      const v = M.NATURLAG.find(t => t.id === 'verdi');
      return (
        M.app.planTall &&
        M.app.planTall.tilstand === 'ok' &&
        v.data &&
        v.data.gap &&
        M.app.graaKryss &&
        M.app.graaKryss.nr === M.app.valgt.nr
      );
    });
    await p.rolig();
    R.motor.start = await p.motor();
    R.tekst.start = await S.tekster(p);
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await R.bilde('1-oversikt');
    await trykk(p, S.lag(p, 'vern'));
    await trykk(p, S.lag(p, 'verdi'));
    await R.bilde('2-vern-verdi');
    await trykk(p, S.lag(p, 'vern'));
    await trykk(p, S.lag(p, 'verdi'));
    await trykk(p, S.lag(p, 'inon'));
    await R.bilde('3-inon');
    await trykk(p, S.lag(p, 'inon'));
    await trykk(p, S.lag(p, 'graa'));
    await R.bilde('4-graa');
    await p.flytt(270500, 7031500, 10.58);
    await R.bilde('5-graa-inne');
    await trykk(p, S.lag(p, 'graa'));
    await trykk(p, S.lag(p, 'verdi'));
    await R.bilde('6-plan-verdi-inne');
    await p.locator(S.kart).tap({ position: { x: 150, y: 300 } });
    await p.waitForTimeout(900);
    R.tekst.punkt = await S.probe(p);
    await trykk(p, S.lag(p, 'verdi'));
    /* eget område tegnet i kartet */
    await p.flytt(270500, 7031500, 21.16);
    await S.tegn(p);
    await p.waitForTimeout(300);
    for (const [x, y] of [
      [90, 150],
      [300, 130],
      [320, 380],
      [110, 420]
    ]) {
      await p.locator(S.kart).tap({ position: { x, y } });
      await p.waitForTimeout(350);
    }
    await trykk(p, S.ferdig(p), 2500);
    await p.rolig();
    R.motor.tegnet = await p.motor();
    R.tekst.tegnet = { egne: await S.egne(p), ...(await S.tekster(p)) };
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await R.bilde('7-eget');
    await trykk(p, S.ikkeUtbygging(p), 2500);
    await p.rolig();
    R.motor.tegnetFri = await p.motor();
    R.tekst.tegnetFri = await S.egne(p);
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await R.bilde('8-eget-fri');
    await trykk(p, S.slett(p), 2000);
    await p.rolig();
    /* opplastet plan */
    await trykk(p, S.lastOpp(p, TESTPLAN), 4000);
    await p.rolig();
    R.motor.opplastet = await p.motor();
    R.tekst.opplastet = { egne: await S.egne(p), ...(await S.tekster(p)) };
    await p.flytt(270500, 7031500, 84.6);
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await R.bilde('9-opplastet');
    await trykk(p, S.slett(p), 2000);
    await p.rolig();
    R.motor.etterSletting = await p.motor();
    /* ett verneområde vist i kartet fra listen */
    await trykk(p, S.visForste(p, 'vern'), 1500);
    await p.rolig();
    R.tekst.vist = await S.vist(p);
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await R.bilde('10-vist');
  },
  /* Kommune uten lagret oversiktsbilde: kartet og tallene bygges av det som hentes når man zoomer inn. */
  async surnadal(p, R, S) {
    await p.goto('http://demo.test/' + S.adresse('1566'));
    await vent(p, R, 'surnadal', () => {
      const M = window.motor;
      return (
        M &&
        M.app.inon &&
        M.app.inon.tilstand === 'ok' &&
        M.app.arealtall &&
        M.app.arealtall.tilstand === 'ok' &&
        M.app.graa &&
        M.app.graa.tilstand === 'ok'
      );
    });
    await p.rolig();
    R.motor.start = await p.motor();
    R.tekst.start = await S.tekster(p);
    const [x, y, res] = await p.evaluate(() => {
      const v = window.motor.kart.getView();
      return [...v.getCenter(), v.getResolution()];
    });
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await trykk(p, S.lag(p, 'inon'));
    await p.flytt(x, y, 12);
    await R.bilde('1-inne');
    R.motor.inne = await p.motor();
    R.tekst.inne = await S.tekster(p);
    await p.flytt(x + 2500, y, 12);
    await p.flytt(x, y, 60);
    await R.bilde('2-ute-60');
    await p.flytt(x, y, res);
    await R.bilde('3-ute-start');
    await trykk(p, S.lag(p, 'inon'));
    await trykk(p, S.lag(p, 'graa'));
    await R.bilde('4-graa-ute');
    R.motor.tilSlutt = await p.motor();
    R.tekst.tilSlutt = await S.tekster(p);
  },
  /* Kommune uten kommuneplan hos DiBK, og bytte av kommune med velgeren. */
  async oslo(p, R, S) {
    await p.goto('http://demo.test/' + S.adresse('0301'));
    await vent(p, R, 'oslo', () => {
      const M = window.motor;
      return (
        M &&
        M.app.planInfo &&
        M.app.planInfo.tilstand === 'ingen' &&
        M.app.graa &&
        M.app.graa.tilstand === 'ok' &&
        M.NATURLAG.every(t => t.data)
      );
    });
    await p.rolig();
    R.motor.start = await p.motor();
    R.tekst.start = await S.tekster(p);
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await R.bilde('1-oversikt');
    await S.byttKommune(p, '50', '5031', 'Malvik');
    await p.waitForTimeout(6000);
    await vent(p, R, 'malvik', () => {
      const M = window.motor;
      return M && M.app.planTall && M.app.planTall.tilstand === 'ok' && M.app.graaKryss;
    });
    await p.rolig();
    R.motor.malvik = await p.motor();
    R.tekst.malvik = await S.tekster(p);
    await p.locator(S.kart).scrollIntoViewIfNeeded();
    await R.bilde('2-malvik');
  }
};

/* S beskriver siden, se SIDEN. omskriv(fil, les) kan gi annet innhold for en fil enn det som ligger i kilde. */
export async function kjor(kilde, ut, bare, S = SIDEN, omskriv = null) {
  fs.mkdirSync(ut, { recursive: true });
  const nettleser = await startNettleser(),
    resultat = {};
  for (const navn of Object.keys(SCENARIER)) {
    if (bare && !bare.includes(navn)) continue;
    const t0 = Date.now(),
      R = { tekst: {}, motor: {}, feil: [] },
      p = await nySide(nettleser, kilde, R.feil, omskriv);
    p.siden = S;
    R.bilde = async n => {
      await p.locator(S.kart).screenshot({ path: path.join(ut, `${navn}-${n}.png`) });
    };
    try {
      await SCENARIER[navn](p, R, S);
    } catch (e) {
      R.feil.push('avbrutt: ' + String(e.message).split('\n')[0]);
    }
    resultat[navn] = { motor: R.motor, tekst: R.tekst, feil: R.feil };
    await p.context().close();
    console.log(
      `${navn}: ${((Date.now() - t0) / 1000).toFixed(0)} s${R.feil.length ? ', FEIL: ' + R.feil.join('; ') : ''}`
    );
  }
  await nettleser.close();
  fs.writeFileSync(path.join(ut, 'resultat.json'), JSON.stringify(resultat, null, 1));
  return resultat;
}

/* Sammenligner to kjøringer: tallene fra motoren og teksten skal være like, og skjermbildene sammenlignes piksel for piksel.
   bareMotor sammenligner bare tallene, til sammenligning med en utgave der siden ser annerledes ut. */
export async function sammenlign(a, b, { toleranse = 0.002, bareMotor = false } = {}) {
  const A = JSON.parse(fs.readFileSync(path.join(a, 'resultat.json'), 'utf8')),
    B = JSON.parse(fs.readFileSync(path.join(b, 'resultat.json'), 'utf8'));
  let avvik = 0;
  const flat = (o, pre = '', ut = {}) => {
    for (const k in o) {
      if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) flat(o[k], pre + k + '.', ut);
      else ut[pre + k] = JSON.stringify(o[k]);
    }
    return ut;
  };
  const del = R => (bareMotor ? Object.fromEntries(Object.entries(R).map(([n, x]) => [n, { motor: x.motor }])) : R);
  const fa = flat(del(A)),
    fb = flat(del(B));
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
    if (fa[k] === fb[k]) continue;
    avvik++;
    console.log(`ULIK ${k}\n   a: ${String(fa[k]).slice(0, 700)}\n   b: ${String(fb[k]).slice(0, 700)}`);
  }
  const nettleser = await startNettleser(),
    p = await nettleser.newPage();
  const bilder = fs
    .readdirSync(a)
    .filter(f => f.endsWith('.png'))
    .sort();
  for (const f of bilder) {
    if (!fs.existsSync(path.join(b, f))) {
      avvik++;
      console.log(`BILDE ${f}: mangler i b`);
      continue;
    }
    const les = m => 'data:image/png;base64,' + fs.readFileSync(path.join(m, f)).toString('base64');
    const r = await p.evaluate(
      async ([ua, ub]) => {
        const last = u =>
          new Promise((ok, feil) => {
            const i = new Image();
            i.onload = () => ok(i);
            i.onerror = feil;
            i.src = u;
          });
        const [ia, ib] = await Promise.all([last(ua), last(ub)]);
        if (ia.width !== ib.width || ia.height !== ib.height)
          return { ulik: 1, storst: 255, str: `${ia.width}x${ia.height} mot ${ib.width}x${ib.height}` };
        const data = i => {
          const c = document.createElement('canvas');
          c.width = i.width;
          c.height = i.height;
          const g = c.getContext('2d');
          g.drawImage(i, 0, 0);
          return g.getImageData(0, 0, c.width, c.height).data;
        };
        const da = data(ia),
          db = data(ib);
        let n = 0,
          storst = 0;
        for (let i = 0; i < da.length; i += 4) {
          const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
          if (d > 12) n++;
          if (d > storst) storst = d;
        }
        return { ulik: n / (da.length / 4), storst };
      },
      [les(a), les(b)]
    );
    const ok = r.ulik <= toleranse;
    if (!ok) avvik++;
    console.log(
      `${ok ? 'ok   ' : 'BILDE'} ${f}: ${(r.ulik * 100).toFixed(3)} % av pikslene er ulike${r.str ? ' (' + r.str + ')' : ''}`
    );
  }
  await nettleser.close();
  console.log(avvik ? `\n${avvik} avvik.` : '\nIngen avvik.');
  return avvik;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv.slice(2),
    valg = n => {
      const i = arg.indexOf(n);
      return i < 0 ? null : arg.splice(i, 2)[1];
    };
  if (arg[0] === '--sammenlign') process.exit((await sammenlign(arg[1], arg[2])) ? 1 : 0);
  const mot = valg('--mot'),
    bareTekst = valg('--bare'),
    bare = bareTekst ? bareTekst.split(',') : null,
    kildeValg = valg('--kilde'),
    ut = arg[0];
  if (!ut) {
    console.log('Bruk: node verktoy/regresjon.js <ut-mappe> [--mot <git-ref>] [--kilde <bygget mappe>] [--bare a,b]');
    process.exit(2);
  }
  await kjor(kildeValg ? path.resolve(kildeValg) : bygg(ROT), ut, bare);
  if (mot) {
    /* Den andre utgaven hentes fra git og bygges med de samme pakkene som arbeidskopien har installert. */
    const gammel = fs.mkdtempSync(path.join(os.tmpdir(), 'regresjon-')),
      utGammel = ut.replace(/\/+$/, '') + '-' + mot.replace(/[^\w.-]/g, '_');
    execSync(`git -C "${ROT}" archive ${mot} | tar -x -C "${gammel}"`);
    fs.symlinkSync(path.join(ROT, 'node_modules'), path.join(gammel, 'node_modules'));
    await kjor(bygg(gammel), utGammel, bare);
    process.exit((await sammenlign(utGammel, ut)) ? 1 : 0);
  }
}
