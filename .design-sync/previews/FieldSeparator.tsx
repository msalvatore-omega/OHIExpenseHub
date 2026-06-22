import { FieldSeparator } from 'ohi-expense-hub';

export function InForm() {
  return (
    <div style={{ padding: '16px', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '14px', fontFamily: 'system-ui', fontWeight: 500 }}>Expense Details</div>
      <FieldSeparator />
      <div style={{ fontSize: '14px', fontFamily: 'system-ui', color: '#6b7280' }}>Total: $284.00</div>
      <FieldSeparator />
      <div style={{ fontSize: '14px', fontFamily: 'system-ui', fontWeight: 500 }}>Reimbursement Info</div>
    </div>
  );
}
