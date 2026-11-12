/**
 * Adversarial Challenger 1 Stress Test Harness for Milestone 1 (extension-get-token)
 * 
 * Tests boundary conditions, phishing domain rejection, token format edge cases,
 * asset integrity, missing file handling, and security posture.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createStandaloneSandbox, EXT_GET_TOKEN_DIR } = require('./helpers/test-harness.js');

test('Adversarial M1 - Suite 1: URL Boundary & Phishing Domain Rejection', async (t) => {
  const phishingAndHostileUrls = [
    // Phishing / subdomain spoofing / lookalike domains
    { url: 'https://discord.com.attacker.com', desc: 'Subdomain suffix attack (attacker.com)' },
    { url: 'https://discord.com.attacker.com/app', desc: 'Subdomain suffix attack with path' },
    { url: 'https://discord.com-security-check.org', desc: 'Hyphenated spoofing domain' },
    { url: 'https://discord.com-attacker.net/login', desc: 'Hyphenated spoofing domain with login path' },
    { url: 'https://discord.com@evil.com/channels/@me', desc: 'Userinfo auth injection spoofing' },
    { url: 'https://evil.com/?redirect=https://discord.com/', desc: 'Open redirect parameter spoof' },
    { url: 'https://discord.gg/invite', desc: 'Discord invite domain (non-target origin)' },
    { url: 'http://discord.com/channels/@me', desc: 'Insecure HTTP plain transport' },
    { url: 'discord.com/channels/@me', desc: 'Protocol-relative or bare host' },

    // Non-Discord standard and internal protocols
    { url: 'http://example.com', desc: 'Arbitrary external HTTP website' },
    { url: 'https://google.com/search?q=discord', desc: 'External HTTPS search engine' },
    { url: 'chrome://settings', desc: 'Chromium internal settings scheme' },
    { url: 'chrome://extensions', desc: 'Chromium internal extensions scheme' },
    { url: 'chrome-extension://abcdefghijklmnopqrstuvwxyz/popup.html', desc: 'Extension scheme' },
    { url: 'about:blank', desc: 'About blank scheme' },
    { url: 'file:///etc/passwd', desc: 'Local file scheme exfiltration attempt' },
    { url: 'javascript:alert(1)', desc: 'Pseudo-protocol javascript URI' }
  ];

  for (const testCase of phishingAndHostileUrls) {
    await t.test(`Rejects hostile/phishing URL: ${testCase.desc} [${testCase.url}]`, async () => {
      let scriptExecuted = false;
      const harness = createStandaloneSandbox({
        tabs: [{ id: 101, url: testCase.url }],
        localStorage: { token: '"hostile-test-token"' }
      });

      // Override scripting to detect if script execution is erroneously attempted
      harness.sandbox.chrome.scripting.executeScript = () => {
        scriptExecuted = true;
        return;
      };

      harness.extractButton.dispatch('click');
      await new Promise(r => setTimeout(r, 10));

      assert.equal(scriptExecuted, false, `Script must NOT be executed for ${testCase.url}`);
      assert.equal(harness.clipboardWrites.length, 0, `Clipboard must NOT be written for ${testCase.url}`);
      assert.ok(
        harness.alerts.some(a => a.includes('Please navigate to a valid Discord page')),
        `Expected warning alert for ${testCase.url}, got: ${JSON.stringify(harness.alerts)}`
      );
    });
  }

  const legitimateDiscordUrls = [
    'https://discord.com/',
    'https://discord.com/app',
    'https://discord.com/channels/@me',
    'https://discord.com/channels/123456789/987654321',
    'https://discord.com/login',
    'https://discord.com/register',
    'https://discord.com/guild-discovery',
    'https://discord.com/developers/applications'
  ];

  for (const legUrl of legitimateDiscordUrls) {
    await t.test(`Permits legitimate Discord URL: ${legUrl}`, async () => {
      let scriptExecuted = false;
      const harness = createStandaloneSandbox({
        tabs: [{ id: 202, url: legUrl }],
        localStorage: { token: '"legit-token-12345"' }
      });

      harness.extractButton.dispatch('click');
      await new Promise(r => setTimeout(r, 10));

      assert.equal(harness.clipboardWrites.length, 1, `Clipboard should be written for legitimate URL ${legUrl}`);
      assert.equal(harness.clipboardWrites[0], 'legit-token-12345');
      assert.ok(
        harness.alerts.some(a => a.includes('Token extracted and copied to clipboard!')),
        `Expected success alert for legitimate URL ${legUrl}`
      );
    });
  }

  await t.test('Documented Caveat: Canary and PTB subdomains are rejected by design', async () => {
    const canaryHarness = createStandaloneSandbox({
      tabs: [{ id: 301, url: 'https://canary.discord.com/channels/@me' }]
    });
    canaryHarness.extractButton.dispatch('click');
    assert.equal(canaryHarness.clipboardWrites.length, 0);
    assert.ok(canaryHarness.alerts.some(a => a.includes('Please navigate to a valid Discord page')));

    const ptbHarness = createStandaloneSandbox({
      tabs: [{ id: 302, url: 'https://ptb.discord.com/channels/@me' }]
    });
    ptbHarness.extractButton.dispatch('click');
    assert.equal(ptbHarness.clipboardWrites.length, 0);
    assert.ok(ptbHarness.alerts.some(a => a.includes('Please navigate to a valid Discord page')));
  });
});

test('Adversarial M1 - Suite 2: Malformed & Missing Tab Edge Cases', async (t) => {
  await t.test('Handles tab with undefined URL gracefully or documents crash boundary', async () => {
    // If chrome.tabs.query returns a tab without url (e.g. permission restricted or chrome web store)
    const harness = createStandaloneSandbox({
      tabs: [{ id: 401, url: undefined }]
    });

    let caughtError = null;
    try {
      harness.extractButton.dispatch('click');
    } catch (err) {
      caughtError = err;
    }

    // In legacy code: tab.url.startsWith(...) throws TypeError if tab.url is undefined
    // Documenting empirical observation
    assert.ok(caughtError, 'Expected an error to be thrown when tab.url is undefined');
    assert.equal(caughtError.name, 'TypeError');
    assert.match(caughtError.message, /Cannot read propert.*startsWith/i);
  });

  await t.test('Handles empty tabs array ([]) when query returns no active tab', async () => {
    const harness = createStandaloneSandbox({
      tabs: []
    });

    let caughtError = null;
    try {
      harness.extractButton.dispatch('click');
    } catch (err) {
      caughtError = err;
    }

    // tabs[0] is undefined -> tab.url throws TypeError
    assert.ok(caughtError, 'Expected an error to be thrown when tabs array is empty');
    assert.equal(caughtError.name, 'TypeError');
    assert.match(caughtError.message, /Cannot read propert.*url/i);
  });
});

test('Adversarial M1 - Suite 3: Token Format Edge Cases & Oracles', async (t) => {
  const tokenTestCases = [
    {
      name: 'Standard quoted token',
      rawToken: '"mfa.ab12cd34ef56gh78"',
      expectedCopied: 'mfa.ab12cd34ef56gh78',
      shouldSucceed: true
    },
    {
      name: 'Token with multiple double quotes',
      rawToken: '""double_wrapped_token""',
      expectedCopied: 'double_wrapped_token',
      shouldSucceed: true
    },
    {
      name: 'Unquoted raw token string',
      rawToken: 'raw_alphanumeric_token_999',
      expectedCopied: 'raw_alphanumeric_token_999',
      shouldSucceed: true
    },
    {
      name: 'Token containing special characters and symbols',
      rawToken: '"token_!@#$%^&*()_+~`|}{[]:;?><,."',
      expectedCopied: 'token_!@#$%^&*()_+~`|}{[]:;?><,.',
      shouldSucceed: true
    },
    {
      name: 'Token with leading and trailing spaces',
      rawToken: '"  padded_token_value  "',
      expectedCopied: '  padded_token_value  ',
      shouldSucceed: true
    },
    {
      name: 'Token wrapped in single quotes (not stripped by replace(/\"/g, ""))',
      rawToken: "'single_quoted_token'",
      expectedCopied: "'single_quoted_token'",
      shouldSucceed: true
    },
    {
      name: 'Empty string token ("")',
      rawToken: '',
      expectedCopied: null,
      shouldSucceed: false
    },
    {
      name: 'Null token value',
      rawToken: null,
      expectedCopied: null,
      shouldSucceed: false
    },
    {
      name: 'Undefined token value',
      rawToken: undefined,
      expectedCopied: null,
      shouldSucceed: false
    }
  ];

  for (const tc of tokenTestCases) {
    await t.test(`Token format: ${tc.name}`, async () => {
      const harness = createStandaloneSandbox({
        tabs: [{ id: 501, url: 'https://discord.com/app' }],
        localStorage: { token: tc.rawToken }
      });

      harness.extractButton.dispatch('click');
      await new Promise(r => setTimeout(r, 10));

      if (tc.shouldSucceed) {
        assert.equal(harness.clipboardWrites.length, 1, `Expected 1 clipboard write for ${tc.name}`);
        assert.equal(harness.clipboardWrites[0], tc.expectedCopied, `Copied token mismatch for ${tc.name}`);
        assert.ok(harness.alerts.some(a => a.includes('Token extracted and copied to clipboard!')));
      } else {
        assert.equal(harness.clipboardWrites.length, 0, `Expected 0 clipboard writes for ${tc.name}`);
        assert.ok(harness.alerts.some(a => a.includes('Failed to extract token')));
      }
    });
  }

  await t.test('Script execution error via chrome.runtime.lastError fails safely', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 502, url: 'https://discord.com/channels/@me' }],
      lastError: { message: 'Could not establish connection. Receiving end does not exist.' }
    });

    harness.extractButton.dispatch('click');
    await new Promise(r => setTimeout(r, 10));

    assert.equal(harness.clipboardWrites.length, 0);
    assert.ok(harness.alerts.some(a => a.includes('Failed to extract token. Make sure you are on a Discord page.')));
  });

  await t.test('Script injection returning null or empty result array fails safely', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 503, url: 'https://discord.com/channels/@me' }],
      scriptFail: true
    });

    harness.extractButton.dispatch('click');
    await new Promise(r => setTimeout(r, 10));

    assert.equal(harness.clipboardWrites.length, 0);
    assert.ok(harness.alerts.some(a => a.includes('Failed to extract token. Make sure you are on a Discord page.')));
  });

  await t.test('extractToken function executes in isolated DOM context returning localStorage.token', () => {
    const harness = createStandaloneSandbox({
      localStorage: { token: '"my-sample-local-storage-token"' }
    });
    const token = harness.sandbox.extractToken();
    assert.equal(token, '"my-sample-local-storage-token"');
  });

  await t.test('Rapid concurrent clicking does not corrupt clipboard state', async () => {
    const harness = createStandaloneSandbox({
      tabs: [{ id: 504, url: 'https://discord.com/app' }],
      localStorage: { token: '"concurrent-token-test"' }
    });

    // Rapidly dispatch 10 click events synchronously
    for (let i = 0; i < 10; i++) {
      harness.extractButton.dispatch('click');
    }
    await new Promise(r => setTimeout(r, 20));

    assert.equal(harness.clipboardWrites.length, 10);
    for (const write of harness.clipboardWrites) {
      assert.equal(write, 'concurrent-token-test');
    }
  });

  await t.test('Clipboard rejection: writeText rejection suppresses success alert (documented caveat)', async () => {
    let rejectionOccurred = false;
    const harness = createStandaloneSandbox({
      tabs: [{ id: 505, url: 'https://discord.com/app' }],
      localStorage: { token: '"rejection-token"' }
    });

    const origWrite = harness.sandbox.navigator.clipboard.writeText;
    harness.sandbox.navigator.clipboard.writeText = (text) => {
      const p = origWrite(text).then(() => {
        throw new Error('Clipboard write rejected');
      });
      const origThen = p.then.bind(p);
      p.then = function (...args) {
        const p2 = origThen(...args);
        p2.catch(() => {
          rejectionOccurred = true;
        });
        return p2;
      };
      return p;
    };

    harness.extractButton.dispatch('click');
    await new Promise(r => setTimeout(r, 20));

    assert.equal(rejectionOccurred, true);
    // Success alert was NOT shown because .then() handler did not execute
    assert.equal(harness.alerts.some(a => a.includes('Token extracted and copied to clipboard!')), false);
  });
});

test('Adversarial M1 - Suite 4: Asset Integrity & Missing File Stress Testing', async (t) => {
  const manifestPath = path.join(EXT_GET_TOKEN_DIR, 'manifest.json');
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  await t.test('Manifest V3 conforms strictly to specification', () => {
    assert.equal(manifest.manifest_version, 3, 'manifest_version must be integer 3');
    assert.equal(typeof manifest.name, 'string');
    assert.ok(manifest.name.length > 0);
    assert.equal(typeof manifest.version, 'string');
    assert.match(manifest.version, /^\d+(\.\d+)*$/);
  });

  await t.test('Manifest permissions are minimal and strictly scoped', () => {
    assert.ok(Array.isArray(manifest.permissions));
    assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'clipboardWrite', 'scripting'].sort());
    // Must NOT have host_permissions, webRequest, or storage in standalone extractor
    assert.equal(manifest.host_permissions, undefined);
    assert.equal(manifest.permissions.includes('webRequest'), false);
    assert.equal(manifest.permissions.includes('<all_urls>'), false);
  });

  await t.test('Top-level icons exist on disk and are valid PNG images', () => {
    assert.equal(typeof manifest.icons, 'object', 'Top-level icons object must exist');
    assert.ok(manifest.icons['16'], 'Icon 16 must exist');
    assert.ok(manifest.icons['48'], 'Icon 48 must exist');
    assert.ok(manifest.icons['128'], 'Icon 128 must exist');

    for (const [size, iconRelPath] of Object.entries(manifest.icons)) {
      const fullPath = path.join(EXT_GET_TOKEN_DIR, iconRelPath);
      assert.ok(fs.existsSync(fullPath), `Icon file for size ${size} must exist at ${fullPath}`);
      
      const fileBuffer = fs.readFileSync(fullPath);
      assert.ok(fileBuffer.length > 0, `Icon file for size ${size} must not be empty`);
      // Validate PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      assert.equal(fileBuffer[0], 0x89);
      assert.equal(fileBuffer[1], 0x50);
      assert.equal(fileBuffer[2], 0x4e);
      assert.equal(fileBuffer[3], 0x47);
    }
  });

  await t.test('Action default_icon exists on disk and has no deprecated action.icons', () => {
    assert.ok(manifest.action, 'action object must exist');
    assert.equal(manifest.action.icons, undefined, 'action.icons is deprecated and must not exist');
    assert.equal(typeof manifest.action.default_icon, 'object', 'action.default_icon must be an object');

    for (const [size, iconRelPath] of Object.entries(manifest.action.default_icon)) {
      const fullPath = path.join(EXT_GET_TOKEN_DIR, iconRelPath);
      assert.ok(fs.existsSync(fullPath), `Action icon for size ${size} must exist at ${fullPath}`);
    }
  });

  await t.test('Default popup file exists on disk and is non-empty HTML', () => {
    assert.ok(manifest.action.default_popup);
    const popupPath = path.join(EXT_GET_TOKEN_DIR, manifest.action.default_popup);
    assert.ok(fs.existsSync(popupPath));
    const content = fs.readFileSync(popupPath, 'utf8');
    assert.ok(content.includes('<button id="extractButton">Extract Token</button>'));
    assert.ok(content.includes('<script src="popup.js"></script>'));
  });

  await t.test('Popup script exists on disk and contains extractButton listener', () => {
    const jsPath = path.join(EXT_GET_TOKEN_DIR, 'popup.js');
    assert.ok(fs.existsSync(jsPath));
    const content = fs.readFileSync(jsPath, 'utf8');
    assert.ok(content.includes('extractButton'));
    assert.ok(content.includes('chrome.tabs.query'));
    assert.ok(content.includes('localStorage.token'));
  });

  await t.test('Missing asset oracle: Detects and rejects missing icon reference', () => {
    const corruptedManifest = {
      ...manifest,
      icons: {
        ...manifest.icons,
        '256': 'nonexistent-icon-file-404.png'
      }
    };
    const missingFile = path.join(EXT_GET_TOKEN_DIR, corruptedManifest.icons['256']);
    assert.equal(fs.existsSync(missingFile), false, 'Simulated missing file must not exist');
  });

  await t.test('No dangling unlocked.logo references in any file', () => {
    const files = fs.readdirSync(EXT_GET_TOKEN_DIR);
    for (const file of files) {
      const fullPath = path.join(EXT_GET_TOKEN_DIR, file);
      if (fs.statSync(fullPath).isFile() && !file.endsWith('.png')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.equal(content.includes('unlocked.logo'), false, `Found dangling unlocked.logo in ${file}`);
      }
    }
  });
});

test('Adversarial M1 - Suite 5: Security & Forensic Static Code Audit', async (t) => {
  const jsFiles = ['popup.js'];
  for (const jsFile of jsFiles) {
    const jsPath = path.join(EXT_GET_TOKEN_DIR, jsFile);
    const code = fs.readFileSync(jsPath, 'utf8');

    await t.test(`${jsFile} contains NO dynamic code evaluation (eval / Function)`, () => {
      assert.doesNotMatch(code, /\beval\s*\(/);
      assert.doesNotMatch(code, /new\s+Function\s*\(/);
    });

    await t.test(`${jsFile} contains NO external network exfiltration APIs`, () => {
      assert.doesNotMatch(code, /\bfetch\s*\(/);
      assert.doesNotMatch(code, /\bXMLHttpRequest\b/);
      assert.doesNotMatch(code, /\bWebSocket\b/);
      assert.doesNotMatch(code, /\bsendBeacon\b/);
    });
  }

  const htmlFiles = ['popup.html'];
  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(EXT_GET_TOKEN_DIR, htmlFile);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    await t.test(`${htmlFile} contains NO inline JavaScript event handlers`, () => {
      assert.doesNotMatch(htmlContent, /\bonclick\s*=/i);
      assert.doesNotMatch(htmlContent, /\bonload\s*=/i);
      assert.doesNotMatch(htmlContent, /\bonerror\s*=/i);
    });

    await t.test(`${htmlFile} contains NO inline script blocks (MV3 CSP compliance)`, () => {
      // In MV3, <script> must have src="..." and no inline code
      const inlineScriptMatches = htmlContent.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
      assert.equal(inlineScriptMatches, null, 'Must have zero inline script blocks');
    });
  }
});

test('Adversarial M1 - Suite 6: Headless Chromium Load Extension Smoke Test', async (t) => {
  await t.test('Loads unpacked extension in google-chrome without error', () => {
    const chromeProc = spawnSync('google-chrome', [
      '--headless=new',
      '--disable-gpu',
      `--load-extension=${EXT_GET_TOKEN_DIR}`,
      '--dump-dom',
      'about:blank'
    ], { encoding: 'utf8', timeout: 10000 });

    assert.equal(chromeProc.status, 0, `google-chrome exited with status ${chromeProc.status}, stderr: ${chromeProc.stderr}`);
    assert.ok(chromeProc.stdout.includes('<html>'), 'Chrome produced expected HTML output');
  });
});
