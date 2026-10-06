// Number to words. numberToWords uses the Indian system (lakh / crore) for INR; other currencies use millions
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
}

function belowThousand(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [hundred ? `${ONES[hundred]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

// International system: 1250000 -> "One Million Two Hundred Fifty Thousand"
function internationalWords(n) {
  const parts = [];
  [
    [1e9, 'Billion'],
    [1e6, 'Million'],
    [1e3, 'Thousand'],
  ].forEach(([size, name]) => {
    const chunk = Math.floor(n / size);
    if (chunk) parts.push(`${belowThousand(chunk)} ${name}`);
    n %= size;
  });
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

const CURRENCY_WORDS = { INR: 'Rupees', GBP: 'Pounds', EUR: 'Euros', USD: 'Dollars', AED: 'Dirhams', AUD: 'Australian Dollars', CAD: 'Canadian Dollars', SGD: 'Singapore Dollars' };

// "Pounds One Thousand Two Hundred only" (Indian lakh / crore wording for INR)
export function amountInWords(amount, currency = 'INR') {
  const n = Math.floor(Number(amount) || 0);
  const words = n === 0 ? 'Zero' : currency === 'INR' ? numberToWords(n) : internationalWords(n);
  return `${CURRENCY_WORDS[currency] || currency} ${words} only`;
}

export function numberToWords(amount) {
  let n = Math.floor(Number(amount) || 0);
  if (n === 0) return 'Zero';

  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));

  return parts.join(' ');
}
