import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptPath = fileURLToPath(
  new URL('./select-ipad-simulator.mjs', import.meta.url)
);

function runSelector(payload) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    input: JSON.stringify(payload)
  });
}

test('prints the first available iPad UDID across installed runtimes', () => {
  const result = runSelector({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
        {
          name: 'iPhone 17 Pro',
          udid: 'PHONE-UDID',
          isAvailable: true
        },
        {
          name: 'iPad Pro 13-inch (M5)',
          udid: 'FIRST-IPAD-UDID',
          isAvailable: true
        }
      ],
      'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
        {
          name: 'iPad mini (A17 Pro)',
          udid: 'SECOND-IPAD-UDID',
          isAvailable: true
        }
      ]
    }
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'FIRST-IPAD-UDID\n');
  assert.equal(result.stderr, '');
});

test('skips unavailable iPads', () => {
  const result = runSelector({
    devices: {
      runtime: [
        {
          name: 'iPad Pro 13-inch (M5)',
          udid: 'UNAVAILABLE-IPAD',
          isAvailable: false
        },
        {
          name: 'iPad Air 13-inch (M3)',
          udid: 'AVAILABLE-IPAD',
          isAvailable: true
        }
      ]
    }
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'AVAILABLE-IPAD\n');
});

test('fails clearly when no available iPad simulator exists', () => {
  const result = runSelector({
    devices: {
      runtime: [
        {
          name: 'iPhone 17',
          udid: 'PHONE-ONLY',
          isAvailable: true
        }
      ]
    }
  });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /No available iPad simulator/);
});

test('rejects malformed simctl JSON', () => {
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    input: '{'
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid simulator JSON/);
});
