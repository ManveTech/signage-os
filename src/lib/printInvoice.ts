import { Capacitor } from '@capacitor/core';
import { SgPrint } from './nativePlugins';

/**
 * Prints only the invoice, not the whole dashboard (see .print-invoice in
 * index.css). In the phone app window.print() does nothing, so it goes
 * through Android's print dialog instead — which also has "Save as PDF".
 */
export async function printInvoice(): Promise<void> {
  const root = document.documentElement;
  root.classList.add('print-invoice');
  try {
    if (Capacitor.isNativePlatform()) {
      await SgPrint.print({ title: 'Invoice' });
      return;
    }
    await new Promise<void>(resolve => {
      const done = () => { window.removeEventListener('afterprint', done); resolve(); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1000);
    });
  } finally {
    root.classList.remove('print-invoice');
  }
}
