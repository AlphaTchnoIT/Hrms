import clsx from 'clsx';
import { Avatar } from '@/components/ui';
import { PRESENCE } from '@/lib/workStatus';

// Avatar with a small available / busy / away / offline dot
export default function PresenceAvatar({ name, src, size = 'sm', presence = 'offline', className }) {
  const meta = PRESENCE[presence] || PRESENCE.offline;
  return (
    <span className={clsx('relative inline-flex shrink-0', className)} title={meta.label}>
      <Avatar name={name} src={src} size={size} />
      <span className={clsx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white', meta.dot)} />
    </span>
  );
}
