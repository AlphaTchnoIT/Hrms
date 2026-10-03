'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

// Read a nested value: get({ a: { b: 1 } }, 'a.b') -> 1
function get(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

// Immutable nested set: set(obj, 'a.b', 1)
function set(obj, path, value) {
  const [key, ...rest] = path.split('.');
  if (!rest.length) return { ...obj, [key]: value };
  return { ...obj, [key]: set(obj?.[key] || {}, rest.join('.'), value) };
}

// zod error -> { "field.path": "message" }
function collectErrors(result) {
  if (!result || result.success) return {};
  const errors = {};
  result.error.issues.forEach((issue) => {
    const key = issue.path.join('.');
    if (!errors[key]) errors[key] = issue.message;
  });
  return errors;
}

/*
 * Form state + validation.
 *
 *   const form = useForm({ email: '' }, { schema: loginSchema });
 *   <form onSubmit={form.handleSubmit(async (data) => api.post('/x', data))}>
 *     <Input label="Email" {...form.register('email')} />
 *     <Button type="submit" loading={form.submitting}>Save</Button>
 *   </form>
 *
 * - Errors appear when a field is left (blur) or after the first submit attempt.
 * - Errors returned by the server ({ errors: { field: msg } }) are shown on the matching fields.
 */
export function useForm(initialValues, { schema } = {}) {
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const clientErrors = useMemo(() => (schema ? collectErrors(schema.safeParse(values)) : {}), [schema, values]);

  const getError = (name) => serverErrors[name] || (submitted || touched[name] ? clientErrors[name] : undefined);

  const setField = (name, value) => {
    setValues((prev) => set(prev, name, value));
    if (serverErrors[name]) setServerErrors(({ [name]: _removed, ...rest }) => rest);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setField(name, type === 'checkbox' ? checked : value);
  };

  const markTouched = (name) => setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));

  // Spread onto <Input>, <Select>, <Textarea>, or <Checkbox type="checkbox">
  const register = (name, { type } = {}) => {
    const value = get(values, name);
    const common = { name, onChange: handleChange, onBlur: () => markTouched(name), error: getError(name) };
    if (type === 'checkbox') return { ...common, type: 'checkbox', checked: Boolean(value) };
    return { ...common, value: value ?? '' };
  };

  const handleSubmit = (onValid) => async (event) => {
    event?.preventDefault?.();
    setSubmitted(true);

    const result = schema ? schema.safeParse(values) : { success: true, data: values };
    if (!result.success) {
      toast.error('Please fix the highlighted fields');
      // Move focus to the first invalid field
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    setSubmitting(true);
    try {
      await onValid(result.data);
    } catch (err) {
      if (err.errors) {
        setServerErrors(err.errors);
        setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      }
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = (next = initialValues) => {
    setValues(next);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
  };

  const errors = { ...(submitted ? clientErrors : {}), ...serverErrors };

  return { values, setValues, setField, handleChange, register, handleSubmit, reset, submitting, errors, getError };
}
