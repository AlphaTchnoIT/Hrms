import { BadgeDollarSign, BadgeEuro, BadgeIndianRupee, BadgePoundSterling, Banknote, DollarSign, Euro, IndianRupee, PoundSterling } from 'lucide-react';
import { getDisplayCurrency } from '@/lib/format';

const PLAIN = { INR: IndianRupee, GBP: PoundSterling, EUR: Euro, USD: DollarSign };
const BADGE = { INR: BadgeIndianRupee, GBP: BadgePoundSterling, EUR: BadgeEuro, USD: BadgeDollarSign };

// Money icon matching the company currency (£ for GBP, ₹ for INR...), banknote for others
export function CurrencyIcon(props) {
  const Icon = PLAIN[getDisplayCurrency()] || Banknote;
  return <Icon {...props} />;
}

export function CurrencyBadgeIcon(props) {
  const Icon = BADGE[getDisplayCurrency()] || Banknote;
  return <Icon {...props} />;
}
