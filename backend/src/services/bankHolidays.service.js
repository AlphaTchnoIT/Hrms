import { Holiday } from '../models/index.js';

/*
 * Official UK bank holidays from GOV.UK (https://www.gov.uk/bank-holidays.json).
 * Each date becomes one holiday with the nations it applies to (all three = whole UK).
 */
const FEED_URL = 'https://www.gov.uk/bank-holidays.json';
const DIVISIONS = { 'england-and-wales': 'england-wales', scotland: 'scotland', 'northern-ireland': 'northern-ireland' };
const ALL_REGIONS = Object.values(DIVISIONS);

export function mergeBankHolidays(feed, { from, to }) {
  const byDate = new Map();
  Object.entries(DIVISIONS).forEach(([division, region]) => {
    (feed[division]?.events || [])
      .filter((e) => e.date >= from && e.date <= to)
      .forEach((e) => {
        const entry = byDate.get(e.date) || { date: e.date, names: new Set(), regions: new Set() };
        entry.names.add(e.title.replace(/’/g, "'"));
        entry.regions.add(region);
        byDate.set(e.date, entry);
      });
  });
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, names, regions }) => {
      const list = [...regions];
      const wholeUk = ALL_REGIONS.every((r) => regions.has(r));
      return { date, name: [...names][0], type: wholeUk ? 'bank-holiday' : 'regional', regions: wholeUk ? [] : list };
    });
}

// Adds / updates bank holidays between from and to; company and optional days are left alone
export async function syncUkBankHolidays({ from, to }) {
  const response = await fetch(FEED_URL, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GOV.UK returned ${response.status}`);
  const holidays = mergeBankHolidays(await response.json(), { from, to });

  let added = 0;
  let updated = 0;
  for (const h of holidays) {
    const existing = await Holiday.findOne({ date: h.date, type: { $in: ['bank-holiday', 'regional'] } });
    if (existing) {
      existing.set({ name: h.name, type: h.type, regions: h.regions });
      if (existing.isModified()) {
        await existing.save();
        updated += 1;
      }
    } else {
      await Holiday.create(h);
      added += 1;
    }
  }
  // Bank holidays we hold for these dates that GOV.UK no longer lists (e.g. typed by hand) are removed
  const official = new Set(holidays.map((h) => h.date));
  const stale = await Holiday.deleteMany({ date: { $gte: from, $lte: to, $nin: [...official] }, type: { $in: ['bank-holiday', 'regional'] } });
  return { added, updated, removed: stale.deletedCount, total: holidays.length };
}
