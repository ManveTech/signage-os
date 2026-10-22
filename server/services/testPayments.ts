/**
 * Which payments are tests — and so the only ones that may be deleted.
 * Mirrors src/lib/testPayments.ts; keep the two in step.
 *
 * A test payment is one made with Razorpay test keys (recorded as testMode
 * since that was tracked), or one whose id isn't a real Razorpay payment id
 * (pay_ + 14 characters) — left over from development. Payments recorded by
 * hand (manual_…) are real money and never count.
 */
const REAL_RAZORPAY_ID = /^pay_[A-Za-z0-9]{14}$/;

export function isTestPaymentRef(ref: string | undefined, testMode?: boolean): boolean {
  if (testMode) return true;
  const id = String(ref || '').trim();
  if (id.startsWith('manual_')) return false;
  return !REAL_RAZORPAY_ID.test(id);
}

export const isTestPayment = (p: any) => isTestPaymentRef(p?.razorpayPaymentId, p?.testMode);

/** An invoice paid by a test payment. Unpaid invoices are never tests. */
export const isTestInvoice = (inv: any) => inv?.status === 'paid' && isTestPaymentRef(inv?.paymentRef, inv?.testMode);
