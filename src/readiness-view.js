import { LESSON_FLAG_CATEGORIES } from './lesson-flags.js';

const PHASES = Object.freeze(['mixed', 'driving', 'precheck']);
const STATES = Object.freeze(['all', 'ready', 'in-progress', 'needs-practice', 'not-tested']);
const FLAG_FILTERS = Object.freeze(['all', 'open', 'resolved']);
const TARGETS = Object.freeze([
  Object.freeze({ kind: 'needs-practice', labelKey: 'readiness.action.startNeedsPractice' }),
  Object.freeze({ kind: 'not-tested', labelKey: 'readiness.action.startNotTested' }),
  Object.freeze({ kind: 'lesson-flags', labelKey: 'readiness.action.startLessonFlags' }),
  Object.freeze({ kind: 'not-ready', labelKey: 'readiness.action.startNotReady' })
]);

export function renderReadinessView({
  locale,
  t,
  commands = [],
  readiness = [],
  lessonFlags = [],
  filters = {}
}) {
  const phase = PHASES.includes(filters.phase) ? filters.phase : 'mixed';
  const state = STATES.includes(filters.state) ? filters.state : 'all';
  const flag = FLAG_FILTERS.includes(filters.flag) ? filters.flag : 'all';
  const readinessByCommand = new Map(readiness.map(record => [record.commandId, record]));
  const flagsByCommand = groupFlagsByCommand(lessonFlags);
  const visibleCommands = commands.filter(command => {
    const record = readinessByCommand.get(command.id);
    const commandState = record?.state ?? 'not-tested';
    const commandFlags = flagsByCommand.get(command.id) ?? [];
    return ['driving', 'precheck'].includes(command.phase)
      && (phase === 'mixed' || command.phase === phase)
      && (state === 'all' || commandState === state)
      && (flag === 'all' || commandFlags.some(candidate => candidate.status === flag));
  });
  const targetAvailability = readinessTargetAvailability(commands, readiness, lessonFlags, phase);

  const groups = ['driving', 'precheck'].map(groupPhase => ({
    phase: groupPhase,
    commands: visibleCommands.filter(command => command.phase === groupPhase)
  })).filter(group => group.commands.length > 0);

  return `
    <section class="readiness-screen" aria-labelledby="readiness-title">
      <header class="readiness-header">
        <div>
          <h2 id="readiness-title" data-screen-focus tabindex="-1">${escapeHtml(t('screen.readiness'))}</h2>
          <p>${escapeHtml(t('readiness.intro'))}</p>
        </div>
        <button type="button" data-action="close-readiness">${escapeHtml(t('readiness.action.close'))}</button>
      </header>

      ${renderFilters({ phase, state, flag, t })}
      ${filters.noticeKey ? `<p class="readiness-notice" role="status">${escapeHtml(t(filters.noticeKey))}</p>` : ''}
      ${renderTargetActions(t, targetAvailability)}

      <div class="readiness-groups">
        ${groups.length > 0
          ? groups.map(group => renderGroup({ ...group, locale, t, readinessByCommand, flagsByCommand })).join('')
          : `<p class="readiness-empty" role="status">${escapeHtml(t('readiness.empty.practice'))}</p>`}
      </div>

      ${renderLessonFlagEditor(filters.editor, t)}
    </section>
  `;
}

function renderFilters({ phase, state, flag, t }) {
  return `
    <div class="readiness-filters" aria-label="${escapeAttribute(t('readiness.filter.title'))}">
      <label for="readiness-phase">${escapeHtml(t('readiness.filter.phase'))}</label>
      <select id="readiness-phase" data-action="set-readiness-phase">
        ${option('mixed', phase, t('readiness.filter.allPhases'))}
        ${option('driving', phase, t('readiness.phase.driving'))}
        ${option('precheck', phase, t('readiness.phase.precheck'))}
      </select>
      <label for="readiness-state">${escapeHtml(t('readiness.filter.state'))}</label>
      <select id="readiness-state" data-action="set-readiness-state">
        ${option('all', state, t('readiness.filter.allStates'))}
        ${option('ready', state, t('readiness.state.ready'))}
        ${option('in-progress', state, t('readiness.state.in-progress'))}
        ${option('needs-practice', state, t('readiness.state.needs-practice'))}
        ${option('not-tested', state, t('readiness.state.not-tested'))}
      </select>
      <label for="readiness-flag">${escapeHtml(t('readiness.filter.lessonFlags'))}</label>
      <select id="readiness-flag" data-action="set-readiness-flag">
        ${option('all', flag, t('readiness.filter.allLessonFlags'))}
        ${option('open', flag, t('readiness.flag.status.open'))}
        ${option('resolved', flag, t('readiness.flag.status.resolved'))}
      </select>
    </div>
  `;
}

function option(value, selectedValue, label) {
  return `<option value="${escapeAttribute(value)}"${value === selectedValue ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function renderTargetActions(t, availability) {
  return `
    <section class="readiness-targets" aria-labelledby="readiness-targets-title">
      <h3 id="readiness-targets-title">${escapeHtml(t('readiness.practice.title'))}</h3>
      <div class="readiness-target-actions">
        ${TARGETS.map(target => `
          <button type="button" data-action="start-readiness-practice" data-target-kind="${target.kind}"${availability[target.kind] > 0 ? '' : ' disabled'}>
            ${escapeHtml(t(target.labelKey))}
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

export function readinessTargetAvailability(commands, readiness, lessonFlags, phase = 'mixed') {
  const readinessByCommand = new Map(readiness.map(record => [record.commandId, record]));
  const openFlagCommands = new Set(
    lessonFlags.filter(flag => flag.status === 'open').map(flag => flag.commandId)
  );
  const eligible = commands.filter(command => ['driving', 'precheck'].includes(command.phase)
    && (phase === 'mixed' || command.phase === phase));
  const count = predicate => eligible.filter(predicate).length;
  return {
    'needs-practice': count(command => readinessByCommand.get(command.id)?.state === 'needs-practice'),
    'not-tested': count(command => (readinessByCommand.get(command.id)?.state ?? 'not-tested') === 'not-tested'),
    'lesson-flags': count(command => openFlagCommands.has(command.id)),
    'not-ready': count(command => (readinessByCommand.get(command.id)?.state ?? 'not-tested') !== 'ready')
  };
}

function renderGroup({ phase, commands, locale, t, readinessByCommand, flagsByCommand }) {
  return `
    <section class="readiness-group" aria-labelledby="readiness-group-${phase}">
      <h3 id="readiness-group-${phase}">${escapeHtml(t(`readiness.group.${phase}`))}</h3>
      <ul class="readiness-list">
        ${commands.map(command => renderCommand({
          command,
          record: readinessByCommand.get(command.id),
          flags: flagsByCommand.get(command.id) ?? [],
          locale,
          t
        })).join('')}
      </ul>
    </section>
  `;
}

function renderCommand({ command, record, flags, locale, t }) {
  const state = record?.state ?? 'not-tested';
  const phrasing = command.phrasings?.[0] ?? {};
  const spanish = phrasing.es ?? command.id;
  const meaning = phrasing[locale] ?? phrasing.en ?? spanish;
  const commandId = escapeAttribute(command.id);
  const openFlagCount = record?.openLessonFlagCount
    ?? flags.filter(flag => flag.status === 'open').length;

  return `
    <li class="readiness-command" data-readiness-state="${escapeAttribute(state)}">
      <article aria-labelledby="readiness-command-${commandId}">
        <header class="readiness-command-header">
          <div>
            <p class="readiness-command-spanish" id="readiness-command-${commandId}" lang="es">${escapeHtml(spanish)}</p>
            <p class="readiness-command-meaning" lang="${escapeAttribute(locale)}">${escapeHtml(meaning)}</p>
          </div>
          <span class="readiness-state" data-state="${escapeAttribute(state)}">${escapeHtml(t(`readiness.state.${state}`))}</span>
        </header>

        ${renderEvidence(record, openFlagCount, locale, t)}
        ${renderFlags(flags, t)}

        <div class="readiness-command-actions">
          <button type="button" data-action="start-command-practice" data-command-id="${commandId}">
            ${escapeHtml(t('readiness.action.startCommandPractice'))}
          </button>
          <button type="button" data-action="open-lesson-flag" data-command-id="${commandId}">
            ${escapeHtml(t('readiness.action.openFlag'))}
          </button>
        </div>
      </article>
    </li>
  `;
}

function renderEvidence(record, openFlagCount, locale, t) {
  const noData = t('readiness.evidence.noData');
  const outcomes = record?.recentOutcomes ?? [];
  const recent = outcomes.length > 0
    ? `<ol class="readiness-outcomes" aria-label="${escapeAttribute(t('readiness.evidence.recent'))}">
        ${outcomes.map(outcome => `<li class="outcome ${escapeAttribute(outcome)}">${escapeHtml(t(`readiness.outcome.${outcome}`))}</li>`).join('')}
      </ol>`
    : escapeHtml(noData);
  const averageResponse = Number.isFinite(record?.averageResponseMs)
    ? t('readiness.evidence.milliseconds', { milliseconds: new Intl.NumberFormat(locale).format(Math.round(record.averageResponseMs)) })
    : noData;

  const items = [
    [t('readiness.evidence.recent'), recent, true],
    [t('readiness.evidence.lastPracticed'), formatDate(record?.lastPracticedAt, locale, noData)],
    [t('readiness.evidence.averageResponse'), averageResponse],
    [t('readiness.evidence.replays'), String(record?.replayCount ?? 0)],
    [t('readiness.evidence.hints'), String(record?.hintCount ?? 0)],
    [t('readiness.evidence.openFlags'), String(openFlagCount)],
    [t('readiness.evidence.nextDue'), formatDate(record?.nextDueAt, locale, noData)]
  ];

  return `<dl class="readiness-evidence" data-lesson-flag-count="${escapeAttribute(openFlagCount)}">
    ${items.map(([label, value, markup = false]) => `
      <div class="readiness-evidence-item">
        <dt>${escapeHtml(label)}</dt>
        <dd>${markup ? value : escapeHtml(value)}</dd>
      </div>
    `).join('')}
  </dl>`;
}

function renderFlags(flags, t) {
  if (flags.length === 0) return '';
  return `
    <ul class="lesson-flag-list" aria-label="${escapeAttribute(t('screen.lesson'))}">
      ${flags.map(flag => {
        const flagId = escapeAttribute(flag.id);
        const commandId = escapeAttribute(flag.commandId);
        const action = flag.status === 'resolved' ? 'reopen-lesson-flag' : 'resolve-lesson-flag';
        const actionKey = flag.status === 'resolved' ? 'readiness.action.reopenFlag' : 'readiness.action.resolveFlag';
        return `
          <li class="lesson-flag" data-flag-status="${escapeAttribute(flag.status)}">
            <p><strong>${escapeHtml(t(`readiness.flag.category.${flag.category}`))}</strong> — ${escapeHtml(flag.note)}</p>
            <span>${escapeHtml(t(`readiness.flag.status.${flag.status}`))}</span>
            <button type="button" data-action="open-lesson-flag" data-command-id="${commandId}" data-flag-id="${flagId}">
              ${escapeHtml(t('readiness.action.editFlag'))}
            </button>
            <button type="button" data-action="${action}" data-command-id="${commandId}" data-flag-id="${flagId}">
              ${escapeHtml(t(actionKey))}
            </button>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

export function renderLessonFlagEditor(editor, t) {
  if (!editor) return '';
  const commandId = editor.commandId ?? '';
  const flagId = editor.flagId ?? '';
  const category = LESSON_FLAG_CATEGORIES.includes(editor.category) ? editor.category : 'wording';
  const note = editor.note ?? '';
  const error = editor.errorKey ? `<p class="lesson-editor-error" role="alert">${escapeHtml(t(editor.errorKey))}</p>` : '';

  return `
    <section class="lesson-editor" aria-labelledby="lesson-editor-title">
      <h3 id="lesson-editor-title">${escapeHtml(t(flagId ? 'readiness.flag.editTitle' : 'readiness.flag.editorTitle'))}</h3>
      ${error}
      <form>
        <input type="hidden" name="commandId" value="${escapeAttribute(commandId)}">
        <input type="hidden" name="flagId" value="${escapeAttribute(flagId)}">
        <label for="lesson-flag-category">${escapeHtml(t('readiness.flag.category'))}</label>
        <select id="lesson-flag-category" name="category">
          ${LESSON_FLAG_CATEGORIES.map(value => option(value, category, t(`readiness.flag.category.${value}`))).join('')}
        </select>
        <label for="lesson-flag-note">${escapeHtml(t('readiness.flag.note'))}</label>
        <textarea id="lesson-flag-note" name="note" required>${escapeHtml(note)}</textarea>
        <div class="lesson-editor-actions">
          <button type="button" class="primary" data-action="save-lesson-flag" data-command-id="${escapeAttribute(commandId)}"${flagId ? ` data-flag-id="${escapeAttribute(flagId)}"` : ''}>${escapeHtml(t('readiness.action.saveFlag'))}</button>
        </div>
      </form>
    </section>
  `;
}

function groupFlagsByCommand(flags) {
  const grouped = new Map();
  for (const flag of flags) {
    const current = grouped.get(flag.commandId) ?? [];
    grouped.set(flag.commandId, [...current, flag]);
  }
  return grouped;
}

function formatDate(timestamp, locale, fallback) {
  if (!Number.isFinite(timestamp)) return fallback;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
  }).format(new Date(timestamp));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value);
}
