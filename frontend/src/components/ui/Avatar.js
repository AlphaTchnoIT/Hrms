import clsx from 'clsx';
import { getInitials } from '@/lib/format';

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl', xl: 'h-24 w-24 text-3xl' };
const BACKGROUNDS = ['bg-brand-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-rose-500', 'bg-violet-500'];

export default function Avatar({ name = '', src, size = 'md', className }) {
  // Same name always gets the same colour
  const colorIndex = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % BACKGROUNDS.length;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={clsx('rounded-full object-cover', SIZES[size], className)} />;
  }

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        BACKGROUNDS[colorIndex],
        SIZES[size],
        className
      )}
    >
      {getInitials(name) || '?'}
    </div>
  );
}
