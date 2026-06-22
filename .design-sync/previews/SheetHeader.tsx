import { SheetHeader } from 'ohi-expense-hub';

export function Default() {
  return (
    <div style={{ maxWidth: '360px', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      <SheetHeader>
        <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'system-ui' }}>Add Expense</div>
        <div style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'system-ui' }}>Attach a receipt and fill in the details.</div>
      </SheetHeader>
    </div>
  );
}
