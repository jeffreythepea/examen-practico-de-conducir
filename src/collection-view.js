/**
 * Pure renderer for the Collection screen: accomplishments, completed themed
 * drives, examiner encounters, and personal bests. No controller or
 * persistence behavior lives here — same contract as readiness-view.js /
 * solo-setup-view.js.
 */
export function renderCollectionView({
  locale,
  t,
  accomplishments = [],
  themes = [],
  examiners = [],
  personalBests = []
} = {}) {
  return `
    <section class="collection-screen" aria-labelledby="collection-title">
      <header class="collection-header">
        <div>
          <h2 id="collection-title" data-screen-focus tabindex="-1">${escapeHtml(t('collection.heading'))}</h2>
        </div>
        <button type="button" data-action="close-collection">${escapeHtml(t('readiness.action.close'))}</button>
      </header>

      ${renderAccomplishments(locale, t, accomplishments)}
      ${renderThemes(locale, t, themes)}
      ${renderExaminers(t, examiners)}
      ${renderPersonalBests(locale, t, personalBests)}
    </section>
  `;
}

function renderAccomplishments(locale, t, accomplishments) {
  return `
    <section class="collection-group" aria-labelledby="collection-accomplishments-title">
      <h3 id="collection-accomplishments-title">${escapeHtml(t('collection.accomplishments.heading'))}</h3>
      <ul class="collection-list">
        ${accomplishments.map(accomplishment => `
          <li class="collection-item${accomplishment.earned ? ' earned' : ' locked'}">
            <strong>${escapeHtml(t(accomplishment.titleKey))}</strong>
            <span>${escapeHtml(t(accomplishment.descriptionKey))}</span>
            <span class="collection-status">${accomplishment.earned
              ? escapeHtml(t('collection.accomplishments.earnedOn', { date: formatDate(locale, accomplishment.achievedAt) }))
              : escapeHtml(t('collection.accomplishments.locked'))}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

function renderThemes(locale, t, themes) {
  return `
    <section class="collection-group" aria-labelledby="collection-themes-title">
      <h3 id="collection-themes-title">${escapeHtml(t('collection.themes.heading'))}</h3>
      <ul class="collection-list">
        ${themes.map(theme => `
          <li class="collection-item${theme.completed ? ' earned' : ' locked'}">
            <strong>${escapeHtml(t(theme.titleKey))}</strong>
            <span class="collection-status">${theme.completed
              ? escapeHtml(t('collection.themes.completedOn', { date: formatDate(locale, theme.achievedAt) }))
              : escapeHtml(t('collection.themes.notCompleted'))}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

function renderExaminers(t, examiners) {
  return `
    <section class="collection-group" aria-labelledby="collection-examiners-title">
      <h3 id="collection-examiners-title">${escapeHtml(t('collection.examiners.heading'))}</h3>
      <ul class="collection-list">
        ${examiners.map(examiner => `
          <li class="collection-item${examiner.encountered ? ' earned' : ' locked'}">
            <strong>${escapeHtml(t(examiner.nameKey))}</strong>
            <span class="collection-status">${escapeHtml(t(examiner.encountered
              ? 'collection.examiners.encountered'
              : 'collection.examiners.notEncountered'))}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

function renderPersonalBests(locale, t, personalBests) {
  return `
    <section class="collection-group" aria-labelledby="collection-personal-bests-title">
      <h3 id="collection-personal-bests-title">${escapeHtml(t('collection.personalBests.heading'))}</h3>
      ${personalBests.length === 0
        ? `<p>${escapeHtml(t('collection.personalBests.empty'))}</p>`
        : `<ul class="collection-list">
            ${personalBests.map(entry => `
              <li class="collection-item earned">
                <strong>${escapeHtml(t(entry.titleKey))}</strong>
                <span class="collection-status">${escapeHtml(t('collection.personalBests.entry', {
                  seconds: (entry.averageResponseMs / 1000).toFixed(1)
                }))}</span>
              </li>
            `).join('')}
          </ul>`}
    </section>
  `;
}

function formatDate(locale, timestamp) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(timestamp));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
