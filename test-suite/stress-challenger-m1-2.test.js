const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const struct = require('node:buffer');
const zlib = require('node:zlib');
const {
  createStandaloneSandbox,
  EXT_GET_TOKEN_DIR
} = require('./helpers/test-harness.js');

test('Milestone 1 Challenger 2 - PNG Asset Deep Binary Integrity', async (t) => {
  const logoPath = path.join(EXT_GET_TOKEN_DIR, 'logo.png');

  await t.test('PNG.1: Magic bytes verify standard PNG 8-byte header', () => {
    assert.ok(fs.existsSync(logoPath), 'logo.png must exist in extension-get-token');
    const buffer = fs.readFileSync(logoPath);
    assert.equal(buffer.length, 24403, 'File size matches exactly 24,403 bytes');

    const expectedMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    assert.deepEqual(buffer.subarray(0, 8), expectedMagic, 'Magic bytes must match PNG header');
  });

  await t.test('PNG.2: Chunk traversal and CRC32 verification', () => {
    const buffer = fs.readFileSync(logoPath);
    let offset = 8;
    const chunks = [];

    // Table-based or zlib CRC32 function
    function computeCrc32(buf) {
      return (zlib.crc32(buf) >>> 0);
    }

    while (offset < buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
      const data = buffer.subarray(offset + 8, offset + 8 + length);
      const crc = buffer.readUInt32BE(offset + 8 + length);

      const typeAndData = buffer.subarray(offset + 4, offset + 8 + length);
      const expectedCrc = computeCrc32(typeAndData);

      assert.equal(crc, expectedCrc, `CRC mismatch in chunk ${type}`);
      chunks.push({ type, length, crc });
      offset += 12 + length;
    }

    assert.equal(offset, buffer.length, 'No trailing bytes allowed after IEND chunk');
    assert.equal(chunks[0].type, 'IHDR', 'First chunk must be IHDR');
    assert.equal(chunks[chunks.length - 1].type, 'IEND', 'Last chunk must be IEND');
    assert.equal(chunks[chunks.length - 1].length, 0, 'IEND chunk length must be 0');
  });

  await t.test('PNG.3: IHDR dimension and bit depth validation', () => {
    const buffer = fs.readFileSync(logoPath);
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer.readUInt8(24);
    const colorType = buffer.readUInt8(25);
    const compression = buffer.readUInt8(26);
    const filter = buffer.readUInt8(27);
    const interlace = buffer.readUInt8(28);

    assert.equal(width, 1600, 'Width must be 1600');
    assert.equal(height, 1600, 'Height must be 1600');
    assert.equal(bitDepth, 8, 'Bit depth must be 8');
    assert.equal(colorType, 3, 'Color type must be 3 (indexed palette)');
    assert.equal(compression, 0, 'Compression must be deflate');
    assert.equal(filter, 0, 'Filter must be standard adaptive');
    assert.equal(interlace, 0, 'Interlace must be non-interlaced');
  });
});

test('Milestone 1 Challenger 2 - Rapid Clicking & Concurrency Stress', async (t) => {
  await t.test('STRESS.1: Dispatches 100 rapid clicks synchronously without crash', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
      localStorage: { token: 'stress-token-abc' }
    });

    const CLICK_COUNT = 100;
    for (let i = 0; i < CLICK_COUNT; i++) {
      harness.extractButton.dispatch('click');
    }

    await new Promise(r => setTimeout(r, 20));

    assert.equal(harness.queriedTabs.length, CLICK_COUNT, 'All queries must be queued');
    assert.equal(harness.clipboardWrites.length, CLICK_COUNT, 'All writes must complete');
    assert.equal(harness.alerts.length, CLICK_COUNT, 'Each execution generates an alert');
  });

  await t.test('STRESS.2: Handles randomized asynchronous execution latencies (jitter)', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }]
    });

    let completed = 0;
    harness.sandbox.chrome.scripting.executeScript = (details, callback) => {
      const delay = Math.floor(Math.random() * 20) + 2;
      setTimeout(() => {
        completed++;
        callback([{ result: `token-${completed}` }]);
      }, delay);
    };

    const CONCURRENT_REQUESTS = 25;
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      harness.extractButton.dispatch('click');
    }

    await new Promise(r => setTimeout(r, 150));

    assert.equal(completed, CONCURRENT_REQUESTS);
    assert.equal(harness.clipboardWrites.length, CONCURRENT_REQUESTS);
    assert.equal(harness.alerts.length, CONCURRENT_REQUESTS);
  });

  await t.test('STRESS.3: Tab closed mid-flight during execution script returns clean error alert', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 99, url: 'https://discord.com/channels/@me' }]
    });

    harness.sandbox.chrome.scripting.executeScript = (details, callback) => {
      // Simulate tab closing while script injection was pending
      harness.setLastError({ message: 'No tab with id: 99' });
      callback(null);
    };

    harness.extractButton.dispatch('click');
    await new Promise(r => setTimeout(r, 10));

    assert.equal(harness.clipboardWrites.length, 0, 'No clipboard write when tab closed');
    assert.ok(harness.alerts.some(a => a.includes('Failed to extract token')), 'Clean error alert shown');
  });
});

test('Milestone 1 Challenger 2 - Clipboard Write Failure Handling', async (t) => {
  await t.test('CLIPBOARD.1: Document unfocused rejection produces unhandled promise rejection without crash', () => {
    const { spawnSync } = require('node:child_process');
    const result = spawnSync('node', ['-e', `
      const { createStandaloneSandbox } = require('./test-suite/helpers/test-harness.js');
      let rejected = false;
      let reasonMessage = '';
      process.on('unhandledRejection', (reason) => {
        rejected = true;
        reasonMessage = reason.message;
      });
      const harness = createStandaloneSandbox({
        clipboardError: true,
        tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
        localStorage: { token: 'unfocused-token' }
      });
      harness.extractButton.dispatch('click');
      setTimeout(() => {
        assert = require('node:assert/strict');
        assert.equal(rejected, true, 'Rejection must be unhandled due to missing .catch()');
        assert.match(reasonMessage, /Clipboard write failed/);
        assert.equal(harness.alerts.length, 0, 'No success alert on clipboard write failure');
        assert.equal(harness.clipboardWrites.length, 0);
        process.exit(0);
      }, 50);
    `], { cwd: path.resolve(__dirname, '..') });

    assert.equal(result.status, 0, 'Subprocess failed: ' + result.stderr.toString());
  });

  await t.test('CLIPBOARD.2: Clipboard permission denied isolates error and suppresses false success', () => {
    const { spawnSync } = require('node:child_process');
    const result = spawnSync('node', ['-e', `
      const { createStandaloneSandbox } = require('./test-suite/helpers/test-harness.js');
      let rejected = false;
      let errorName = '';
      process.on('unhandledRejection', (reason) => {
        rejected = true;
        errorName = reason.name;
      });
      const harness = createStandaloneSandbox({
        tabs: [{ id: 1, url: 'https://discord.com/channels/@me' }],
        localStorage: { token: 'denied-token' }
      });
      harness.sandbox.navigator.clipboard.writeText = async () => {
        const err = new Error('NotAllowedError: Write permission denied by user agent');
        err.name = 'NotAllowedError';
        throw err;
      };
      harness.extractButton.dispatch('click');
      setTimeout(() => {
        assert = require('node:assert/strict');
        assert.equal(rejected, true, 'Permission denial causes unhandled promise rejection');
        assert.equal(errorName, 'NotAllowedError');
        assert.equal(harness.alerts.length, 0, 'No false positive success alert displayed');
        process.exit(0);
      }, 50);
    `], { cwd: path.resolve(__dirname, '..') });

    assert.equal(result.status, 0, 'Subprocess failed: ' + result.stderr.toString());
  });
});

test('Milestone 1 Challenger 2 - Tab Query Boundary & Anomaly Isolation', async (t) => {
  await t.test('TAB.1: Empty tabs array throws TypeError in legacy code', () => {
    const harness = createStandaloneSandbox({
      tabs: []
    });

    assert.throws(
      () => harness.extractButton.dispatch('click'),
      /Cannot read properties of undefined/
    );
  });

  await t.test('TAB.2: Tab missing url property throws TypeError in legacy code', () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 50 }]
    });

    assert.throws(
      () => harness.extractButton.dispatch('click'),
      /Cannot read properties of undefined/
    );
  });

  await t.test('TAB.3: Privileged or non-Discord pages correctly alert navigation notice', () => {
    const testCases = [
      'https://google.com',
      'chrome://settings',
      'devtools://devtools/bundled/inspector.html',
      'https://canary.discord.com/app',
      'https://ptb.discord.com/app',
      'http://discord.com/login',
      'https://discord.com.evil.org'
    ];

    for (const url of testCases) {
      const harness = createStandaloneSandbox({
        tabs: [{ id: 10, url }]
      });

      harness.extractButton.dispatch('click');
      assert.equal(harness.clipboardWrites.length, 0, `Must not extract token from ${url}`);
      assert.ok(
        harness.alerts.some(a => a.includes('Please navigate to a valid Discord page')),
        `Must alert navigation notice for ${url}`
      );
    }
  });
});
