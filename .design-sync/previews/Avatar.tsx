import { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount } from 'ohi-expense-hub';

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '16px', alignItems: 'center' }}>
      <Avatar size="lg">
        <AvatarFallback>MS</AvatarFallback>
      </Avatar>
      <Avatar size="default">
        <AvatarFallback>JS</AvatarFallback>
      </Avatar>
      <Avatar size="sm">
        <AvatarFallback>KL</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function Group() {
  return (
    <div style={{ padding: '16px' }}>
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>MS</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>JS</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>KL</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+4</AvatarGroupCount>
      </AvatarGroup>
    </div>
  );
}
