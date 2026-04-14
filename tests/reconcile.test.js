// Unit + integration tests for reconcile.js.
// Covers happy paths, negative cases, edge cases, and boundary conditions.

// ---------------------------------------------------------------------
// signedAmount
// ---------------------------------------------------------------------
describe('signedAmount', () => {
  it('returns amount as-is for payment', () => {
    expect(signedAmount({ type: 'payment', amount: 100 })).toBe(100);
  });

  it('returns negative for positive refund amount', () => {
    expect(signedAmount({ type: 'refund', amount: 50 })).toBe(-50);
  });

  it('leaves already-negative refund unchanged', () => {
    expect(signedAmount({ type: 'refund', amount: -50 })).toBe(-50);
  });

  it('returns 0 for zero-amount payment', () => {
    expect(signedAmount({ type: 'payment', amount: 0 })).toBe(0);
  });

  it('returns 0 for zero-amount refund', () => {
    expect(signedAmount({ type: 'refund', amount: 0 })).toBe(0);
  });

  it('handles decimal amounts precisely', () => {
    expect(signedAmount({ type: 'payment', amount: 123.45 })).toBe(123.45);
    expect(signedAmount({ type: 'refund', amount: 0.01 })).toBe(-0.01);
  });

  it('returns amount as-is for unknown type (permissive)', () => {
    expect(signedAmount({ type: 'chargeback', amount: 100 })).toBe(100);
  });

  it('throws when passed null', () => {
    expect(() => signedAmount(null)).toThrow();
  });
});

// ---------------------------------------------------------------------
// formatRupees
// ---------------------------------------------------------------------
describe('formatRupees', () => {
  it('prefixes positive with ₹', () => {
    expect(formatRupees(100)).toMatch(/^₹/);
  });

  it('prefixes negative with minus sign before ₹', () => {
    expect(formatRupees(-100)).toMatch(/^-₹/);
  });

  it('formats zero as ₹0.00', () => {
    expect(formatRupees(0)).toBe('₹0.00');
  });

  it('always renders exactly 2 decimals', () => {
    expect(formatRupees(100)).toMatch(/\.\d{2}$/);
    expect(formatRupees(0.5)).toMatch(/\.\d{2}$/);
    expect(formatRupees(1234567.89)).toMatch(/\.\d{2}$/);
  });

  it('uses Indian digit grouping (lakh format)', () => {
    expect(formatRupees(100000)).toBe('₹1,00,000.00');
  });

  it('uses Indian digit grouping (crore format)', () => {
    expect(formatRupees(10000000)).toBe('₹1,00,00,000.00');
  });

  it('rounds away floating-point artefacts', () => {
    expect(formatRupees(0.1 + 0.2)).toBe('₹0.30');
  });

  it('handles very small positive fractions (rounds down to 0)', () => {
    expect(formatRupees(0.001)).toBe('₹0.00');
  });
});

// ---------------------------------------------------------------------
// detectDuplicates
// ---------------------------------------------------------------------
describe('detectDuplicates', () => {
  it('returns empty arrays for empty input', () => {
    const r = detectDuplicates([]);
    expect(r.unique).toHaveLength(0);
    expect(r.duplicates).toHaveLength(0);
  });

  it('returns no duplicates when all ids are unique', () => {
    const r = detectDuplicates([
      { id: 'A', amount: 1, type: 'payment' },
      { id: 'B', amount: 2, type: 'payment' },
    ]);
    expect(r.unique).toHaveLength(2);
    expect(r.duplicates).toHaveLength(0);
  });

  it('detects a single duplicate', () => {
    const r = detectDuplicates([
      { id: 'A', amount: 1, type: 'payment' },
      { id: 'A', amount: 1, type: 'payment' },
    ]);
    expect(r.unique).toHaveLength(1);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].id).toBe('A');
  });

  it('detects multiple duplicates of the same id', () => {
    const r = detectDuplicates([
      { id: 'X', amount: 1, type: 'payment' },
      { id: 'X', amount: 1, type: 'payment' },
      { id: 'X', amount: 1, type: 'payment' },
    ]);
    expect(r.unique).toHaveLength(1);
    expect(r.duplicates).toHaveLength(2);
  });

  it('treats ids case-sensitively (abc !== ABC)', () => {
    const r = detectDuplicates([
      { id: 'abc', amount: 1, type: 'payment' },
      { id: 'ABC', amount: 1, type: 'payment' },
    ]);
    expect(r.duplicates).toHaveLength(0);
  });

  it('flags duplicates even when amounts differ (id is the key)', () => {
    const r = detectDuplicates([
      { id: 'A', amount: 100, type: 'payment' },
      { id: 'A', amount: 999, type: 'payment' },
    ]);
    expect(r.duplicates).toHaveLength(1);
  });

  it('assigns _index based on array position when not preset', () => {
    const r = detectDuplicates([
      { id: 'A', amount: 1, type: 'payment' },
      { id: 'B', amount: 2, type: 'payment' },
    ]);
    expect(r.unique[0]._index).toBe(0);
    expect(r.unique[1]._index).toBe(1);
  });

  it('preserves pre-existing _index values', () => {
    const r = detectDuplicates([
      { id: 'X', amount: 1, type: 'payment', _index: 7 },
      { id: 'X', amount: 1, type: 'payment', _index: 9 },
    ]);
    expect(r.unique[0]._index).toBe(7);
    expect(r.duplicates[0]._index).toBe(9);
  });

  it('preserves all original row fields', () => {
    const r = detectDuplicates([
      { id: 'A', amount: 100, type: 'payment', date: '2026-01-01', extra: 'meta' },
    ]);
    expect(r.unique[0].amount).toBe(100);
    expect(r.unique[0].date).toBe('2026-01-01');
    expect(r.unique[0].extra).toBe('meta');
  });

  it('handles ids with whitespace/unicode', () => {
    const r = detectDuplicates([
      { id: 'TXN €-001', amount: 1, type: 'payment' },
      { id: 'TXN €-001', amount: 1, type: 'payment' },
    ]);
    expect(r.duplicates).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------
// matchById
// ---------------------------------------------------------------------
describe('matchById', () => {
  it('returns all-empty results for empty inputs', () => {
    const r = matchById([], []);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatchedPlatform).toHaveLength(0);
    expect(r.unmatchedBank).toHaveLength(0);
  });

  it('marks all platform records unmatched when bank is empty', () => {
    const r = matchById([{ id: 'A', amount: 1, type: 'payment' }], []);
    expect(r.unmatchedPlatform).toHaveLength(1);
    expect(r.matched).toHaveLength(0);
  });

  it('marks all bank records unmatched when platform is empty', () => {
    const r = matchById([], [{ id: 'A', amount: 1, type: 'payment' }]);
    expect(r.unmatchedBank).toHaveLength(1);
    expect(r.matched).toHaveLength(0);
  });

  it('matches an exact 1:1 pair with delta 0', () => {
    const r = matchById(
      [{ id: 'A', amount: 100, type: 'payment' }],
      [{ id: 'A', amount: 100, type: 'payment' }],
    );
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].delta).toBe(0);
  });

  it('computes positive delta when platform > bank', () => {
    const r = matchById(
      [{ id: 'A', amount: 100, type: 'payment' }],
      [{ id: 'A', amount: 99.99, type: 'payment' }],
    );
    expect(r.matched[0].delta).toBeCloseTo(0.01);
  });

  it('computes negative delta when platform < bank', () => {
    const r = matchById(
      [{ id: 'A', amount: 100, type: 'payment' }],
      [{ id: 'A', amount: 100.01, type: 'payment' }],
    );
    expect(r.matched[0].delta).toBeCloseTo(-0.01);
  });

  it('handles refund sign convention (platform positive, bank negative)', () => {
    const r = matchById(
      [{ id: 'R1', amount: 50, type: 'refund' }],
      [{ id: 'R1', amount: -50, type: 'refund' }],
    );
    expect(r.matched[0].pAmt).toBe(-50);
    expect(r.matched[0].bAmt).toBe(-50);
    expect(r.matched[0].delta).toBe(0);
  });

  it('consumes bank record only once when platform has two same ids', () => {
    const r = matchById(
      [
        { id: 'A', amount: 1, type: 'payment' },
        { id: 'A', amount: 1, type: 'payment' },
      ],
      [{ id: 'A', amount: 1, type: 'payment' }],
    );
    expect(r.matched).toHaveLength(1);
    expect(r.unmatchedPlatform).toHaveLength(1);
  });

  it('returns bank records with no platform counterpart', () => {
    const r = matchById(
      [],
      [{ id: 'UNKNOWN', amount: 500, type: 'payment' }],
    );
    expect(r.unmatchedBank).toHaveLength(1);
    expect(r.unmatchedBank[0].id).toBe('UNKNOWN');
  });

  it('avoids floating-point noise in delta', () => {
    const r = matchById(
      [{ id: 'A', amount: 0.1, type: 'payment' }],
      [{ id: 'A', amount: 0.2, type: 'payment' }],
    );
    expect(r.matched[0].delta).toBeCloseTo(-0.1);
  });
});

// ---------------------------------------------------------------------
// detectOrphanRefunds
// ---------------------------------------------------------------------
describe('detectOrphanRefunds', () => {
  it('returns empty for empty input', () => {
    expect(detectOrphanRefunds([])).toHaveLength(0);
  });

  it('returns empty when no refunds present', () => {
    const r = detectOrphanRefunds([{ id: 'P1', type: 'payment', amount: 1 }]);
    expect(r).toHaveLength(0);
  });

  it('valid refund with matching original is not orphan', () => {
    const r = detectOrphanRefunds([
      { id: 'P1', type: 'payment', amount: 100 },
      { id: 'R1', type: 'refund', amount: 50, refOriginalId: 'P1' },
    ]);
    expect(r).toHaveLength(0);
  });

  it('flags refund referencing a non-existent payment id', () => {
    const r = detectOrphanRefunds([
      { id: 'P1', type: 'payment', amount: 100 },
      { id: 'R1', type: 'refund', amount: 50, refOriginalId: 'MISSING' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('R1');
  });

  it('flags refund with undefined refOriginalId', () => {
    const r = detectOrphanRefunds([
      { id: 'R1', type: 'refund', amount: 50 },
    ]);
    expect(r).toHaveLength(1);
  });

  it('flags refund with empty-string refOriginalId', () => {
    const r = detectOrphanRefunds([
      { id: 'R1', type: 'refund', amount: 50, refOriginalId: '' },
    ]);
    expect(r).toHaveLength(1);
  });

  it('flags refund pointing to another refund (not a payment)', () => {
    const r = detectOrphanRefunds([
      { id: 'R1', type: 'refund', amount: 10, refOriginalId: 'P1' },
      { id: 'R2', type: 'refund', amount: 10, refOriginalId: 'R1' },
    ]);
    expect(r).toHaveLength(2);
  });

  it('allows multiple valid refunds for the same payment', () => {
    const r = detectOrphanRefunds([
      { id: 'P1', type: 'payment', amount: 100 },
      { id: 'R1', type: 'refund', amount: 30, refOriginalId: 'P1' },
      { id: 'R2', type: 'refund', amount: 40, refOriginalId: 'P1' },
    ]);
    expect(r).toHaveLength(0);
  });

  it('ignores refunds with refOriginalId equal to own id (self-reference)', () => {
    const r = detectOrphanRefunds([
      { id: 'R1', type: 'refund', amount: 10, refOriginalId: 'R1' },
    ]);
    expect(r).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------
// calculateTotals
// ---------------------------------------------------------------------
describe('calculateTotals', () => {
  it('returns zeros for empty arrays', () => {
    const r = calculateTotals([], []);
    expect(r.platformTotal).toBe(0);
    expect(r.bankTotal).toBe(0);
    expect(r.difference).toBe(0);
  });

  it('sums platform payments', () => {
    const r = calculateTotals(
      [{ id: 'P1', amount: 100, type: 'payment' }, { id: 'P2', amount: 200, type: 'payment' }],
      [],
    );
    expect(r.platformTotal).toBe(300);
  });

  it('subtracts platform refunds from total', () => {
    const r = calculateTotals(
      [
        { id: 'P1', amount: 100, type: 'payment' },
        { id: 'R1', amount: 30, type: 'refund', refOriginalId: 'P1' },
      ],
      [],
    );
    expect(r.platformTotal).toBe(70);
  });

  it('sums bank amounts directly (already signed)', () => {
    const r = calculateTotals(
      [],
      [
        { id: 'P1', amount: 100, type: 'payment' },
        { id: 'R1', amount: -30, type: 'refund' },
      ],
    );
    expect(r.bankTotal).toBe(70);
  });

  it('rounds to 2 decimals and suppresses float noise', () => {
    const r = calculateTotals(
      [{ id: 'P1', amount: 0.1 + 0.2, type: 'payment' }],
      [],
    );
    expect(r.platformTotal).toBe(0.3);
  });

  it('computes difference as platform minus bank', () => {
    const r = calculateTotals(
      [{ id: 'A', amount: 100, type: 'payment' }],
      [{ id: 'A', amount: 99, type: 'payment' }],
    );
    expect(r.difference).toBe(1);
  });

  it('difference is zero when both sides equal', () => {
    const r = calculateTotals(
      [{ id: 'A', amount: 100, type: 'payment' }],
      [{ id: 'A', amount: 100, type: 'payment' }],
    );
    expect(r.difference).toBe(0);
  });

  it('handles a single large-value transaction', () => {
    const r = calculateTotals(
      [{ id: 'BIG', amount: 1e9, type: 'payment' }],
      [],
    );
    expect(r.platformTotal).toBe(1e9);
  });
});

// ---------------------------------------------------------------------
// classifyUnmatchedPlatform
// ---------------------------------------------------------------------
describe('classifyUnmatchedPlatform', () => {
  it('classifies date before period end as "Missing from bank"', () => {
    expect(classifyUnmatchedPlatform({ date: '2026-03-15' })).toBe('Missing from bank');
  });

  it('classifies date on period end as "Likely settles next month"', () => {
    expect(classifyUnmatchedPlatform({ date: '2026-03-31' })).toBe('Likely settles next month');
  });

  it('classifies date after period end as "Likely settles next month"', () => {
    expect(classifyUnmatchedPlatform({ date: '2026-04-01' })).toBe('Likely settles next month');
  });

  it('works for dates far outside the window', () => {
    expect(classifyUnmatchedPlatform({ date: '2025-01-01' })).toBe('Missing from bank');
    expect(classifyUnmatchedPlatform({ date: '2099-01-01' })).toBe('Likely settles next month');
  });
});

// ---------------------------------------------------------------------
// buildIssuesReport
// ---------------------------------------------------------------------
describe('buildIssuesReport', () => {
  const empty = {
    duplicates: [], matched: [], unmatchedPlatform: [],
    unmatchedBank: [], orphanRefunds: [],
  };

  it('returns empty when all inputs are clean', () => {
    expect(buildIssuesReport(empty)).toHaveLength(0);
  });

  it('reports duplicates when present', () => {
    const r = buildIssuesReport({
      ...empty,
      duplicates: [{ id: 'X', amount: 100, type: 'payment' }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].title).toContain('Duplicate');
  });

  it('reports variance on matched records with non-zero delta', () => {
    const r = buildIssuesReport({
      ...empty,
      matched: [{ platform: { id: 'A' }, bank: { id: 'A' }, delta: 0.01 }],
    });
    expect(r).toHaveLength(1);
  });

  it('shows net only when all variances go the same direction', () => {
    const r = buildIssuesReport({
      ...empty,
      matched: [
        { platform: { id: 'A' }, bank: { id: 'A' }, delta: 0.01 },
        { platform: { id: 'B' }, bank: { id: 'B' }, delta: 0.02 },
      ],
    });
    expect(r[0].detail).toContain('0.03');
    expect(r[0].detail.includes('gross')).toBeFalsy();
  });

  it('shows both gross and net when variances offset', () => {
    const r = buildIssuesReport({
      ...empty,
      matched: [
        { platform: { id: 'A' }, bank: { id: 'A' }, delta: 0.01 },
        { platform: { id: 'B' }, bank: { id: 'B' }, delta: -0.01 },
      ],
    });
    expect(r[0].detail).toContain('gross');
    expect(r[0].detail).toContain('0.02');
    expect(r[0].detail).toContain('offsetting');
  });

  it('flags offsetting variances as an issue even when net is zero', () => {
    const r = buildIssuesReport({
      ...empty,
      matched: [
        { platform: { id: 'A' }, bank: { id: 'A' }, delta: 0.01 },
        { platform: { id: 'B' }, bank: { id: 'B' }, delta: -0.01 },
      ],
    });
    expect(r).toHaveLength(1);
  });

  it('ignores zero-delta matched records', () => {
    const r = buildIssuesReport({
      ...empty,
      matched: [{ platform: { id: 'A' }, bank: { id: 'A' }, delta: 0 }],
    });
    expect(r).toHaveLength(0);
  });

  it('reports cutoff for platform txns on/after period end', () => {
    const r = buildIssuesReport({
      ...empty,
      unmatchedPlatform: [{ id: 'P1', amount: 100, type: 'payment', date: '2026-03-31' }],
    });
    expect(r.some(i => i.title.includes('Cutoff'))).toBeTruthy();
  });

  it('reports orphan refunds when present', () => {
    const r = buildIssuesReport({
      ...empty,
      orphanRefunds: [{ id: 'R1', refOriginalId: 'X' }],
    });
    expect(r[0].title).toContain('Orphan');
  });

  it('reports bank-only records when present', () => {
    const r = buildIssuesReport({
      ...empty,
      unmatchedBank: [{ id: 'UNKNOWN', amount: 500, type: 'payment' }],
    });
    expect(r[0].title).toContain('Bank-only');
  });

  it('reports bank duplicates when present', () => {
    const r = buildIssuesReport({
      ...empty,
      bankDuplicates: [{ id: 'P007', amount: 450, type: 'payment' }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].title).toContain('bank settlements');
  });

  it('bank duplicates inflation is summed in the detail', () => {
    const r = buildIssuesReport({
      ...empty,
      bankDuplicates: [
        { id: 'A', amount: 100, type: 'payment' },
        { id: 'B', amount: 50, type: 'payment' },
      ],
    });
    expect(r[0].detail).toContain('150');
  });

  it('tolerates missing bankDuplicates field (backwards compatible)', () => {
    const r = buildIssuesReport({
      duplicates: [], matched: [], unmatchedPlatform: [],
      unmatchedBank: [], orphanRefunds: [],
    });
    expect(r).toHaveLength(0);
  });

  it('reports multiple issue categories at once', () => {
    const r = buildIssuesReport({
      duplicates: [{ id: 'X', amount: 100, type: 'payment' }],
      bankDuplicates: [{ id: 'Y', amount: 50, type: 'payment' }],
      matched: [{ platform: { id: 'A' }, bank: { id: 'A' }, delta: 0.01 }],
      unmatchedPlatform: [{ id: 'P1', amount: 100, type: 'payment', date: '2026-03-31' }],
      unmatchedBank: [{ id: 'UNKNOWN', amount: 500, type: 'payment' }],
      orphanRefunds: [{ id: 'R1', refOriginalId: 'X' }],
    });
    expect(r).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------
// Bank-side duplicate handling (symmetric with platform)
// ---------------------------------------------------------------------
describe('detectDuplicates applied to bank-side data', () => {
  it('detects duplicate bank settlement ids (e.g., reprocessing)', () => {
    const r = detectDuplicates([
      { id: 'P001', amount: 1000, type: 'payment', date: '2026-03-04' },
      { id: 'P001', amount: 1000, type: 'payment', date: '2026-03-05' },
    ]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.unique).toHaveLength(1);
  });

  it('keeps first bank occurrence, flags later ones', () => {
    const r = detectDuplicates([
      { id: 'X', amount: 100, type: 'payment', date: '2026-03-01' },
      { id: 'X', amount: 100, type: 'payment', date: '2026-03-02' },
    ]);
    expect(r.unique[0].date).toBe('2026-03-01');
    expect(r.duplicates[0].date).toBe('2026-03-02');
  });

  it('matchById on deduped bank never double-consumes a settlement', () => {
    const bankRaw = [
      { id: 'P001', amount: 100, type: 'payment' },
      { id: 'P001', amount: 100, type: 'payment' },
    ];
    const { unique } = detectDuplicates(bankRaw);
    const r = matchById([{ id: 'P001', amount: 100, type: 'payment' }], unique);
    expect(r.matched).toHaveLength(1);
    expect(r.unmatchedBank).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------
// Integration: end-to-end with the demo data generator
// ---------------------------------------------------------------------
describe('end-to-end with generateDemoData', () => {
  it('produces the expected totals, matches, and issues', () => {
    const { platform, bank } = generateDemoData();
    const platformDup = detectDuplicates(platform);
    const bankDup = detectDuplicates(bank);
    const match = matchById(platformDup.unique, bankDup.unique);
    const orphans = detectOrphanRefunds(platformDup.unique);
    const totals = calculateTotals(platform, bank);
    const issues = buildIssuesReport({
      duplicates: platformDup.duplicates,
      bankDuplicates: bankDup.duplicates,
      matched: match.matched,
      unmatchedPlatform: match.unmatchedPlatform,
      unmatchedBank: match.unmatchedBank,
      orphanRefunds: orphans,
    });

    expect(platformDup.duplicates).toHaveLength(1);
    expect(bankDup.duplicates).toHaveLength(1);
    expect(orphans).toHaveLength(1);
    expect(match.unmatchedBank).toHaveLength(1);
    expect(match.unmatchedPlatform).toHaveLength(2);
    expect(totals.platformTotal).toBeCloseTo(15926.24);
    expect(totals.bankTotal).toBeCloseTo(10475.74);
    expect(totals.difference).toBeCloseTo(5450.50);
    expect(issues.length > 0).toBeTruthy();
  });

  it('is idempotent: running twice yields identical results', () => {
    const run = () => {
      const { platform, bank } = generateDemoData();
      const { unique } = detectDuplicates(platform);
      return {
        totals: calculateTotals(platform, bank),
        matchCount: matchById(unique, bank).matched.length,
      };
    };
    const a = run();
    const b = run();
    expect(a.totals.difference).toBe(b.totals.difference);
    expect(a.matchCount).toBe(b.matchCount);
  });
});
