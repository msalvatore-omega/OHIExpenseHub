import { Table, TableHeader, TableRow, TableHead } from 'ohi-expense-hub';

export function HeaderRow() {
  return (
    <div style={{ padding: '16px' }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </div>
  );
}
