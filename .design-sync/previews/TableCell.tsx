import { Table, TableBody, TableRow, TableCell, Badge } from 'ohi-expense-hub';

export function DataRows() {
  return (
    <div style={{ padding: '16px' }}>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Flight SEA → NYC</TableCell>
            <TableCell>$487.50</TableCell>
            <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Client dinner</TableCell>
            <TableCell>$284.00</TableCell>
            <TableCell><Badge variant="default">Approved</Badge></TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Hotel — 2 nights</TableCell>
            <TableCell>$412.00</TableCell>
            <TableCell><Badge variant="default">Approved</Badge></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
