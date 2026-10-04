/** Indian states / union territories by GST state code (mirrors server/services/gst.ts). */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};
export const STATE_NAMES = Object.values(GST_STATES).sort();
export const stateCode = (state: string) => Object.entries(GST_STATES).find(([, n]) => n === state)?.[0] || '';
export const stateFromGstin = (gstin?: string) => (gstin ? GST_STATES[gstin.slice(0, 2)] || '' : '');
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GST_RATE = 0.18;

/**
 * Prices include GST. Same state as the supplier → CGST 9% + SGST 9%;
 * any other state → IGST 18%. Amounts are rounded to the paisa, with the
 * tax absorbing any rounding so the parts always add up to the total.
 */
export function taxSplit(total: number, supplierState: string, placeOfSupply: string) {
  const taxable = Math.round((total / (1 + GST_RATE)) * 100) / 100;
  const tax = Math.round((total - taxable) * 100) / 100;
  const intra = !placeOfSupply || placeOfSupply === supplierState;
  if (intra) {
    const cgst = Math.round((tax / 2) * 100) / 100;
    return { taxable, intra: true, cgst, sgst: Math.round((tax - cgst) * 100) / 100, igst: 0, tax };
  }
  return { taxable, intra: false, cgst: 0, sgst: 0, igst: tax, tax };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigits = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const threeDigits = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', twoDigits(n % 100)].filter(Boolean).join(' ');

/** 249900.5 → "Rupees Two Lakh Forty-Nine Thousand Nine Hundred and Fifty Paise Only" (Indian numbering). */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7), lakh = Math.floor((rupees % 1e7) / 1e5), thousand = Math.floor((rupees % 1e5) / 1000), rest = rupees % 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  const words = parts.join(' ') || 'Zero';
  return `Rupees ${words}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}
