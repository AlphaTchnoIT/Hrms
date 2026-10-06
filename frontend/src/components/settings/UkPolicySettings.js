'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { MONTHS } from '@/lib/format';
import { Button, Card, FormSection, Input, Select } from '@/components/ui';

const NUMBER_FIELDS = [
  ['Leave & attendance', 'How far back / ahead staff can request, and the regularisation window.', [
    ['leaveBackdateDays', 'Leave: days in the past allowed'],
    ['leaveAdvanceDays', 'Leave: days ahead allowed'],
    ['regularisationWindowDays', 'Regularisation window (days)'],
    ['fitNoteAfterDays', 'Fit note needed after (days of sickness)', 'UK rule: more than 7 calendar days'],
  ]],
  ['Reminders', 'When HR and managers get reminders.', [
    ['probationReminderDays', 'Probation review: days before the end'],
    ['rightToWorkFirstReminderDays', 'Right to work: first reminder (days before expiry)'],
    ['rightToWorkSecondReminderDays', 'Right to work: second reminder (days before expiry)'],
  ]],
  ['Absence (Bradford Factor)', 'Score = spells² × days over 52 weeks. Levels used in the Bradford Factor report.', [
    ['bradfordInformal', 'Informal chat from'],
    ['bradfordWarning', 'Written warning trigger from'],
    ['bradfordFormal', 'Formal review from'],
  ]],
  ['Family pay & expenses', 'Company top-up on statutory maternity pay, and the expense claim window.', [
    ['enhancedMaternityWeeks', 'Enhanced maternity pay: weeks', '0 = statutory pay only'],
    ['enhancedMaternityPercent', 'Enhanced maternity pay: % of normal pay'],
    ['expenseClaimWindowDays', 'Expense claims within (days)'],
  ]],
];

const REGISTRATION_FIELDS = [
  ['payeReference', 'Employer PAYE reference', '123/AB45678 (shown on payslips)'],
  ['accountsOfficeReference', 'Accounts Office reference', '123PA00045678'],
  ['companiesHouseNumber', 'Companies House number', '01234567'],
  ['icoRegistrationNumber', 'ICO registration number', 'ZA123456'],
  ['pensionProvider', 'Workplace pension provider', 'e.g. NEST'],
  ['pensionSchemeReference', 'Pension scheme reference', ''],
];

/*
 * Company HR policies and UK registrations. Set them to what the company's contracts,
 * handbook and advisers (employment lawyer / accountant) say.
 */
export default function UkPolicySettings({ settings }) {
  const [policies, setPolicies] = useState(() => ({ ...settings.policies }));
  const [registrations, setRegistrations] = useState(() => ({ ...settings.registrations }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        policies: Object.fromEntries(Object.entries(policies).map(([k, v]) => [k, Number(v)])),
        registrations: Object.fromEntries(Object.entries(registrations).map(([k, v]) => [k, v || ''])),
      };
      await api.put('/settings', payload);
      toast.success('Policies saved');
      // Leave year and fit note rule are part of everyone's session
      if (Number(policies.leaveYearStartMonth) !== settings.policies?.leaveYearStartMonth || Number(policies.fitNoteAfterDays) !== settings.policies?.fitNoteAfterDays) {
        window.location.reload();
      }
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const err = (group, key) => errors[`${group}.${key}`];

  return (
    <Card className="mb-6" title="UK employment policies" subtitle="Your company's rules. Agree them with your employment lawyer; the app follows whatever you set here.">
      <FormSection title="Leave year" description="Balances, pro-rata and carry-over follow this year.">
        <Select
          label="Leave year starts in"
          placeholder={false}
          options={MONTHS.map((m, i) => ({ value: i + 1, label: `${m}${i === 0 ? ' (calendar year)' : i === 3 ? ' (April - March)' : ''}` }))}
          value={policies.leaveYearStartMonth}
          error={err('policies', 'leaveYearStartMonth')}
          onChange={(e) => setPolicies((p) => ({ ...p, leaveYearStartMonth: Number(e.target.value) }))}
        />
      </FormSection>

      {NUMBER_FIELDS.map(([title, description, fields]) => (
        <FormSection key={title} title={title} description={description}>
          {fields.map(([key, label, hint]) => (
            <Input
              key={key}
              label={label}
              hint={hint}
              type="number"
              min="0"
              value={policies[key] ?? ''}
              error={err('policies', key)}
              onChange={(e) => setPolicies((p) => ({ ...p, [key]: e.target.value }))}
            />
          ))}
        </FormSection>
      ))}

      <FormSection title="Company registrations" description="HMRC, Companies House, ICO and pension details. The PAYE reference appears on payslips.">
        {REGISTRATION_FIELDS.map(([key, label, placeholder]) => (
          <Input
            key={key}
            label={label}
            placeholder={placeholder}
            value={registrations[key] || ''}
            error={err('registrations', key)}
            onChange={(e) => setRegistrations((r) => ({ ...r, [key]: e.target.value }))}
          />
        ))}
      </FormSection>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save policies
        </Button>
      </div>
    </Card>
  );
}
