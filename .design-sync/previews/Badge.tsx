import { Badge } from 'ohi-expense-hub';

export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', alignItems: 'center' }}>
      <Badge variant="default">Approved</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="destructive">Rejected</Badge>
      <Badge variant="outline">Draft</Badge>
      <Badge variant="ghost">Archived</Badge>
    </div>
  );
}

export function InContext() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        <span>Q4 Travel Expenses</span>
        <Badge variant="secondary">Pending Review</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        <span>Office Supplies — Nov</span>
        <Badge variant="default">Approved</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        <span>Team Lunch Receipt</span>
        <Badge variant="destructive">Rejected</Badge>
      </div>
    </div>
  );
}
