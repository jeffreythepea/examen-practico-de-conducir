const PHASES = new Set(['driving', 'precheck', 'mixed']);
const COMMAND_PHASES = new Set(['driving', 'precheck']);
const WORDING = new Set(['verbatim', 'source-derived']);
// A precheck is either drawn from the source guide and the vehicle manual, or
// it comes from a lesson: something an examiner actually asked Jeffrey that the
// guide never listed. The third value records that honestly rather than
// dressing a lesson note up as a manual baseline.
const PRECHECK_VALIDATION = new Set(['manual-baseline', 'trim-dependent', 'instructor-plausible']);

function requireField(value, commandId, field) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${commandId}: missing ${field}`);
  }
}

export function validateCatalog(commands) {
  if (!Array.isArray(commands)) throw new Error('Catalog must be an array');
  const commandIds = new Set();
  const actionIds = new Set();
  const phrasingIds = new Set();
  for (const command of commands) {
    const id = command?.id || '<unknown>';
    for (const field of ['id', 'actionId', 'category', 'phase', 'responseType', 'surfaceId', 'icon', 'acceptedResult']) {
      requireField(command?.[field], id, field);
    }
    if (commandIds.has(id)) throw new Error(`${id}: duplicate id`);
    if (actionIds.has(command.actionId)) throw new Error(`${id}: duplicate actionId`);
    commandIds.add(id);
    actionIds.add(command.actionId);
    if (!COMMAND_PHASES.has(command.phase)) throw new Error(`${id}: invalid phase`);
    if (command.active !== undefined && typeof command.active !== 'boolean') {
      throw new Error(`${id}: invalid active flag`);
    }
    if (!Array.isArray(command.phrasings) || command.phrasings.length < 1) throw new Error(`${id}: missing phrasings`);
    if (command.phrasings[0]?.id !== `${id}-canonical`) throw new Error(`${id}: invalid canonical phrasing id`);
    for (const phrasing of command.phrasings) {
      for (const field of ['id', 'es', 'en', 'wording', 'validation', 'sourcePage', 'sourceText']) {
        requireField(phrasing?.[field], id, `phrasing.${field}`);
      }
      if (phrasingIds.has(phrasing.id)) throw new Error(`${id}: duplicate phrasing.id`);
      if (!WORDING.has(phrasing.wording)) throw new Error(`${id}: invalid phrasing.wording`);
      phrasingIds.add(phrasing.id);
    }
    if (command.phase === 'precheck') {
      if (!PRECHECK_VALIDATION.has(command.phrasings[0].validation)) throw new Error(`${id}: invalid phrasing.validation`);
      requireField(command.vehicle?.page, id, 'vehicle.page');
      requireField(command.vehicle?.answer, id, 'vehicle.answer');
      requireField(command.vehicle?.answerEn, id, 'vehicle.answerEn');
    }
  }
}

export function isActiveCommand(command) {
  return command?.active !== false;
}

export function activeCommands(commands) {
  if (!Array.isArray(commands)) throw new Error('Catalog must be an array');
  return commands.filter(isActiveCommand);
}

export function commandsForPhase(commands, phase) {
  if (!PHASES.has(phase)) throw new Error(`Unknown phase: ${phase}`);
  return activeCommands(commands).filter(command => phase === 'mixed' || command.phase === phase);
}

export function commandById(commands, id) {
  const command = commands.find(candidate => candidate.id === id);
  if (!command) throw new Error(`Unknown command: ${id}`);
  return command;
}
