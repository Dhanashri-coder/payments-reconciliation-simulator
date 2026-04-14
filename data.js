// Demo data generator. Deterministic scenario with seeded issues:
//   - one duplicate in platform (P002)
//   - two transactions dated month-end that settle next month (P004, P010)
//   - two rounding differences vs. bank (P002 +0.01, P006 -0.01)
//   - one orphan refund referencing a missing payment (R002 -> P999)
//   - one bank-only record with no platform counterpart (B999)
//   - one bank-side duplicate simulating reprocessing (P007 appears twice)

function generateDemoData() {
  const platform = [
    { id: 'P001', amount: 1000.00, date: '2026-03-02', type: 'payment' },
    { id: 'P002', amount: 2500.50, date: '2026-03-05', type: 'payment' },
    { id: 'P003', amount: 750.25,  date: '2026-03-07', type: 'payment' },
    { id: 'P004', amount: 1800.00, date: '2026-03-31', type: 'payment' },
    { id: 'P005', amount: 999.99,  date: '2026-03-12', type: 'payment' },
    { id: 'P006', amount: 3000.00, date: '2026-03-14', type: 'payment' },
    { id: 'P007', amount: 450.00,  date: '2026-03-17', type: 'payment' },
    { id: 'P008', amount: 1200.00, date: '2026-03-20', type: 'payment' },
    { id: 'P009', amount: 675.00,  date: '2026-03-24', type: 'payment' },
    { id: 'P010', amount: 2100.00, date: '2026-03-31', type: 'payment' },
    { id: 'R001', amount: 500.00,  date: '2026-03-09', type: 'refund', refOriginalId: 'P003' },
    { id: 'R002', amount: 250.00,  date: '2026-03-15', type: 'refund', refOriginalId: 'P999' },
    { id: 'R003', amount: 300.00,  date: '2026-03-22', type: 'refund', refOriginalId: 'P008' },
    { id: 'P002', amount: 2500.50, date: '2026-03-05', type: 'payment' },
  ];

  const bank = [
    { id: 'P001', amount: 1000.00, date: '2026-03-04', type: 'payment' },
    { id: 'P002', amount: 2500.51, date: '2026-03-07', type: 'payment' },
    { id: 'P003', amount: 750.25,  date: '2026-03-09', type: 'payment' },
    { id: 'P005', amount: 999.99,  date: '2026-03-14', type: 'payment' },
    { id: 'P006', amount: 2999.99, date: '2026-03-16', type: 'payment' },
    { id: 'P007', amount: 450.00,  date: '2026-03-19', type: 'payment' },
    { id: 'P007', amount: 450.00,  date: '2026-03-20', type: 'payment' },
    { id: 'P008', amount: 1200.00, date: '2026-03-22', type: 'payment' },
    { id: 'P009', amount: 675.00,  date: '2026-03-26', type: 'payment' },
    { id: 'R001', amount: -500.00, date: '2026-03-11', type: 'refund' },
    { id: 'R002', amount: -250.00, date: '2026-03-17', type: 'refund' },
    { id: 'R003', amount: -300.00, date: '2026-03-24', type: 'refund' },
    { id: 'B999', amount: 500.00,  date: '2026-03-28', type: 'payment' },
  ];

  return { platform, bank };
}
