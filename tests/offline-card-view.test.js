import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  offlineCardPresentation,
  renderOfflineCard
} from '../src/offline-card-view.js';
import { OFFLINE_STATUSES } from '../src/offline-client.js';
import { translate } from '../src/i18n.js';

const card = (overrides = {}) => renderOfflineCard({
  offlineState: { status: 'online-only' },
  locale: 'en',
  ...overrides
});

test('every status the offline client can publish renders a card that says something true', () => {
  // The transient statuses had no branch and fell through to the "Online
  // only" copy — which carries a live Download button, so the second half of
  // a double tap during an apply started a rival download.
  const seen = new Set();
  for (const status of OFFLINE_STATUSES) {
    for (const hasProgress of [false, true]) {
      const { messageKey, action } = offlineCardPresentation({ status, hasProgress });
      seen.add(messageKey);
      if (status !== 'online-only') {
        assert.notEqual(messageKey, 'offline.onlineOnly', `${status} falls through to the online-only copy`);
      }
      for (const locale of ['en', 'es']) {
        assert.notEqual(translate(locale, messageKey), messageKey, `${messageKey} is missing ${locale} copy`);
        if (action) assert.notEqual(translate(locale, action.labelKey), action.labelKey);
      }
    }
  }
  // Nothing to press while the worker is mid-command: an action offered here
  // races the command already running.
  for (const status of ['applying-update', 'cancelling', 'checking-update', 'unsupported']) {
    const { html, action } = card({ offlineState: { status } });
    assert.equal(action, null, `${status} must offer no action`);
    assert.doesNotMatch(html, /<button/, `${status} must render no button`);
  }
  assert.equal(seen.size, OFFLINE_STATUSES.length);
});

test('each status renders its own button in the one action slot', () => {
  for (const [status, expected] of [
    ['downloading', 'cancel'],
    ['ready', 'check'],
    ['update-available', 'download'],
    ['update-ready', 'apply-update'],
    ['download-paused', 'download'],
    ['failed', 'download']
  ]) {
    const { html, action } = card({ offlineState: { status, completedAssets: 3 } });
    assert.equal(action, expected, status);
    const buttons = [...html.matchAll(/data-offline-action="([a-z-]+)"/g)].map(match => match[1]);
    // One slot, one button: this is why a status change swaps the control
    // under the learner's finger and why the taps have to be guarded.
    assert.deepEqual(buttons, [expected], `${status} must offer exactly one action`);
  }
  assert.match(card({ offlineState: { status: 'download-paused', completedAssets: 3 } }).html, /Resume download/);
  assert.match(card({ offlineState: { status: 'download-paused' } }).html, /Download for offline use/);
});

test('the card shows the installed package hash the device check reads', () => {
  // The hash on the card is how a device pass tells an applied update from an
  // old page running under a new package (task #17, 2026-08-14).
  const { html } = card({ offlineState: { status: 'ready', activeVersion: 'abcd1234ef567890' } });
  assert.match(html, /<p class="offline-version">Installed package: abcd1234<\/p>/);
  assert.doesNotMatch(html, /ef567890/, 'only the first eight characters are shown');
  assert.match(
    renderOfflineCard({ offlineState: { status: 'ready', activeVersion: 'abcd1234ef567890' }, locale: 'es' }).html,
    /Paquete instalado: abcd1234/
  );
});

test('a check that could not reach the network says so without claiming a failure', () => {
  const { html } = card({ offlineState: { status: 'ready', activeVersion: 'abcd1234', checkFailed: true } });
  assert.match(html, /Could not check for updates/);
  assert.doesNotMatch(html, /download failed/i, 'a healthy package must not be reported as a failed download');
  assert.match(html, /abcd1234/, 'the installed package is still reported');
  // "Checked just now" is only true when the check actually reached the network.
  assert.doesNotMatch(html, /latest package/);
  assert.match(card({ offlineState: { status: 'ready' }, upToDate: true }).html, /latest package/);
});

test('progress is reported in bytes and drives the progress element', () => {
  const { html } = card({ offlineState: { status: 'downloading', completedBytes: 3_500_000, totalBytes: 70_000_000, completedAssets: 12 } });
  assert.match(html, /<progress data-offline-progress value="3500000" max="70000000" ><\/progress>/);
  assert.match(html, /3\.5 MB of 70\.0 MB/);
  assert.equal(formatBytes(70_902_195), '70.9 MB');
  // With nothing to report the bar is hidden rather than shown at zero.
  assert.match(card().html, /<progress[^>]*max="1" hidden>/);
});

test('the install instructions appear only outside the installed app', () => {
  assert.match(card().html, /Add to Home Screen/);
  assert.doesNotMatch(card({ standalone: true }).html, /Add to Home Screen/);
  assert.match(renderOfflineCard({ offlineState: { status: 'online-only' }, locale: 'es' }).html, /Añadir a pantalla de inicio/);
});
