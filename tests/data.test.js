// Tests that the demo data generator produces the scenarios the app depends on.
// These guard against silent drift in data.js.

describe('generateDemoData — shape', () => {
  it('returns platform and bank as arrays', () => {
    const d = generateDemoData();
    expect(Array.isArray(d.platform)).toBeTruthy();
    expect(Array.isArray(d.bank)).toBeTruthy();
  });

  it('every record has id, amount, date, type', () => {
    const { platform, bank } = generateDemoData();
    for (const r of [...platform, ...bank]) {
      expect(typeof r.id === 'string' && r.id.length > 0).toBeTruthy();
      expect(typeof r.amount === 'number' && !isNaN(r.amount)).toBeTruthy();
      expect(typeof r.date === 'string').toBeTruthy();
      expect(r.type === 'payment' || r.type === 'refund').toBeTruthy();
    }
  });

  it('dates use YYYY-MM-DD format', () => {
    const { platform, bank } = generateDemoData();
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of [...platform, ...bank]) {
      expect(iso.test(r.date)).toBeTruthy();
    }
  });

  it('platform refunds carry a refOriginalId field', () => {
    const { platform } = generateDemoData();
    const refunds = platform.filter(r => r.type === 'refund');
    expect(refunds.length > 0).toBeTruthy();
    for (const r of refunds) {
      expect('refOriginalId' in r).toBeTruthy();
    }
  });
});

describe('generateDemoData — seeded scenarios', () => {
  it('includes at least one duplicate id in platform', () => {
    const { platform } = generateDemoData();
    const ids = platform.map(r => r.id);
    expect(ids.length > new Set(ids).size).toBeTruthy();
  });

  it('includes at least one transaction dated on or after period end', () => {
    const { platform } = generateDemoData();
    expect(platform.some(r => r.date >= '2026-03-31')).toBeTruthy();
  });

  it('includes at least one orphan refund (refOriginalId not in payments)', () => {
    const { platform } = generateDemoData();
    const paymentIds = new Set(platform.filter(r => r.type === 'payment').map(r => r.id));
    const orphans = platform.filter(
      r => r.type === 'refund' && !paymentIds.has(r.refOriginalId)
    );
    expect(orphans.length > 0).toBeTruthy();
  });

  it('includes at least one rounding difference between platform and bank', () => {
    const { platform, bank } = generateDemoData();
    const bankMap = new Map(bank.map(r => [r.id, r]));
    const hasRounding = platform.some(p => {
      const b = bankMap.get(p.id);
      if (!b || p.type !== 'payment') return false;
      const delta = Math.abs(p.amount - b.amount);
      return delta > 0 && delta < 0.1;
    });
    expect(hasRounding).toBeTruthy();
  });

  it('includes at least one duplicate id in bank (reprocessing scenario)', () => {
    const { bank } = generateDemoData();
    const ids = bank.map(r => r.id);
    expect(ids.length > new Set(ids).size).toBeTruthy();
  });

  it('includes at least one bank-only record with no platform match', () => {
    const { platform, bank } = generateDemoData();
    const platformIds = new Set(platform.map(r => r.id));
    const bankOnly = bank.filter(r => !platformIds.has(r.id));
    expect(bankOnly.length > 0).toBeTruthy();
  });

  it('bank refunds are stored as negative amounts', () => {
    const { bank } = generateDemoData();
    const bankRefunds = bank.filter(r => r.type === 'refund');
    for (const r of bankRefunds) {
      expect(r.amount < 0).toBeTruthy();
    }
  });

  it('platform refunds are stored as positive amounts (sign applied at calc time)', () => {
    const { platform } = generateDemoData();
    const platformRefunds = platform.filter(r => r.type === 'refund');
    for (const r of platformRefunds) {
      expect(r.amount > 0).toBeTruthy();
    }
  });
});
