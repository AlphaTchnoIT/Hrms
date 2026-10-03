'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

const ConfirmContext = createContext(null);

/*
 * Promise based confirmation dialog (replaces window.confirm).
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete holiday?', message: '...', danger: true })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setOptions(typeof opts === 'string' ? { title: opts } : opts);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    setOptions(null);
  };

  const danger = options?.danger;
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(options)}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
              <Icon className="h-5 w-5" />
            </span>
            {options?.title}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {options?.cancelText || 'Cancel'}
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {options?.confirmText || 'Confirm'}
            </Button>
          </>
        }
      >
        {options?.message && <p className="text-sm leading-relaxed text-slate-600">{options.message}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
