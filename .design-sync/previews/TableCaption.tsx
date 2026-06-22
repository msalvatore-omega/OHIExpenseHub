import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from 'ohi-expense-hub';

export function WithCaption() {
  return (
    <div style={{ padding: '16px' }}>
      <Table>
        <TableCaption>Expense summary for Q4 2024</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Travel</TableCell>
            <TableCell>$2,140.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Meals</TableCell>
            <TableCell>$720.50</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
