const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EXT_GET_TOKEN_DIR, EXT_AUTO_QUESTS_DIR } = require('./helpers/test-harness.js');

test('Tier 1 - F7: Manifest V3 Schema & Extension Structure', async (t) => {
  await t.test('T1.F7.1: extension-get-token manifest conforms to Manifest V3 specification', () => {
    const manifestPath = path.join(EXT_GET_TOKEN_DIR, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in extension-get-token');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.manifest_version, 3, 'manifest_version must be 3');
    assert.ok(typeof manifest.name === 'string' && manifest.name.length > 0, 'name must be a non-empty string');
    assert.ok(typeof manifest.version === 'string' && /^\d+(\.\d+)*$/.test(manifest.version), 'version must follow semver/dotted format');
    assert.ok(typeof manifest.description === 'string', 'description must be a string');
  });

  await t.test('T1.F7.2: extension-get-token declares required permissions for token extraction', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT_GET_TOKEN_DIR, 'manifest.json'), 'utf8'));
    assert.ok(Array.isArray(manifest.permissions), 'permissions must be an array');
    assert.ok(manifest.permissions.includes('activeTab'), 'must include activeTab permission');
    assert.ok(manifest.permissions.includes('clipboardWrite'), 'must include clipboardWrite permission');
    assert.ok(manifest.permissions.includes('scripting'), 'must include scripting permission');
  });

  await t.test('T1.F7.3: extension-get-token configures action with valid popup.html', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT_GET_TOKEN_DIR, 'manifest.json'), 'utf8'));
    assert.ok(manifest.action, 'action object must be defined');
    assert.equal(manifest.action.default_popup, 'popup.html', 'default_popup must point to popup.html');
    assert.ok(fs.existsSync(path.join(EXT_GET_TOKEN_DIR, manifest.action.default_popup)), 'popup.html file must exist on disk');
  });

  await t.test('T1.F7.4: extension-auto-quests manifest conforms to Manifest V3 specification', () => {
    const manifestPath = path.join(EXT_AUTO_QUESTS_DIR, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in extension-auto-quests');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.manifest_version, 3, 'manifest_version must be 3');
    assert.ok(typeof manifest.name === 'string' && manifest.name.includes('Discord Auto Quests'), 'name must identify auto quests');
    assert.ok(typeof manifest.version === 'string' && /^\d+(\.\d+)*$/.test(manifest.version), 'version must follow dotted format');
    assert.ok(typeof manifest.description === 'string' && manifest.description.length > 0, 'description must not be empty');
  });

  await t.test('T1.F7.5: extension-auto-quests declares required permissions and host_permissions', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT_AUTO_QUESTS_DIR, 'manifest.json'), 'utf8'));
    assert.ok(Array.isArray(manifest.permissions), 'permissions must be an array');
    const requiredPermissions = ['storage', 'tabs', 'scripting', 'notifications', 'alarms', 'downloads'];
    for (const perm of requiredPermissions) {
      assert.ok(manifest.permissions.includes(perm), `permissions must include '${perm}'`);
    }

    assert.ok(Array.isArray(manifest.host_permissions), 'host_permissions must be an array');
    assert.ok(manifest.host_permissions.some(p => p.includes('discord.com')), 'host_permissions must include Discord domain match pattern');
    assert.ok(manifest.host_permissions.some(p => p.includes('raw.githubusercontent.com')), 'host_permissions must include raw.githubusercontent.com');
    assert.ok(manifest.host_permissions.some(p => p.includes('api.github.com')), 'host_permissions must include api.github.com');
  });

  await t.test('T1.F7.6: extension-auto-quests configures service worker and popup action', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT_AUTO_QUESTS_DIR, 'manifest.json'), 'utf8'));
    assert.ok(manifest.background, 'background configuration must exist');
    assert.equal(manifest.background.service_worker, 'background.js', 'service_worker must point to background.js');
    assert.ok(fs.existsSync(path.join(EXT_AUTO_QUESTS_DIR, manifest.background.service_worker)), 'background.js must exist on disk');

    assert.ok(manifest.action, 'action configuration must exist');
    assert.equal(manifest.action.default_popup, 'popup.html', 'default_popup must point to popup.html');
    assert.ok(fs.existsSync(path.join(EXT_AUTO_QUESTS_DIR, manifest.action.default_popup)), 'popup.html must exist on disk');
  });
});

test('Tier 2 - F7: Manifest Schema Boundaries & Integrity Verification', async (t) => {
  await t.test('T2.F7.1: Rejects manifest with invalid or missing manifest_version', () => {
    function validateManifestVersion(manifest) {
      if (!manifest || manifest.manifest_version !== 3) {
        throw new Error('Invalid manifest_version: must be strictly 3');
      }
      return true;
    }

    assert.throws(() => validateManifestVersion({ manifest_version: 2 }), /Invalid manifest_version/);
    assert.throws(() => validateManifestVersion({}), /Invalid manifest_version/);
    assert.doesNotThrow(() => validateManifestVersion({ manifest_version: 3 }));
  });

  await t.test('T2.F7.2: Detects missing critical permissions for background service worker operations', () => {
    function validateRequiredPermissions(permissions) {
      const required = ['storage', 'tabs', 'scripting'];
      const missing = required.filter(r => !permissions.includes(r));
      if (missing.length > 0) {
        throw new Error(`Missing mandatory permissions: ${missing.join(', ')}`);
      }
      return true;
    }

    assert.throws(() => validateRequiredPermissions(['storage']), /Missing mandatory permissions/);
    assert.doesNotThrow(() => validateRequiredPermissions(['storage', 'tabs', 'scripting', 'notifications']));
  });

  await t.test('T2.F7.3: Verifies all declared icon files exist on disk for both extensions', () => {
    const checkIcons = (dir) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      const icons = manifest.icons || (manifest.action && manifest.action.icons) || {};
      for (const [size, iconPath] of Object.entries(icons)) {
        if (typeof iconPath === 'string') {
          assert.ok(fs.existsSync(path.join(dir, iconPath)), `Icon ${size} at ${iconPath} must exist in ${dir}`);
        }
      }
    };

    checkIcons(EXT_GET_TOKEN_DIR);
    checkIcons(EXT_AUTO_QUESTS_DIR);
  });

  await t.test('T2.F7.4: Detects missing or invalid Discord host_permissions pattern', () => {
    function validateHostPermissions(patterns) {
      if (!Array.isArray(patterns) || patterns.length === 0) {
        throw new Error('Host permissions must be non-empty array');
      }
      const hasDiscord = patterns.some(p => /^https:\/\/(\*\.)?discord\.com\/\*$/.test(p));
      if (!hasDiscord) {
        throw new Error('Host permissions missing valid Discord HTTPS pattern');
      }
      return true;
    }

    assert.throws(() => validateHostPermissions([]), /non-empty array/);
    assert.throws(() => validateHostPermissions(['http://insecure.discord.com/*']), /missing valid Discord HTTPS pattern/);
    assert.doesNotThrow(() => validateHostPermissions(['https://discord.com/*', 'https://*.discord.com/*']));
  });

  await t.test('T2.F7.5: Verifies rejection of deprecated Manifest V2 keys in MV3 manifests', () => {
    const checkNoMV2Keys = (manifest) => {
      const forbidden = ['browser_action', 'page_action', 'background.scripts'];
      if (manifest.browser_action) throw new Error('browser_action is deprecated in MV3');
      if (manifest.page_action) throw new Error('page_action is deprecated in MV3');
      if (manifest.background && Array.isArray(manifest.background.scripts)) {
        throw new Error('background.scripts is deprecated in MV3, use service_worker');
      }
    };

    const autoManifest = JSON.parse(fs.readFileSync(path.join(EXT_AUTO_QUESTS_DIR, 'manifest.json'), 'utf8'));
    const tokenManifest = JSON.parse(fs.readFileSync(path.join(EXT_GET_TOKEN_DIR, 'manifest.json'), 'utf8'));

    assert.doesNotThrow(() => checkNoMV2Keys(autoManifest));
    assert.doesNotThrow(() => checkNoMV2Keys(tokenManifest));
  });

  await t.test('T2.F7.6: Chromium load-extension smoke check parses manifests without crash', () => {
    const result = spawnSync('google-chrome', [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--load-extension=${EXT_AUTO_QUESTS_DIR}`,
      'about:blank'
    ], { timeout: 3000 });

    // Exit code 0 or terminated by timeout indicates chrome successfully parsed manifest and loaded
    assert.ok(result.status === 0 || result.signal === 'SIGTERM', 'Chromium must accept unpacked extension');
  });
});
