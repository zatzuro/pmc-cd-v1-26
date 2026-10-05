const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
function transport() {
  const source = fs.readFileSync('app.js', 'utf8');
  const code = source.slice(source.indexOf('  let jsonpSeq=0;'), source.indexOf('  async function apiGet'));
  let now = 0;
  const timers = new Map();
  let timerId = 0;
  const scripts = [];
  const window = {};
  const context = {window, URL, Date, Promise, Error, apiReady: () => true,
    cfg: {API_URL: 'https://script.google.com/macros/s/test/exec'},
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, {fn, at: now + delay}); return id; },
    clearTimeout(id) {timers.delete(id);},
    document: {createElement: () => ({remove() {this.removed = true;}}),
      head: {append(script) {scripts.push(script);}}}
  };
  vm.runInNewContext(code + '\nthis.request = jsonpRequest;', context);
  return {request: context.request, scripts, window,
    advance(ms) {now += ms; for(const [id,timer] of [...timers]) if(timer.at <= now) {timers.delete(id); timer.fn();}},
    callback() {return new URL(scripts.at(-1).src).searchParams.get('callback');}};
}
test('a valid reply after the former 20-second deadline still loads', async () => {
  const t = transport();
  const result = t.request({action:'bootstrap'});
  t.advance(20650);
  assert.equal(t.scripts[0].removed, undefined);
  t.window[t.callback()]({ok:true,data:{events:[1]}});
  assert.equal((await result).events.length, 1);
  assert.equal(t.scripts[0].removed, true);
});
test('timeout rejects once and a late callback is safely ignored', async () => {
  const t = transport();
  const result = t.request({action:'bootstrap'});
  const rejection = assert.rejects(result,/tiempo de espera/);
  t.advance(60000);
  await rejection;
  assert.doesNotThrow(() => t.window[t.callback()]({ok:true,data:{}}));
  t.advance(120000);
  assert.equal(t.window[t.callback()], undefined);
});
