import { Button } from 'ohi-expense-hub';

export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', alignItems: 'center' }}>
      <Button variant="default">Submit Expense</Button>
      <Button variant="secondary">Save Draft</Button>
      <Button variant="outline">Cancel</Button>
      <Button variant="ghost">Learn More</Button>
      <Button variant="destructive">Delete Report</Button>
      <Button variant="link">View Details</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', alignItems: 'center' }}>
      <Button size="lg">Large</Button>
      <Button size="default">Default</Button>
      <Button size="sm">Small</Button>
      <Button size="xs">Extra Small</Button>
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', alignItems: 'center' }}>
      <Button>Active</Button>
      <Button disabled>Disabled</Button>
      <Button variant="outline" disabled>Disabled Outline</Button>
    </div>
  );
}
