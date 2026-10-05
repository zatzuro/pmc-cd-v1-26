'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('config.js', 'utf8'), sandbox);
const api = new URL(sandbox.window.PRISA_CALENDAR_CONFIG.API_URL);
const manifest = JSON.parse(fs.readFileSync('google-apps-script/appsscript.json', 'utf8'));
assert.equal(manifest.webapp?.executeAs, 'USER_DEPLOYING');
assert.equal(manifest.webapp?.access, 'ANYONE_ANONYMOUS');
assert.equal(api.hostname, 'script.google.com');
assert.match(api.pathname, /^\/macros\/s\/[^/]+\/exec$/);
if (process.env.APPS_SCRIPT_DEPLOYMENT_ID) {
  assert.equal(api.pathname.split('/')[3], process.env.APPS_SCRIPT_DEPLOYMENT_ID,
    'Frontend API and CI deployment must be identical');
}
async function read(action, callback) {
  const url = new URL(api);
  url.searchParams.set('action', action);
  if (callback) url.searchParams.set('callback', callback);
  url.searchParams.set('t', Date.now().toString());
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${action}: HTTP failure`);
  const mime = response.headers.get('content-type') || '';
  assert.match(mime, callback ? /javascript/ : /application\/json/, `${action}: unexpected MIME`);
  const body = await response.text();
  let data;
  if (callback) {
    assert.ok(body.startsWith(`${callback}(`) && body.endsWith(');'), 'Missing JSONP callback');
    data = JSON.parse(body.slice(callback.length + 1, -2));
  } else data = JSON.parse(body);
  assert.equal(data.ok, true, `${action}: API returned failure`);
  return data.data;
}
async function main() {
  if (process.argv.includes('--config-only')) {
    console.log('Web App manifest and frontend deployment configuration OK');
    return;
  }
  const version = await read('version');
  assert.ok(version.version);
  const bootstrap = await read('bootstrap', 'qaProductionCalendar');
  assert.ok(Array.isArray(bootstrap.events));
  assert.ok(Array.isArray(bootstrap.specialDays));
  assert.ok(bootstrap.config && typeof bootstrap.config === 'object');
  console.log(JSON.stringify({ ok: true, events: bootstrap.events.length,
    specialDays: bootstrap.specialDays.length, configKeys: Object.keys(bootstrap.config).length,
    transport: 'JSON and JSONP', mutations: false }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
