import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TableFooter, Badge } from 'ohi-expense-hub';

export function ExpenseTable() {
  const rows = [
    { date: 'Dec 12, 2024', description: 'Client dinner — Cosi', category: 'Meals', amount: '$284.00', status: 'Approved' },
    { date: 'Dec 10, 2024', description: 'Flight SEA → NYC', category: 'Travel', amount: '$487.50', status: 'Pending' },
    { date: 'Dec 08, 2024', description: 'Hotel — 2 nights', category: 'Lodging', amount: '$412.00', status: 'Approved' },
    { date: 'Dec 05, 2024', description: 'Rideshare — airport', category: 'Transport', amount: '$34.20', status: 'Approved' },
  ];
  return (
    <div style={{ padding: '16px' }}>
      <Table>
        <TableCaption>Q4 2024 Expense Report — Mike Salvatore</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.description}</TableCell>
              <TableCell>{r.category}</TableCell>
              <TableCell style={{ fontVariantNumeric: 'tabular-nums' }}>{r.amount}</TableCell>
              <TableCell>
                <Badge variant={r.status === 'Approved' ? 'default' : 'secondary'}>{r.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} style={{ fontWeight: 600 }}>Total</TableCell>
            <TableCell style={{ fontWeight: 600 }}>$1,217.70</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
