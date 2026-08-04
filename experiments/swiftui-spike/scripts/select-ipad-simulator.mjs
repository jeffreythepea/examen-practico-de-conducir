import { readFileSync } from 'node:fs';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

let payload;

try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  fail('Invalid simulator JSON');
}

if (payload !== undefined) {
  const runtimes =
    payload &&
    typeof payload === 'object' &&
    payload.devices &&
    typeof payload.devices === 'object'
      ? Object.values(payload.devices)
      : [];

  const device = runtimes
    .flatMap((devices) => (Array.isArray(devices) ? devices : []))
    .find(
      (candidate) =>
        candidate &&
        typeof candidate.name === 'string' &&
        candidate.name.includes('iPad') &&
        candidate.isAvailable === true &&
        typeof candidate.udid === 'string' &&
        candidate.udid.length > 0
    );

  if (device) {
    process.stdout.write(`${device.udid}\n`);
  } else {
    fail('No available iPad simulator');
  }
}
