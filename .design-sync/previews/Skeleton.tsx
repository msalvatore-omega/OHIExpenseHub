import { Skeleton } from 'ohi-expense-hub';

export function CardLoading() {
  return (
    <div style={{ padding: '16px', maxWidth: '360px', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Skeleton style={{ height: '20px', width: '60%' }} />
        <Skeleton style={{ height: '14px', width: '40%' }} />
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton style={{ height: '14px', width: '100%' }} />
          <Skeleton style={{ height: '14px', width: '80%' }} />
          <Skeleton style={{ height: '14px', width: '90%' }} />
        </div>
      </div>
    </div>
  );
}

export function TableRowLoading() {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '480px' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Skeleton style={{ height: '14px', width: '100px' }} />
          <Skeleton style={{ height: '14px', width: '160px' }} />
          <Skeleton style={{ height: '14px', width: '80px', marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
}
