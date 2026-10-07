'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, FileText, FileX, ImageOff, Presentation } from 'lucide-react';
import api from '@/lib/api';
import { Spinner } from '@/components/ui';
import { fileSize } from './chatUtils';

/*
 * Files need the login token, so they are fetched with the API client and shown from a local blob URL.
 * Loaded photos are kept for the session, so scrolling or switching chats doesn't download them again.
 */
const blobUrls = new Map(); // fileId -> object URL

async function loadBlobUrl(fileId) {
  if (blobUrls.has(fileId)) return blobUrls.get(fileId);
  const blob = await api.get(`/chat/files/${fileId}`, { responseType: 'blob', timeout: 60000 });
  const url = URL.createObjectURL(blob);
  blobUrls.set(fileId, url);
  return url;
}

function iconFor(name = '') {
  if (/\.(xlsx?|csv)$/i.test(name)) return FileSpreadsheet;
  if (/\.pptx?$/i.test(name)) return Presentation;
  return FileText;
}

function Photo({ attachment, mine }) {
  const [url, setUrl] = useState(blobUrls.get(attachment.fileId) || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url) return undefined;
    let cancelled = false;
    loadBlobUrl(attachment.fileId)
      .then((value) => !cancelled && setUrl(value))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attachment.fileId, url]);

  if (failed) {
    return (
      <div className={clsx('flex items-center gap-2 text-xs', mine ? 'text-white/80' : 'text-slate-500')}>
        <ImageOff className="h-4 w-4" /> Photo could not be loaded
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-40 w-56 items-center justify-center rounded-lg bg-black/5">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        window.open(url, '_blank');
      }}
      className="block"
      title="Open full size"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={attachment.name} className="max-h-64 max-w-full rounded-lg object-contain" />
    </button>
  );
}

function FileCard({ attachment, mine }) {
  const [busy, setBusy] = useState(false);
  const Icon = iconFor(attachment.name);

  const download = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const blob = await api.get(`/chat/files/${attachment.fileId}`, { params: { download: 1 }, responseType: 'blob', timeout: 60000 });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = attachment.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      toast.error(err.status === 410 ? 'This file is no longer available' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={clsx('flex min-w-[220px] items-center gap-3 rounded-lg px-2.5 py-2', mine ? 'bg-white/15' : 'bg-slate-50 ring-1 ring-slate-200')}>
      <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', mine ? 'bg-white/20' : 'bg-brand-50 text-brand-600')}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className={clsx('text-[11px]', mine ? 'text-white/70' : 'text-slate-500')}>{fileSize(attachment.size)}</p>
      </div>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-label={`Download ${attachment.name}`}
        className={clsx('rounded-md p-1.5 transition', mine ? 'hover:bg-white/20' : 'text-slate-500 hover:bg-white hover:text-slate-800')}
      >
        {busy ? <Spinner className={clsx('h-4 w-4', mine && 'text-white')} /> : <Download className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function Attachment({ attachment, mine }) {
  if (attachment.removedAt) {
    return (
      <div className={clsx('flex items-center gap-2 text-xs italic', mine ? 'text-white/80' : 'text-slate-500')}>
        <FileX className="h-4 w-4 shrink-0" /> {attachment.name} is no longer available (files are kept for 90 days)
      </div>
    );
  }
  return attachment.kind === 'image' ? <Photo attachment={attachment} mine={mine} /> : <FileCard attachment={attachment} mine={mine} />;
}
