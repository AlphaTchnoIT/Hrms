'use client';

import clsx from 'clsx';
import { CheckCheck, CircleAlert, CornerUpLeft, Pencil, Siren, Trash2 } from 'lucide-react';
import { formatTime, getFullName } from '@/lib/format';
import { Avatar } from '@/components/ui';
import Attachment from './Attachment';
import { CHAT_REACTIONS, fullNameOf, groupReactions, messagePreview, sameId, splitLinks } from './chatUtils';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Plain text with "@Full Name" of the tagged people highlighted (never rendered as HTML)
function WithMentions({ text, names, mine, meName }) {
  if (!names.length) return text;
  const pattern = new RegExp(`(@(?:${names.map(escapeRegex).join('|')}))`, 'g');
  return text.split(pattern).map((part, i) => {
    if (i % 2 === 0) return part;
    const isMe = part.slice(1) === meName;
    return (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i} className={clsx('rounded px-0.5 font-semibold', mine ? 'bg-white/20' : isMe ? 'bg-amber-100 text-amber-800' : 'text-brand-700')}>
        {part}
      </span>
    );
  });
}

function MessageText({ text, mine, mentionNames = [], meName }) {
  return splitLinks(text).map((part, i) =>
    part.isLink ? (
      <a
        // eslint-disable-next-line react/no-array-index-key
        key={i}
        href={part.text}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx('underline underline-offset-2', mine ? 'text-white' : 'text-brand-700')}
      >
        {part.text}
      </a>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>
        <WithMentions text={part.text} names={mentionNames} mine={mine} meName={meName} />
      </span>
    )
  );
}

const PRIORITY_STYLE = {
  important: { label: 'IMPORTANT!', icon: CircleAlert, className: 'text-red-600', ring: 'ring-2 ring-red-300' },
  urgent: { label: 'URGENT!', icon: Siren, className: 'text-red-600', ring: 'ring-2 ring-red-500' },
};

/*
 * Reactions + reply / edit / delete. Shown on hover, when the message or a button in the bar has
 * keyboard focus (Tab), or after tapping the message (mobile). It floats on the message's top corner.
 */
function ActionBar({ mine, onReact, onReply, onEdit, onDelete, onSeenBy }) {
  const iconButton = 'rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400';
  return (
    <div
      role="toolbar"
      aria-label="Message actions"
      className={clsx('absolute -top-7 z-10 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5 shadow-pop', mine ? 'right-2' : 'left-2')}
    >
      {CHAT_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          aria-label={`React ${emoji}`}
          className="rounded-md px-1 py-0.5 text-sm transition hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {emoji}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-slate-200" />
      <button onClick={onReply} aria-label="Reply" title="Reply" className={iconButton}>
        <CornerUpLeft className="h-4 w-4" />
      </button>
      {onSeenBy && (
        <button onClick={onSeenBy} aria-label="Seen by" title="Seen by" className={iconButton}>
          <CheckCheck className="h-4 w-4" />
        </button>
      )}
      {mine && (
        <>
          <button onClick={onEdit} aria-label="Edit" title="Edit" className={iconButton}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete"
            title="Delete"
            className="rounded-md p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

export default function MessageItem({
  message,
  meId,
  members,
  isGroup,
  continued,
  seenLabel,
  showActions,
  highlighted,
  onToggleActions,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onJumpTo,
  onSeenBy,
}) {
  const mine = sameId(message.sender, meId);
  const deleted = Boolean(message.deletedAt);
  const reactions = groupReactions(message.reactions, meId, members);
  const quote = message.replyTo;
  const priority = !deleted && PRIORITY_STYLE[message.priority];
  const mentionNames = (message.mentions || []).map((id) => fullNameOf(members.find((m) => sameId(m, id)))).filter(Boolean);
  const meName = fullNameOf(members.find((m) => sameId(m, meId)));
  const mentionsMe = !mine && (message.mentions || []).some((id) => sameId(id, meId));

  return (
    <div id={`msg-${message._id}`} className={clsx('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', continued ? 'mt-0.5' : 'mt-3')}>
      {!mine && isGroup && <div className="w-8 shrink-0">{!continued && <Avatar name={getFullName(message.sender)} src={message.sender?.avatar} size="sm" />}</div>}

      <div className={clsx('flex max-w-[78%] flex-col sm:max-w-[65%]', mine ? 'items-end' : 'items-start')}>
        {!mine && isGroup && !continued && <span className="mb-0.5 px-1 text-xs font-medium text-slate-600">{getFullName(message.sender)}</span>}

        <div className="group/msg relative">
          <div
            onClick={onToggleActions}
            // Focusable so keyboard users can reach the actions: Tab to the message, then Tab into the bar
            tabIndex={deleted ? undefined : 0}
            title={deleted ? undefined : 'Enter: show reply, react, edit and delete'}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onToggleActions();
              }
            }}
            className={clsx(
              'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
              deleted && 'border border-dashed border-slate-300 bg-transparent italic text-slate-400',
              !deleted && (mine ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 shadow-card'),
              priority?.ring,
              mentionsMe && !priority && 'ring-2 ring-amber-300',
              highlighted && 'ring-4 ring-amber-300'
            )}
          >
            {priority && (
              <span className={clsx('mb-1 flex items-center gap-1 text-[11px] font-bold tracking-wide', mine ? 'text-white' : priority.className)}>
                <priority.icon className="h-3.5 w-3.5" /> {priority.label}
              </span>
            )}
            {quote && !deleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpTo(quote._id);
                }}
                className={clsx(
                  'mb-1.5 block w-full rounded-lg border-l-4 px-2.5 py-1.5 text-left text-xs',
                  mine ? 'border-white/60 bg-white/15 text-white/90' : 'border-brand-400 bg-slate-50 text-slate-600'
                )}
              >
                <span className="block font-semibold">{getFullName(quote.sender)}</span>
                <span className="line-clamp-2">{quote.deletedAt ? <i>This message was deleted</i> : messagePreview(quote)}</span>
              </button>
            )}
            {!deleted && message.attachment && (
              <div className={clsx(message.text && 'mb-1.5')}>
                <Attachment attachment={message.attachment} mine={mine} />
              </div>
            )}
            {deleted ? 'This message was deleted' : <MessageText text={message.text} mine={mine} mentionNames={mentionNames} meName={meName} />}
          </div>
          {/* After the message in the page order, so Tab goes message -> its actions */}
          {!deleted && (
            <div className={clsx(showActions ? 'block' : 'hidden', 'group-focus-within/msg:block group-hover/msg:block')}>
              <ActionBar mine={mine} onReact={onReact} onReply={onReply} onEdit={onEdit} onDelete={onDelete} onSeenBy={mine && isGroup ? onSeenBy : null} />
            </div>
          )}
        </div>

        {reactions.length > 0 && (
          <div className={clsx('-mt-1.5 flex flex-wrap gap-1 px-1', mine ? 'justify-end' : 'justify-start')}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(r.emoji)}
                title={r.names.join(', ')}
                className={clsx(
                  'relative flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow-sm',
                  r.mine ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'
                )}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="font-medium">{r.count}</span>}
              </button>
            ))}
          </div>
        )}

        <span className="mt-0.5 px-1 text-[10px] text-slate-400">
          {formatTime(message.createdAt)}
          {message.editedAt && !deleted && ' · edited'}
          {seenLabel &&
            (isGroup ? (
              <>
                {' · '}
                <button onClick={onSeenBy} className="underline-offset-2 hover:text-slate-600 hover:underline">
                  {seenLabel}
                </button>
              </>
            ) : (
              ` · ${seenLabel}`
            ))}
        </span>
      </div>
    </div>
  );
}
