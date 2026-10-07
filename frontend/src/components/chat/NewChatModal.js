'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button, Input, Modal, Tabs } from '@/components/ui';
import PeoplePicker from './PeoplePicker';

// Start a 1-to-1 chat or create a group. onOpened(conversation) gets the chat to show.
export default function NewChatModal({ open, onClose, onOpened, meId }) {
  const [tab, setTab] = useState('person');
  const [name, setName] = useState('');
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('person');
    setName('');
    setPeople([]);
    setError('');
  }, [open]);

  const openDirect = async (person) => {
    setBusy(true);
    try {
      const res = await api.post('/chat/conversations/direct', { userId: person._id });
      onOpened(res.data);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (!name.trim()) return setError('Group name is required');
    if (!people.length) return setError('Add at least one person');
    setBusy(true);
    try {
      const res = await api.post('/chat/conversations/group', { name: name.trim(), userIds: people.map((p) => p._id) });
      toast.success(res.message);
      onOpened(res.data);
      onClose();
    } catch (err) {
      setError(err.errors?.name || err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New chat"
      footer={
        tab === 'group' && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={createGroup} loading={busy}>
              Create group
            </Button>
          </>
        )
      }
    >
      <Tabs
        tabs={[
          { value: 'person', label: 'Person' },
          { value: 'group', label: 'Group' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === 'person' ? (
          <PeoplePicker onPick={openDirect} excludeIds={[meId]} />
        ) : (
          <div className="space-y-4">
            <Input label="Group name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support team" />
            <div>
              <p className="form-label">People</p>
              <PeoplePicker selected={people} onChange={setPeople} excludeIds={[meId]} autoFocus={false} />
            </div>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
