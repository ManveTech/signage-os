import { pb } from '../db';
import { getIntegration } from '../integrationsStore';
import { isRedisReady } from '../redis';
import { resolveUserOrgId } from './ownership';

/**
 * GST tax invoices: running numbers per financial year
 * (PREFIX/2026-27/0001, restarting each April), and a snapshot of who the
 * invoice is billed to, taken when it's issued — an issued invoice must not
 * change if the client edits their details later.
 */

export type BillTo = { name: string; email: string; address: string; state: string; gstin: string };

const istDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

/** "2026-27" for any date from 1 Apr 2026 to 31 Mar 2027. */
export function financialYear(date: string = istDate()): string {
  const [y, m] = date.slice(0, 10).split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export async function invoicePrefix(): Promise<string> {
  const biz = await getIntegration('business').catch(() => null);
  const raw = String(biz?.config?.invoicePrefix || 'BSD').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return raw || 'BSD';
}

const localCounters = new Map<string, number>();

async function highestInSeries(series: string): Promise<number> {
  const last = await pb.collection('invoices').getList(1, 1, {
    filter: pb.filter('number ~ {:series}', { series: `${series}%` }),
    sort: '-number',
  }).catch(() => ({ items: [] as any[] }));
  return last.items.length ? parseInt(String(last.items[0].number).slice(series.length), 10) || 0 : 0;
}

/**
 * Next number for the financial year of `date`. Taken from an atomic
 * counter (Redis INCR, seeded from the highest number already issued), so
 * invoices created at the same moment — even on different server
 * instances — never share a number.
 */
export async function nextInvoiceNumber(date: string = istDate()): Promise<string> {
  const series = `${await invoicePrefix()}/${financialYear(date)}/`;
  let n: number;
  if (isRedisReady()) {
    const key = `invoice-seq:${series}`;
    const { redis } = await import('../redis');
    if (!(await redis.exists(key))) await redis.set(key, String(await highestInSeries(series)), 'NX');
    n = await redis.incr(key);
  } else {
    if (!localCounters.has(series)) localCounters.set(series, await highestInSeries(series));
    n = localCounters.get(series)! + 1;
    localCounters.set(series, n);
  }
  return `${series}${String(n).padStart(4, '0')}`;
}

/** The client's invoice details right now: their organisation's billing name, address, state and GSTIN. */
export async function billToFor(email: string, fallbackName = ''): Promise<BillTo> {
  const orgId = await resolveUserOrgId(email).catch(() => null);
  const org = orgId ? await pb.collection('organizations').getOne(orgId).catch(() => null) : null;
  return {
    name: org?.billingName || org?.name || fallbackName || email.split('@')[0],
    email,
    address: org?.billingAddress || '',
    state: org?.state || '',
    gstin: (org?.gstin || '').toUpperCase(),
  };
}

/**
 * Fills in an invoice's number and billed-to snapshot if they're missing.
 * Called wherever invoices are created.
 */
export async function prepareInvoice(body: Record<string, any>): Promise<Record<string, any>> {
  if (!body.number) body.number = await nextInvoiceNumber(String(body.issuedDate || istDate()).slice(0, 10));
  if (!body.billTo || typeof body.billTo !== 'object' || !body.billTo.name) {
    body.billTo = body.clientEmail ? await billToFor(String(body.clientEmail), String(body.clientName || '')) : { name: String(body.clientName || ''), email: '', address: '', state: '', gstin: '' };
  }
  return body;
}

/** Numbers every invoice that has none yet, oldest first. Run once when the field is added. */
export async function backfillInvoiceNumbers(): Promise<number> {
  const rows = await pb.collection('invoices').getFullList({ filter: 'number = ""', sort: 'created' }).catch(() => [] as any[]);
  let done = 0;
  for (const inv of rows) {
    const patch = await prepareInvoice({ ...inv, number: '', billTo: inv.billTo });
    await pb.collection('invoices').update(inv.id, { number: patch.number, billTo: patch.billTo }).catch(() => {});
    done++;
  }
  return done;
}
