// Controller: wires buttons to the reconciliation pipeline with animations.

const state = {
  platform: [],
  bank: [],
  duplicates: [],
  bankDuplicates: [],
  uniquePlatform: [],
  uniqueBank: [],
  matched: [],
  unmatchedPlatform: [],
  unmatchedBank: [],
  orphanRefunds: [],
  totals: null,
  issues: [],
};

const STEP_DELAY = 120;
const MATCH_DELAY = 200;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function resetState() {
  Object.assign(state, {
    platform: [], bank: [], duplicates: [], bankDuplicates: [],
    uniquePlatform: [], uniqueBank: [],
    matched: [], unmatchedPlatform: [], unmatchedBank: [],
    orphanRefunds: [], totals: null, issues: [],
  });
}

function disableAllSteps() {
  ['btnDuplicates', 'btnMatch', 'btnOrphans', 'btnTotals', 'btnIssues']
    .forEach(id => UI.setButtonEnabled(id, false));
}

// ---- Step 1: generate demo data --------------------------------------

async function stepGenerate() {
  resetState();
  UI.clearAll();
  disableAllSteps();
  UI.logMsg('Generating demo data…', 'info');

  const { platform, bank } = generateDemoData();
  state.platform = platform.map((r, i) => ({ ...r, _index: i }));
  state.bank = bank.map((r, i) => ({ ...r, _index: i }));

  UI.logMsg(`Platform ledger: ${state.platform.length} transactions recorded in real-time.`, 'info');
  for (let i = 0; i < state.platform.length; i++) {
    UI.renderRow(UI.platformBody(), state.platform[i], 'platform');
    document.getElementById('platformCount').textContent = i + 1;
    await sleep(STEP_DELAY);
  }

  UI.logMsg(`Bank settlements: ${state.bank.length} entries arriving 1–2 days later.`, 'info');
  for (let i = 0; i < state.bank.length; i++) {
    UI.renderRow(UI.bankBody(), state.bank[i], 'bank');
    document.getElementById('bankCount').textContent = i + 1;
    await sleep(STEP_DELAY);
  }

  UI.logMsg('Data loaded. Ready to reconcile.', 'ok');
  UI.setButtonEnabled('btnDuplicates', true);
}

// ---- Step 2: duplicates ----------------------------------------------

async function stepDuplicates() {
  UI.logMsg('Scanning platform and bank for duplicate IDs…', 'info');
  await sleep(250);

  const platformResult = detectDuplicates(state.platform);
  state.uniquePlatform = platformResult.unique;
  state.duplicates = platformResult.duplicates;

  const bankResult = detectDuplicates(state.bank);
  state.uniqueBank = bankResult.unique;
  state.bankDuplicates = bankResult.duplicates;

  if (!state.duplicates.length && !state.bankDuplicates.length) {
    UI.logMsg('No duplicates detected on either side.', 'ok');
  } else {
    await highlightDuplicateGroups('platform', state.platform, state.duplicates, 'Platform');
    await highlightDuplicateGroups('bank', state.bank, state.bankDuplicates, 'Bank');
  }
  UI.setButtonEnabled('btnMatch', true);
}

async function highlightDuplicateGroups(side, allRows, duplicateRows, label) {
  const dupIds = new Set(duplicateRows.map(d => d.id));
  for (const id of dupIds) {
    const group = allRows.filter(r => r.id === id);
    const bankNote = side === 'bank' ? ' (possible reprocessing)' : '';
    UI.logMsg(
      `${label} duplicate group ${id}: ${group.length} entries — keeping first, excluding ${group.length - 1}${bankNote}.`,
      'bad'
    );
    group.forEach((r, idx) => {
      const isKept = idx === 0;
      const tag = isKept
        ? '<span class="tag warn">duplicate · kept</span>'
        : '<span class="tag bad">duplicate · excluded</span>';
      UI.setRowStatus(side, id, 'status-duplicate', tag, r._index);
      UI.flashRow(side, id, r._index);
    });
    await sleep(MATCH_DELAY);
  }
}

// ---- Step 3: match by id ---------------------------------------------

async function stepMatch() {
  UI.logMsg('Matching platform ↔ bank by transaction ID…', 'info');
  await sleep(200);

  const result = matchById(state.uniquePlatform, state.uniqueBank);
  state.matched = result.matched;
  state.unmatchedPlatform = result.unmatchedPlatform;
  state.unmatchedBank = result.unmatchedBank;

  for (const m of result.matched) {
    UI.flashRow('platform', m.platform.id, m.platform._index);
    UI.flashRow('bank', m.bank.id);
    const variance = m.delta !== 0;
    const tag = variance
      ? `<span class="tag warn">matched · Δ ${formatRupees(m.delta)}</span>`
      : '<span class="tag ok">matched</span>';
    UI.setRowStatus('platform', m.platform.id, 'status-matched', tag, m.platform._index);
    UI.setRowStatus('bank', m.bank.id, 'status-matched', tag);
    if (variance) {
      UI.logMsg(
        `Matched ${m.platform.id} with amount variance ${formatRupees(m.delta)} — likely rounding.`,
        'warn'
      );
    } else {
      UI.logMsg(`Matched ${m.platform.id} (${formatRupees(m.pAmt)}).`, 'ok');
    }
    await sleep(MATCH_DELAY);
  }

  for (const u of result.unmatchedPlatform) {
    const reason = classifyUnmatchedPlatform(u);
    UI.setRowStatus('platform', u.id, 'status-unmatched',
      `<span class="tag bad">${reason}</span>`, u._index);
    UI.logMsg(`Unmatched platform: ${u.id} — ${reason}.`, 'bad');
    await sleep(MATCH_DELAY);
  }

  for (const u of result.unmatchedBank) {
    UI.setRowStatus('bank', u.id, 'status-unmatched',
      '<span class="tag bad">no platform record</span>');
    UI.logMsg(`Unmatched bank: ${u.id} — no platform record found.`, 'bad');
    await sleep(MATCH_DELAY);
  }

  UI.logMsg(
    `Matching complete: ${result.matched.length} matched, ${result.unmatchedPlatform.length} platform-only, ${result.unmatchedBank.length} bank-only.`,
    'info'
  );
  UI.setButtonEnabled('btnOrphans', true);
}

// ---- Step 4: orphan refunds ------------------------------------------

async function stepOrphans() {
  UI.logMsg('Checking refunds against original payments…', 'info');
  await sleep(250);

  state.orphanRefunds = detectOrphanRefunds(state.uniquePlatform);

  if (!state.orphanRefunds.length) {
    UI.logMsg('All refunds reference valid original payments.', 'ok');
  } else {
    for (const r of state.orphanRefunds) {
      UI.flashRow('platform', r.id, r._index);
      UI.setRowStatus('platform', r.id, 'status-orphan',
        `<span class="tag bad">orphan (refs ${r.refOriginalId})</span>`, r._index);
      UI.logMsg(
        `Orphan refund ${r.id} references missing payment ${r.refOriginalId}.`,
        'bad'
      );
      await sleep(MATCH_DELAY);
    }
  }
  UI.setButtonEnabled('btnTotals', true);
}

// ---- Step 5: totals --------------------------------------------------

async function stepTotals() {
  UI.logMsg('Calculating totals across both datasets…', 'info');
  await sleep(250);

  state.totals = calculateTotals(state.platform, state.bank);
  UI.setTotal('platformTotal', state.totals.platformTotal);
  await sleep(250);
  UI.setTotal('bankTotal', state.totals.bankTotal);
  await sleep(250);
  UI.setTotal('diffTotal', state.totals.difference);

  UI.logMsg(`Platform total: ${formatRupees(state.totals.platformTotal)}.`, 'info');
  UI.logMsg(`Bank total: ${formatRupees(state.totals.bankTotal)}.`, 'info');
  const level = Math.abs(state.totals.difference) < 0.01 ? 'ok' : 'warn';
  UI.logMsg(`Difference: ${formatRupees(state.totals.difference)}.`, level);

  UI.setButtonEnabled('btnIssues', true);
}

// ---- Step 6: issues report -------------------------------------------

async function stepIssues() {
  UI.logMsg('Building issues report…', 'info');
  await sleep(250);

  state.issues = buildIssuesReport({
    duplicates: state.duplicates,
    bankDuplicates: state.bankDuplicates,
    matched: state.matched,
    unmatchedPlatform: state.unmatchedPlatform,
    unmatchedBank: state.unmatchedBank,
    orphanRefunds: state.orphanRefunds,
  });
  UI.showIssues(state.issues);
  UI.logMsg(`${state.issues.length} issue(s) reported.`, state.issues.length ? 'warn' : 'ok');
}

// ---- Orchestration ---------------------------------------------------

async function stepRunAll() {
  await stepGenerate();
  await sleep(300);
  await stepDuplicates();
  await sleep(300);
  await stepMatch();
  await sleep(300);
  await stepOrphans();
  await sleep(300);
  await stepTotals();
  await sleep(300);
  await stepIssues();
}

function stepReset() {
  resetState();
  UI.clearAll();
  disableAllSteps();
  UI.logMsg('Reset. Click "Generate Demo Data" to start.', 'info');
}

// ---- Wire buttons ----------------------------------------------------

document.getElementById('btnGenerate').addEventListener('click', stepGenerate);
document.getElementById('btnDuplicates').addEventListener('click', stepDuplicates);
document.getElementById('btnMatch').addEventListener('click', stepMatch);
document.getElementById('btnOrphans').addEventListener('click', stepOrphans);
document.getElementById('btnTotals').addEventListener('click', stepTotals);
document.getElementById('btnIssues').addEventListener('click', stepIssues);
document.getElementById('btnRunAll').addEventListener('click', stepRunAll);
document.getElementById('btnReset').addEventListener('click', stepReset);

UI.logMsg('Ready. Click "Generate Demo Data" to begin.', 'info');
