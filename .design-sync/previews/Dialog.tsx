import { DialogHeader, DialogFooter, Button } from 'ohi-expense-hub';

export function ConfirmDelete() {
  return (
    <div style={{ padding: '16px', maxWidth: '380px', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#fff' }}>
      <DialogHeader>
        <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'system-ui', lineHeight: 1.2 }}>Delete Expense Report?</div>
        <div style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'system-ui', lineHeight: 1.5 }}>
          This will permanently delete &ldquo;Q4 Travel Expenses&rdquo; and all 12 line items. This action cannot be undone.
        </div>
      </DialogHeader>
      <DialogFooter style={{ marginTop: '16px' }}>
        <Button variant="outline" size="sm">Cancel</Button>
        <Button variant="destructive" size="sm">Delete Report</Button>
      </DialogFooter>
    </div>
  );
}

export function SubmitReport() {
  return (
    <div style={{ padding: '16px', maxWidth: '380px', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#fff' }}>
      <DialogHeader>
        <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'system-ui', lineHeight: 1.2 }}>Submit for Approval</div>
        <div style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'system-ui', lineHeight: 1.5 }}>
          Send Q4 Travel Expenses ($3,847.50) to your manager Sarah Johnson for review.
        </div>
      </DialogHeader>
      <DialogFooter style={{ marginTop: '16px' }}>
        <Button variant="outline" size="sm">Cancel</Button>
        <Button size="sm">Submit Report</Button>
      </DialogFooter>
    </div>
  );
}
