import { DialogFooter, Button } from 'ohi-expense-hub';

export function WithActions() {
  return (
    <div style={{ maxWidth: '380px', border: '1px solid #e5e7eb', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
      <DialogFooter>
        <Button variant="outline" size="sm">Cancel</Button>
        <Button size="sm">Save Changes</Button>
      </DialogFooter>
    </div>
  );
}

export function SingleAction() {
  return (
    <div style={{ maxWidth: '380px', border: '1px solid #e5e7eb', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
      <DialogFooter>
        <Button size="sm">Submit Expense Report</Button>
      </DialogFooter>
    </div>
  );
}
