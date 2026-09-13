import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="mg-otp-gate-script">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'homepage lead popup script must exist');

const classes = new Set();
const timers = [];
const elements = new Map();
const body = {
  classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
  contains: element => element === elements.get('mg-otp-gate'),
};
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    hidden: id === 'mg-otp-gate',
    inert: false,
    addEventListener() {},
    querySelector: () => ({ focus() {} }),
  });
  return elements.get(id);
};
const document = { body, getElementById: element };
const window = {
  setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
  requestAnimationFrame: callback => callback(),
  sessionStorage: { getItem: () => '1' }, // A previous visit must not suppress a new popup.
};

vm.runInNewContext(script, { document, window }, { filename: 'mg-otp-gate-script' });
assert.equal(timers.length, 1, 'popup should be scheduled without waiting for window load');
assert.equal(timers[0].delay, 5000, 'popup should open five seconds after page script starts');
assert.equal(element('mg-otp-gate').hidden, true, 'popup should start hidden');
timers[0].callback();
assert.equal(element('mg-otp-gate').hidden, false, 'popup should become visible after the timer');
assert.ok(classes.has('mg-locked'), 'page should lock while the popup is open');
assert.equal(element('mg-site-content').inert, true, 'background should become inert');

console.log('[test-popup-timing] five-second popup and repeat-visit behavior passed');
