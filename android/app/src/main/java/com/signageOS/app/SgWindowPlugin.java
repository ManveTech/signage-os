package com.signageOS.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The colour behind the status and navigation bars.
 *
 * On Android 15+ every app is drawn edge to edge and the status/navigation
 * bar colour calls (StatusBar.setBackgroundColor, the styles.xml
 * android:statusBarColor / android:navigationBarColor attributes) are
 * ignored outright. What actually shows through the now-transparent bars is
 * the activity window's own background, which nothing else in this app sets
 * — hence the bars rendering as an unstyled dark/grey strip instead of the
 * app's white. useCapacitor.ts calls this alongside the regular StatusBar
 * calls so both the pre-15 and 15+ code paths land on the same color.
 */
@CapacitorPlugin(name = "SgWindow")
public class SgWindowPlugin extends Plugin {

    @PluginMethod
    public void setBackground(PluginCall call) {
        String color = call.getString("color", "#FFFFFF");
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor(color)));
                call.resolve();
            } catch (IllegalArgumentException e) {
                call.reject("Not a colour: " + color);
            }
        });
    }
}
