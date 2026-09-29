package com.signageOS.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Before super.onCreate, which is when Capacitor loads its plugins.
        registerPlugin(SgWindowPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
