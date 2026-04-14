// Minimal browser test runner. Provides describe/it/expect globals
// and renders pass/fail results into the test page.

const TestRunner = {
  suites: [],
  current: null,
  results: { passed: 0, failed: 0 },

  describe(name, fn) {
    this.current = { name, tests: [] };
    this.suites.push(this.current);
    fn();
    this.current = null;
  },

  it(name, fn) {
    if (!this.current) throw new Error('it() called outside describe()');
    this.current.tests.push({ name, fn });
  },

  run() {
    const root = document.getElementById('testResults');
    root.innerHTML = '';
    this.results = { passed: 0, failed: 0 };

    for (const suite of this.suites) {
      const suiteEl = document.createElement('div');
      suiteEl.className = 'suite';
      const header = document.createElement('h3');
      header.textContent = suite.name;
      suiteEl.appendChild(header);

      const list = document.createElement('ul');
      let suitePassed = 0;
      let suiteFailed = 0;

      for (const test of suite.tests) {
        const li = document.createElement('li');
        try {
          test.fn();
          li.className = 'pass';
          li.textContent = `PASS — ${test.name}`;
          this.results.passed++;
          suitePassed++;
        } catch (e) {
          li.className = 'fail';
          const title = document.createElement('div');
          title.textContent = `FAIL — ${test.name}`;
          const pre = document.createElement('pre');
          pre.textContent = e.message + (e.stack ? '\n\n' + e.stack.split('\n').slice(1, 4).join('\n') : '');
          li.appendChild(title);
          li.appendChild(pre);
          this.results.failed++;
          suiteFailed++;
        }
        list.appendChild(li);
      }

      const summary = document.createElement('div');
      summary.className = 'suite-summary';
      summary.textContent = `${suitePassed} passed, ${suiteFailed} failed`;
      suiteEl.appendChild(summary);
      suiteEl.appendChild(list);
      root.appendChild(suiteEl);
    }

    this.renderSummary();
  },

  renderSummary() {
    const summary = document.getElementById('testSummary');
    const total = this.results.passed + this.results.failed;
    const allPass = this.results.failed === 0;
    summary.className = 'summary ' + (allPass ? 'pass' : 'fail');
    summary.textContent = `${this.results.passed} / ${total} tests passed · ${this.results.failed} failed`;
  },
};

function expect(actual) {
  const fmt = v => {
    try { return JSON.stringify(v); } catch { return String(v); }
  };
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${fmt(expected)}, got ${fmt(actual)}`);
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${fmt(expected)}, got ${fmt(actual)}`);
      }
    },
    toBeCloseTo(expected, decimals = 2) {
      const factor = Math.pow(10, decimals);
      if (Math.round(actual * factor) !== Math.round(expected * factor)) {
        throw new Error(`Expected ~${expected} (±${1 / factor}), got ${actual}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${fmt(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${fmt(actual)}`);
    },
    toHaveLength(n) {
      if (actual == null) throw new Error(`Expected length ${n}, got ${fmt(actual)}`);
      if (actual.length !== n) throw new Error(`Expected length ${n}, got ${actual.length}`);
    },
    toContain(item) {
      if (actual == null || typeof actual.includes !== 'function') {
        throw new Error(`Expected value to be searchable, got ${fmt(actual)}`);
      }
      if (!actual.includes(item)) throw new Error(`Expected to contain ${fmt(item)}`);
    },
    toThrow() {
      if (typeof actual !== 'function') throw new Error('toThrow requires a function');
      let threw = false;
      try { actual(); } catch { threw = true; }
      if (!threw) throw new Error('Expected function to throw');
    },
    toMatch(regex) {
      if (!regex.test(actual)) throw new Error(`Expected ${fmt(actual)} to match ${regex}`);
    },
  };
}

const describe = (name, fn) => TestRunner.describe(name, fn);
const it = (name, fn) => TestRunner.it(name, fn);
