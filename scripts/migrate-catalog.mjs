import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceRoot = '/Users/jeffreypease/Projects/piso-asturiano';
const targetRoot = resolve(new URL('..', import.meta.url).pathname);
const html = await readFile(resolve(sourceRoot, 'index.html'), 'utf8');
const match = html.match(/const COMMANDS = \[([\s\S]*?)\n\];/);
if (!match) throw new Error('COMMANDS block not found');
const legacy = Function(`return [${match[1]}];`)();

const actionIds = {
  'c-der':'turn-right','c-izq':'turn-left','c-sentido':'change-direction','c-volante':'steering-straight',
  'c-rot1':'roundabout-exit-1','c-rot2':'roundabout-exit-2','c-rot3':'roundabout-exit-3','c-rot4':'roundabout-exit-4','c-rot5':'roundabout-exit-5',
  'c-parada':'voluntary-stop','c-detencion':'involuntary-stop','c-adapte':'adapt-speed','c-est':'park','c-inmov':'secure-vehicle','c-adel':'overtake','c-final':'exam-finish',
  'c-pre-bateria':'locate-battery','c-pre-aceite':'locate-oil-check','c-pre-refrigerante':'locate-coolant-check','c-pre-capo':'open-bonnet-check-levels',
  'c-pre-combustible':'locate-fuel-level','c-pre-temperatura':'locate-engine-temperature','c-pre-bloquear-elevalunas':'lock-rear-windows','c-pre-desbloquear-elevalunas':'unlock-rear-windows',
  'c-pre-largo-alcance':'high-beams','c-pre-niebla-delantera':'front-fog-lights','c-pre-niebla-trasera':'rear-fog-light','c-pre-maletero':'open-boot',
  'c-pre-desempanar-delantera':'front-demist','c-pre-desempanar-trasera':'rear-demist'
};

function surfaceId(command) {
  if (command.cat === 'rot') return 'roundabout-v1';
  if (command.cat === 'dir') return 'junction-v1';
  if (command.cat.startsWith('pre-')) return `yaris-manual-v1-${command.cat.slice(4)}`;
  return 'option-grid-v1';
}

const commands = legacy.map(command => {
  const actionId = actionIds[command.id];
  if (!actionId) throw new Error(`Missing action ID for ${command.id}`);
  return {
    id: command.id,
    actionId,
    category: command.cat,
    phase: command.phase,
    responseType: command.type,
    surfaceId: surfaceId(command),
    icon: command.icon,
    acceptedResult: actionId,
    phrasings: [{
      id: `${command.id}-canonical`, es: command.es, en: command.en,
      wording: command.wording, validation: command.validation,
      sourcePage: command.page, sourceText: command.source
    }],
    ...(command.vehicle ? { vehicle: command.vehicle } : {})
  };
});

if (commands.length !== 30) throw new Error(`Expected 30 commands, found ${commands.length}`);
await writeFile(resolve(targetRoot, 'data/commands.json'), `${JSON.stringify(commands, null, 2)}\n`);
for (const name of ['fermin-atomic-command-inventory.md', 'fermin-practical-test-commands-2020.md']) {
  await copyFile(resolve(sourceRoot, 'references', name), resolve(targetRoot, 'references', name));
}
