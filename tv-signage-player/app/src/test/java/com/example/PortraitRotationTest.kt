package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w960dp-h540dp-land-xhdpi", sdk = [34])
class PortraitRotationTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun portraitContentFillsLandscapeDisplayRotated() {
        compose.setContent {
            Box(Modifier.fillMaxSize().background(Color.Black)) {
                Box(Modifier.fillMaxSize().rotatedToPortrait().background(Color(0xFF1E3A8A))) {
                    Box(Modifier.fillMaxWidth().height(80.dp).background(Color(0xFFDC2626)).align(Alignment.TopCenter)) {
                        Text("TOP OF PORTRAIT CONTENT", color = Color.White, fontSize = 22.sp, modifier = Modifier.align(Alignment.Center))
                    }
                    Text("portrait\n540 x 960", color = Color.White, fontSize = 40.sp, modifier = Modifier.align(Alignment.Center))
                    Box(Modifier.fillMaxWidth().height(60.dp).background(Color(0xFF16A34A)).align(Alignment.BottomCenter)) {
                        Text("BOTTOM (ticker)", color = Color.White, fontSize = 20.sp, modifier = Modifier.align(Alignment.Center))
                    }
                }
            }
        }
        compose.onRoot().captureRoboImage("build/portrait_rotation.png")
    }
}
