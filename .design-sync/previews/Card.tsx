import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from 'ohi-expense-hub';

export function ExpenseCard() {
  return (
    <div style={{ padding: '16px', maxWidth: '360px' }}>
      <Card>
        <CardHeader>
          <CardTitle>Q4 Travel Expenses</CardTitle>
          <CardDescription>October – December 2024</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span style={{ color: '#6b7280' }}>Total amount</span>
            <span style={{ fontWeight: 600 }}>$3,847.50</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: '#6b7280' }}>Line items</span>
            <span>12</span>
          </div>
        </CardContent>
        <CardFooter>
          <Badge variant="secondary">Pending Review</Badge>
          <Button size="sm" style={{ marginLeft: 'auto' }}>View Report</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function SmallCard() {
  return (
    <div style={{ padding: '16px', maxWidth: '300px' }}>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Office Supplies</CardTitle>
          <CardDescription>November 2024</CardDescription>
        </CardHeader>
        <CardContent>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>4 receipts · $284.20</p>
        </CardContent>
      </Card>
    </div>
  );
}
