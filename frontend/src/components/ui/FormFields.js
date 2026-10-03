'use client';

import { useId, useState } from 'react';
import clsx from 'clsx';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { titleCase } from '@/lib/format';

/*
 * All fields accept `label`, `required`, `hint` and `error`.
 * They work great with useForm:  <Input label="Email" {...form.register('email')} />
 */
function Field({ id, label, required, hint, error, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1 text-xs font-medium text-red-600">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

function controlProps(id, error) {
  return {
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  };
}

export function Input({ label, required, hint, error, className, type = 'text', prefix, ...props }) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <Field id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">{prefix}</span>
        )}
        <input
          {...controlProps(id, error)}
          type={isPassword && showPassword ? 'text' : type}
          className={clsx('form-control', error && 'form-control-error', prefix && 'pl-8', isPassword && 'pr-10')}
          {...props}
          value={props.value ?? ''}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </Field>
  );
}

export function Textarea({ label, required, hint, error, className, rows = 3, maxLength, ...props }) {
  const id = useId();
  const length = String(props.value ?? '').length;
  return (
    <Field
      id={id}
      label={label}
      required={required}
      hint={hint || (maxLength ? `${length}/${maxLength}` : undefined)}
      error={error}
      className={className}
    >
      <textarea
        {...controlProps(id, error)}
        rows={rows}
        maxLength={maxLength}
        className={clsx('form-control resize-y', error && 'form-control-error')}
        {...props}
        value={props.value ?? ''}
      />
    </Field>
  );
}

/*
 * options can be:
 *   ['a', 'b']                         -> label is title-cased value
 *   [{ value: 'a', label: 'Apple' }]
 */
export function Select({ label, required, hint, error, className, options = [], placeholder = 'Select...', ...props }) {
  const id = useId();
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select
        {...controlProps(id, error)}
        className={clsx('form-control', error && 'form-control-error', !props.value && placeholder !== false && 'text-slate-400')}
        {...props}
        value={props.value ?? ''}
      >
        {placeholder !== false && <option value="">{placeholder}</option>}
        {options.map((option) => {
          const value = typeof option === 'object' ? option.value : option;
          const text = typeof option === 'object' ? option.label : titleCase(option);
          return (
            <option key={value} value={value} className="text-slate-800">
              {text}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function Checkbox({ label, description, className, error, ...props }) {
  return (
    <div className={className}>
      <label className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          {...props}
          checked={Boolean(props.checked)}
        />
        <span>
          <span className="font-medium">{label}</span>
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

// Section heading inside long forms
export function FormSection({ title, description, children }) {
  return (
    <div className="grid gap-6 border-b border-slate-100 py-6 first:pt-0 last:border-0 last:pb-0 lg:grid-cols-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">{children}</div>
    </div>
  );
}
