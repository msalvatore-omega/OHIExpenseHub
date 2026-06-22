import { Checkbox } from 'ohi-expense-hub';

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Checkbox id="unchecked" />
        <label htmlFor="unchecked" style={{ fontSize: '14px', cursor: 'pointer' }}>Include receipts</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Checkbox id="checked" defaultChecked />
        <label htmlFor="checked" style={{ fontSize: '14px', cursor: 'pointer' }}>Billable to client</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Checkbox id="disabled" disabled />
        <label htmlFor="disabled" style={{ fontSize: '14px', color: '#9ca3af', cursor: 'not-allowed' }}>Reimbursable (locked)</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Checkbox id="disabled-checked" disabled defaultChecked />
        <label htmlFor="disabled-checked" style={{ fontSize: '14px', color: '#9ca3af', cursor: 'not-allowed' }}>Pre-approved</label>
      </div>
    </div>
  );
}
