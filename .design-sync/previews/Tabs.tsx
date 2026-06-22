import { Tabs, TabsList, TabsTrigger, TabsContent } from 'ohi-expense-hub';

export function Default() {
  return (
    <div style={{ padding: '16px', maxWidth: '400px' }}>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px' }}>3 reports awaiting review</p>
        </TabsContent>
        <TabsContent value="approved">
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px' }}>12 reports approved this quarter</p>
        </TabsContent>
        <TabsContent value="rejected">
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px' }}>1 report returned for revision</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function LineVariant() {
  return (
    <div style={{ padding: '16px', maxWidth: '400px' }}>
      <Tabs defaultValue="all">
        <TabsList variant="line">
          <TabsTrigger value="all">All Reports</TabsTrigger>
          <TabsTrigger value="mine">My Reports</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px' }}>Showing all 47 reports</p>
        </TabsContent>
        <TabsContent value="mine">
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px' }}>8 reports submitted by you</p>
        </TabsContent>
        <TabsContent value="team">
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px' }}>39 reports from your team</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
