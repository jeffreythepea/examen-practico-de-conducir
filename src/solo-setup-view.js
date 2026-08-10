import { CHALLENGES, CHALLENGE_IDS } from './challenges.js';
import { EXAMINERS, EXAMINER_CHOICE_IDS, selectTodaysExaminer } from './examiners.js';
import { SESSION_PRESETS, SESSION_PRESET_IDS } from './session-presets.js';
import { SESSION_THEMES } from './session-themes.js';

const LOCALES = new Set(['en', 'es']);

export function renderSoloSetupView({
  locale,
  t,
  selectedPresetId,
  selectedExaminerChoiceId,
  selectedThemeId = null,
  selectedChallengeId = null,
  dateParts
} = {}) {
  if (!LOCALES.has(locale)) throw new Error(`Unsupported locale: ${String(locale)}`);
  if (typeof t !== 'function') throw new Error('A translation function is required');
  if (!SESSION_PRESET_IDS.includes(selectedPresetId)) {
    throw new Error(`Unknown experience mode: ${String(selectedPresetId)}`);
  }
  if (!EXAMINER_CHOICE_IDS.includes(selectedExaminerChoiceId)) {
    throw new Error(`Unknown examiner choice: ${String(selectedExaminerChoiceId)}`);
  }
  if (selectedThemeId !== null && !SESSION_THEMES.some(theme => theme.id === selectedThemeId)) {
    throw new Error(`Unknown theme: ${String(selectedThemeId)}`);
  }
  if (selectedChallengeId !== null && !CHALLENGE_IDS.includes(selectedChallengeId)) {
    throw new Error(`Unknown challenge: ${String(selectedChallengeId)}`);
  }

  const today = selectTodaysExaminer(dateParts);
  return `
    <section class="solo-setup-preview" aria-label="${attribute(t('experience.heading'))}">
      ${renderExperienceChoices({ t, selectedPresetId })}
      ${renderExaminerChoices({ t, selectedExaminerChoiceId, today })}
      ${renderThemeChoices({ t, selectedThemeId })}
      ${renderChallengeChoices({ t, selectedChallengeId })}
    </section>
  `;
}

function renderExperienceChoices({ t, selectedPresetId }) {
  return `
    <fieldset class="solo-choice-group experience-choices">
      <legend>${html(t('experience.heading'))}</legend>
      <div class="solo-choice-grid">
        ${SESSION_PRESETS.map(preset => choice({
          groupName: 'experience-mode',
          id: preset.id,
          title: t(preset.titleKey),
          description: t(preset.descriptionKey),
          selected: preset.id === selectedPresetId,
          action: 'select-experience-mode',
          dataName: 'experience-mode',
          badge: preset.simulated ? t('experience.mock.simulated') : '',
          visualToken: preset.id,
          t
        })).join('')}
      </div>
    </fieldset>
  `;
}

function renderExaminerChoices({ t, selectedExaminerChoiceId, today }) {
  const examinerChoices = [
    {
      id: 'today',
      title: t('examiner.today.title'),
      description: t('examiner.today.description', { name: t(today.nameKey) }),
      visualToken: `today-${today.visualToken}`
    },
    {
      id: 'mixed',
      title: t('examiner.mixed.title'),
      description: t('examiner.mixed.description'),
      visualToken: 'mixed'
    },
    ...EXAMINERS.map(examiner => ({
      id: examiner.id,
      title: t(examiner.nameKey),
      description: t(examiner.descriptionKey),
      visualToken: examiner.visualToken
    }))
  ];

  return `
    <fieldset class="solo-choice-group examiner-choices">
      <legend>${html(t('examiner.heading'))}</legend>
      <div class="solo-choice-grid">
        ${examinerChoices.map(examiner => choice({
          groupName: 'examiner-choice',
          id: examiner.id,
          title: examiner.title,
          description: examiner.description,
          selected: examiner.id === selectedExaminerChoiceId,
          action: 'select-examiner',
          dataName: 'examiner-choice',
          visualToken: examiner.visualToken,
          t
        })).join('')}
      </div>
    </fieldset>
  `;
}

function renderThemeChoices({ t, selectedThemeId }) {
  const themeChoices = [
    {
      id: 'adaptive',
      title: t('theme.adaptive.title'),
      description: t('theme.adaptive.description'),
      selected: selectedThemeId === null,
      visualToken: 'adaptive'
    },
    ...SESSION_THEMES.map(theme => ({
      id: theme.id,
      title: t(theme.titleKey),
      description: t(theme.descriptionKey),
      selected: theme.id === selectedThemeId,
      visualToken: theme.simulated ? 'mock' : theme.id,
      badge: theme.simulated ? t('experience.mock.simulated') : ''
    }))
  ];

  return `
    <fieldset class="solo-choice-group theme-choices">
      <legend>${html(t('theme.heading'))}</legend>
      <div class="solo-choice-grid">
        ${themeChoices.map(theme => choice({
          ...theme,
          groupName: 'theme-choice',
          action: 'select-theme',
          dataName: 'theme',
          t
        })).join('')}
      </div>
    </fieldset>
  `;
}

function renderChallengeChoices({ t, selectedChallengeId }) {
  const challengeChoices = [
    {
      id: 'none',
      title: t('challenge.none.title'),
      description: t('challenge.none.description'),
      selected: selectedChallengeId === null,
      visualToken: 'none'
    },
    ...CHALLENGES.map(challenge => ({
      id: challenge.id,
      title: t(challenge.titleKey),
      description: t(challenge.descriptionKey),
      selected: challenge.id === selectedChallengeId,
      visualToken: challenge.id
    }))
  ];

  return `
    <fieldset class="solo-choice-group challenge-choices">
      <legend>${html(t('challenge.heading'))}</legend>
      <div class="solo-choice-grid">
        ${challengeChoices.map(challenge => choice({
          ...challenge,
          groupName: 'challenge-choice',
          action: 'select-challenge',
          dataName: 'challenge',
          t
        })).join('')}
      </div>
    </fieldset>
  `;
}

function choice({
  groupName,
  id,
  title,
  description,
  selected,
  action,
  dataName,
  badge = '',
  visualToken,
  t
}) {
  const inputId = `${groupName}-${id}`;
  return `
    <label class="solo-choice solo-choice-${attribute(visualToken)}" for="${attribute(inputId)}">
      <input type="radio" name="${attribute(groupName)}" value="${attribute(id)}" id="${attribute(inputId)}" data-action="${attribute(action)}" data-${attribute(dataName)}="${attribute(id)}"${selected ? ' checked' : ''}>
      <span class="solo-choice-copy">
        <strong>${html(title)}</strong>
        <span>${html(description)}</span>
      </span>
      ${badge ? `<span class="solo-choice-badge">${html(badge)}</span>` : ''}
      ${selected ? `<span class="solo-choice-selected">${html(t('choice.selected'))}</span>` : ''}
    </label>
  `;
}

function html(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function attribute(value) {
  return html(value);
}
