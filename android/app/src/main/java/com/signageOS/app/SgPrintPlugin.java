package com.signageOS.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Printing / saving as PDF from the phone app. window.print() does nothing
 * inside an Android WebView, so "Download invoice" silently did nothing in
 * the app. This hands the page to Android's print dialog (which also offers
 * "Save as PDF"), using the page's print styles, and resolves once the
 * dialog is closed so the page can drop its print-only styling.
 */
@CapacitorPlugin(name = "SgPrint")
public class SgPrintPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String title = call.getString("title", "Document");
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge().getWebView();
            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (webView == null || printManager == null) {
                call.reject("Printing isn't available on this device.");
                return;
            }
            PrintDocumentAdapter inner = webView.createPrintDocumentAdapter(title);
            printManager.print(title, new PrintDocumentAdapter() {
                @Override public void onStart() { inner.onStart(); }
                @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                    inner.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras);
                }
                @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
                    inner.onWrite(pages, destination, cancellationSignal, callback);
                }
                @Override public void onFinish() {
                    inner.onFinish();
                    call.resolve();
                }
            }, null);
        });
    }
}
