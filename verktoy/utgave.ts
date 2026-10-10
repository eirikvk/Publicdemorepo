/* Setter nytt utgavemerke før en endring legges ut.

   Teksten vises under «Vis teknisk informasjon» (VERSJON i src/utgave.ts), så man ser hvilken utgave en fane kjører. Skriptet setter
   klokkeslettet nå, norsk tid. Filene i bygget får selv nye navn når innholdet endres, så nettleseren blander ikke ny og gammel kode.

   Kjør fra roten av repoet:  node verktoy/utgave.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MND = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember'
];
const na = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Oslo',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
    .formatToParts(new Date())
    .map(d => [d.type, d.value])
);
const tekst = `${Number(na.day)}. ${MND[Number(na.month) - 1]} kl. ${na.hour}.${na.minute}`;

const sti = path.join(ROT, 'src', 'utgave.ts'),
  s = fs.readFileSync(sti, 'utf8'),
  ny = s.replace(/const VERSJON =\s*'[^']*'/, `const VERSJON = '${tekst}'`);
if (ny === s && !s.includes(`'${tekst}'`)) throw new Error('Fant ikke utgavemerket i src/utgave.ts');
fs.writeFileSync(sti, ny);
console.log(`Utgave: ${tekst}`);
