'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';

// New folder / rename folder. onSave(name) returns a promise; a thrown error is shown under the field.
export default function FolderNameModal({
  open,
  initialName = '',
  description = 'Only you see your folders. Move chats into it from a chat’s ⋯ menu.',
  onClose,
  onSave,
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const renaming = Boolean(initialName);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError('');
  }, [open, initialName]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }
    setBusy(true);
    try {
      await onSave(name.trim());
      onClose();
    } catch (err) {
      setError(err.errors?.name || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={renaming ? 'Rename folder' : 'New folder'}
      description={renaming ? undefined : description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="folder-form" loading={busy}>
            {renaming ? 'Save' : 'Create folder'}
          </Button>
        </>
      }
    >
      <form id="folder-form" method="post" onSubmit={submit} noValidate>
        <Input label="Folder name" required autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales team" error={error} />
      </form>
    </Modal>
  );
}
