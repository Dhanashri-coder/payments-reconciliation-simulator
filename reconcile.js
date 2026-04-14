// Pure reconciliation logic. No DOM dependencies.

const PERIOD_END = '2026-03-31';

function signedAmount(row) {
  if (row.type === 'refund' && row.amount > 0) return -row.amount;
  return row.amount;
}

function formatRupees(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function detectDuplicates(txns) {
  const seen = new Map();
  const duplicates = [];
  const unique = [];
  txns.forEach((row, idx) => {
    const tagged = { ...row, _index: row._index ?? idx };
    if (seen.has(row.id)) {
      duplicates.push(tagged);
    } else {
      seen.set(row.id, row);
      unique.push(tagged);
    }
  });
  return { unique, duplicates };
}

function matchById(platformUnique, bank) {
  const bankMap = new Map(bank.map(r => [r.id, r]));
  const consumed = new Set();
  const matched = [];
  const unmatchedPlatform = [];

  for (const p of platformUnique) {
    const b = bankMap.get(p.id);
    if (b && !consumed.has(p.id)) {
      const pAmt = signedAmount(p);
      const delta = +(pAmt - b.amount).toFixed(2);
      matched.push({ platform: p, bank: b, pAmt, bAmt: b.amount, delta });
      consumed.add(p.id);
    } else {
      unmatchedPlatform.push(p);
    }
  }

  const unmatchedBank = bank.filter(r => !consumed.has(r.id));
  return { matched, unmatchedPlatform, unmatchedBank };
}

function detectOrphanRefunds(platformUnique) {
  const paymentIds = new Set(
    platformUnique.filter(r => r.type === 'payment').map(r => r.id)
  );
  return platformUnique.filter(
    r => r.type === 'refund' && !paymentIds.has(r.refOriginalId)
  );
}

function calculateTotals(platform, bank) {
  const platformTotal = platform.reduce((s, r) => s + signedAmount(r), 0);
  const bankTotal = bank.reduce((s, r) => s + r.amount, 0);
  return {
    platformTotal: +platformTotal.toFixed(2),
    bankTotal: +bankTotal.toFixed(2),
    difference: +(platformTotal - bankTotal).toFixed(2),
  };
}

function classifyUnmatchedPlatform(row) {
  if (row.date >= PERIOD_END) return 'Likely settles next month';
  return 'Missing from bank';
}

function buildIssuesReport({ duplicates, bankDuplicates, matched, unmatchedPlatform, unmatchedBank, orphanRefunds }) {
  const issues = [];
  bankDuplicates = bankDuplicates || [];

  if (duplicates.length) {
    const inflated = duplicates.reduce((s, r) => s + signedAmount(r), 0);
    issues.push({
      title: 'Duplicate records in platform',
      detail: `${duplicates.length} duplicate(s) — inflates platform total by ${formatRupees(inflated)}.`,
    });
  }

  if (bankDuplicates.length) {
    const inflated = bankDuplicates.reduce((s, r) => s + r.amount, 0);
    issues.push({
      title: 'Duplicate records in bank settlements',
      detail: `${bankDuplicates.length} duplicate(s) — inflates bank total by ${formatRupees(inflated)} (possible reprocessing).`,
    });
  }

  const variances = matched.filter(m => m.delta !== 0);
  if (variances.length) {
    const netDelta = variances.reduce((s, m) => s + m.delta, 0);
    const grossDelta = variances.reduce((s, m) => s + Math.abs(m.delta), 0);
    const offsetting = Math.abs(grossDelta - Math.abs(netDelta)) > 0.001;
    const detail = offsetting
      ? `${variances.length} record(s) differ — gross ${formatRupees(grossDelta)}, net ${formatRupees(netDelta)} (offsetting variances) — likely rounding or fee variance.`
      : `${variances.length} record(s) differ from bank by ${formatRupees(netDelta)} — likely rounding or fee variance.`;
    issues.push({
      title: 'Amount variance on matched records',
      detail,
    });
  }

  const cutoff = unmatchedPlatform.filter(r => r.date >= PERIOD_END);
  if (cutoff.length) {
    const total = cutoff.reduce((s, r) => s + signedAmount(r), 0);
    issues.push({
      title: 'Cutoff / next-month settlement',
      detail: `${cutoff.length} platform txn(s) dated on/after ${PERIOD_END} not yet in bank (${formatRupees(total)}).`,
    });
  }

  if (orphanRefunds.length) {
    issues.push({
      title: 'Orphan refunds',
      detail: `${orphanRefunds.length} refund(s) reference an original payment that does not exist in the platform ledger.`,
    });
  }

  if (unmatchedBank.length) {
    issues.push({
      title: 'Bank-only records',
      detail: `${unmatchedBank.length} bank record(s) have no platform counterpart.`,
    });
  }

  return issues;
}
