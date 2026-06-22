import { SheetFooter, Button } from 'ohi-expense-hub';

export function Default() {
  return (
    <div style={{ maxWidth: '360px', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      <SheetFooter>
        <Button variant="outline" size="sm">Discard</Button>
        <Button size="sm">Save Expense</Button>
      </SheetFooter>
    </div>
  );
}
