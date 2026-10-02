package com.signageOS.app;

import android.graphics.Color;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Before super.onCreate, which is when Capacitor loads its plugins.
        registerPlugin(SgWindowPlugin.class);

        super.onCreate(savedInstanceState);

        // A WebView paints white until the page's first frame — black instead,
        // so the hand-off from the (black) native splash to BootScreen has no
        // white flash in between.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.BLACK);
        }
    }
}
