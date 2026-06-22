import { Input } from 'ohi-expense-hub';

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', maxWidth: '320px' }}>
      <Input placeholder="Enter amount (e.g. 149.99)" type="number" />
      <Input placeholder="Description" defaultValue="Team lunch — client meeting" />
      <Input placeholder="Disabled field" disabled />
      <Input placeholder="Required" required aria-invalid="true" />
    </div>
  );
}

export function Types() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', maxWidth: '320px' }}>
      <Input type="text" placeholder="Merchant name" />
      <Input type="email" placeholder="approver@omega.com" />
      <Input type="date" />
      <Input type="file" />
    </div>
  );
}
