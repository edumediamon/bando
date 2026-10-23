import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { stages, clamp, advancePlayback } from '../process.js';

function loadApp(source) {
  const elements = new Map();
  function element() {
    return {
      children: [], listeners: {}, style: { setProperty(name, value) { this[name] = value; } },
      classList: { toggle() {} },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
      querySelectorAll() { return this.children; },
      querySelector() { return element(); },
      click() { this.listeners.click(); },
    };
  }
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  let pendingFrame;
  runInNewContext(source.replace(/^import .*;\r?\n/gm, ''), {
    stages, clamp, advancePlayback,
    buildScene() { return {}; },
    createRenderer() { return { setMesh() {}, render() {} }; },
    document: {
      hidden: false, getElementById: get,
      createElement: element, createTextNode: text => ({ textContent: text }),
      addEventListener() {},
    },
    window: { addEventListener() {} },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame(callback) { pendingFrame = callback; return 1; },
    cancelAnimationFrame() { pendingFrame = undefined; },
  });
  return {
    get,
    frame(now) { const callback = pendingFrame; pendingFrame = undefined; callback(now); },
  };
}

test('play starts from each selected process and toggles pause and resume without losing position', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  for (let stage = 0; stage < stages.length; stage++) {
    const app = loadApp(source);
    app.get('stage-list').children[stage].click();
    app.get('play').click();
    assert.equal(app.get('stage-name').textContent, stages[stage].name);
    assert.equal(app.get('stage-list').children[stage]['aria-current'], 'step');
    assert.equal(app.get('progress').value, 0);
    assert.equal(app.get('progress-value').value, '0%');
    assert.equal(app.get('play').ariaLabel, '공정 일시정지');

    app.frame(1000);
    app.frame(1100);
    assert.equal(app.get('progress').value, 1);
    app.get('play').click();
    assert.equal(app.get('progress').value, 1, 'pause keeps the current position');
    assert.equal(app.get('play').ariaLabel, '공정 재생');
    app.frame(1200);
    assert.equal(app.get('progress').value, 1, 'paused frames do not advance');
    app.get('play').click();
    assert.equal(app.get('progress').value, 1, 'resume preserves the paused position');
    app.frame(10000);
    assert.equal(app.get('progress').value, 1, 'pause duration is excluded');
    app.frame(10100);
    assert.equal(app.get('progress').value, 2);
    assert.equal(app.get('stage-name').textContent, stages[stage].name);
  }
});

test('initial load and every manual stage navigation start at zero', async () => {
  const app = loadApp(await readFile(new URL('../app.js', import.meta.url), 'utf8'));
  const assertZero = () => {
    assert.equal(app.get('progress').value, 0);
    assert.equal(app.get('progress-value').value, '0%');
    assert.equal(app.get('progress').style['--progress'], '0%');
  };
  assertZero();
  for (let stage = 0; stage < stages.length; stage++) {
    app.get('progress').listeners.input({ target: { value: 73 } });
    assert.equal(app.get('progress-value').value, '73%');
    app.get('stage-list').children[stage].click();
    assert.equal(app.get('stage-name').textContent, stages[stage].name);
    assertZero();
  }
  app.get('progress').listeners.input({ target: { value: 73 } });
  app.get('previous').click();
  assert.equal(app.get('stage-name').textContent, stages[6].name);
  assertZero();
  app.get('progress').listeners.input({ target: { value: 73 } });
  app.get('next').click();
  assert.equal(app.get('stage-name').textContent, stages[7].name);
  assertZero();
});

test('all eight stages update their displayed progress during playback and finish at 100%', async () => {
  const app = loadApp(await readFile(new URL('../app.js', import.meta.url), 'utf8'));
  const observed = stages.map(() => []);
  app.get('play').click();
  for (let tick = 0; tick <= 810; tick++) {
    app.frame(1000 + tick * 100);
    const stage = stages.findIndex(stage => stage.name === app.get('stage-name').textContent);
    const percent = app.get('progress').value;
    observed[stage].push(percent);
    assert.equal(app.get('progress-value').value, `${percent}%`);
    assert.equal(app.get('progress').style['--progress'], `${percent}%`);
    if (app.get('play').ariaLabel !== '공정 일시정지') break;
  }
  for (const [stage, values] of observed.entries()) {
    assert.ok(Math.min(...values) <= 1, `${stages[stage].name} starts at zero`);
    assert.ok(Math.max(...values) >= 90, `${stages[stage].name} progresses toward completion`);
  }
  assert.equal(app.get('progress-value').value, '100%');
  assert.equal(app.get('play').ariaLabel, '현재 공정 다시 재생');
});

test('switching processes during playback stops at the selected process and replay stays there', async () => {
  const app = loadApp(await readFile(new URL('../app.js', import.meta.url), 'utf8'));
  app.get('play').click();
  app.frame(1000);
  app.frame(1100);
  app.get('stage-list').children[4].click();
  assert.equal(app.get('stage-name').textContent, stages[4].name);
  assert.equal(app.get('progress').value, 0);
  assert.equal(app.get('play').ariaLabel, '공정 재생');
  app.frame(1200);
  assert.equal(app.get('progress').value, 0);
  app.get('progress').listeners.input({ target: { value: 42 } });
  app.get('play').click();
  assert.equal(app.get('stage-name').textContent, stages[4].name);
  assert.equal(app.get('progress').value, 42);
  app.frame(1300);
  app.frame(1400);
  assert.equal(app.get('progress').value, 43);

  app.get('stage-list').children[7].click();
  app.get('progress').listeners.input({ target: { value: 100 } });
  app.get('play').click();
  assert.equal(app.get('stage-name').textContent, stages[7].name);
  assert.equal(app.get('progress').value, 0);
  assert.equal(app.get('play').ariaLabel, '공정 일시정지');
  app.frame(1500);
  app.frame(1600);
  assert.equal(app.get('progress').value, 1);
});
