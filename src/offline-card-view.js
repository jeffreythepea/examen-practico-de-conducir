// The offline card's markup. Pure: it is handed the client's state and gives
// back HTML plus the action it offered, so the controller can keep its own
// bookkeeping (the arrival timestamp that stops a fast double tap acting on a
// button that just replaced another) without a view function owning a clock.
//
// Extracted from app.js so the card can be rendered and read in a test. Every
// bug this surface has had — a transient status falling through to the online
// only copy, a failed check claiming the download failed, Cancel appearing
// under a finger aimed at Download — was in markup a test could not execute.
import { translate } from './i18n.js';

// Every status the offline client publishes needs its own card: the transient
// ones used to fall through to the "Online only" copy, which carries a live
// Download button — the second half of a double tap during an apply started a
// rival download that could quietly un-apply the update.
const RESUME_ACTION = hasProgress => ({
  action: 'download',
  labelKey: hasProgress ? 'offline.resumeDownload' : 'offline.download'
});

export function offlineCardPresentation({ status, hasProgress = false }) {
  switch (status) {
    case 'unsupported':
      return { messageKey: 'offline.unsupported', action: null };
    case 'downloading':
      return { messageKey: 'offline.downloading', action: { action: 'cancel', labelKey: 'offline.cancel' } };
    case 'cancelling':
      return { messageKey: 'offline.cancelling', action: null };
    case 'applying-update':
      return { messageKey: 'offline.applyingUpdate', action: null };
    case 'checking-update':
      return { messageKey: 'offline.checkingUpdate', action: null };
    // An installed package otherwise offers nothing to press: the only update
    // check ran at registration, so a running app could not ask again without
    // being force-quit.
    case 'ready':
      return { messageKey: 'offline.ready', action: { action: 'check', labelKey: 'offline.checkForUpdate' } };
    case 'update-available':
      return { messageKey: 'offline.updateAvailable', action: { action: 'download', labelKey: 'offline.downloadUpdate' } };
    case 'update-ready':
      return { messageKey: 'offline.updateReady', action: { action: 'apply-update', labelKey: 'offline.applyUpdate' } };
    case 'download-paused':
      return { messageKey: 'offline.downloadPaused', action: RESUME_ACTION(hasProgress) };
    case 'failed':
      return { messageKey: 'offline.failedRetained', action: RESUME_ACTION(hasProgress) };
    default:
      return { messageKey: 'offline.onlineOnly', action: RESUME_ACTION(hasProgress) };
  }
}

export function formatBytes(value) {
  return `${(Number(value) / 1_000_000).toFixed(1)} MB`;
}

/**
 * @param {{
 *   offlineState: object|null,
 *   locale: string,
 *   standalone: boolean,
 *   upToDate: boolean
 * }} input
 * @returns {{ html: string, action: string|null }}
 */
export function renderOfflineCard({ offlineState, locale, standalone = false, upToDate = false } = {}) {
  const t = (key, variables) => translate(locale, key, variables);
  const status = offlineState?.status ?? 'unsupported';
  const completed = offlineState?.completedBytes ?? 0;
  const total = offlineState?.totalBytes ?? 0;
  const progress = total > 0 ? Math.min(completed, total) : 0;
  const hasProgress = (offlineState?.completedAssets ?? 0) > 0;
  const { messageKey, action } = offlineCardPresentation({ status, hasProgress });
  const actions = action
    ? `<button type="button" data-offline-action="${action.action}">${t(action.labelKey)}</button>`
    : '';
  const html = `<section class="offline-card" aria-labelledby="offline-title">
      <h3 id="offline-title">${t('offline.title')}</h3>
      <div role="status" aria-live="polite">
        <p>${t(messageKey)}</p>
        ${offlineState?.activeVersion ? `<p class="offline-version">${t('offline.activeVersion', { hash: offlineState.activeVersion.slice(0, 8) })}</p>` : ''}
        ${offlineState?.checkFailed ? `<p class="offline-checked">${t('offline.checkUnavailable')}</p>` : ''}
        ${upToDate && status === 'ready' ? `<p class="offline-checked">${t('offline.upToDate')}</p>` : ''}
        ${total > 0 ? `<p>${t('offline.bytes', { completed: formatBytes(completed), total: formatBytes(total) })}</p>` : ''}
      </div>
      <progress data-offline-progress value="${progress}" max="${total || 1}" ${total > 0 ? '' : 'hidden'}></progress>
      ${actions}
      ${standalone ? '' : `<details>
        <summary>${t('offline.installTitle')}</summary>
        <p>${t('offline.installSafari')}</p>
        <p>${t('offline.transferProgress')}</p>
      </details>`}
    </section>`;
  return { html, action: action?.action ?? null };
}
