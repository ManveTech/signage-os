package com.example.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

/** Renders [content] as a black-on-white QR bitmap, [sizePx] square. */
private fun encodeQrBitmap(content: String, sizePx: Int): Bitmap {
    val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx)
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
    for (x in 0 until sizePx) {
        for (y in 0 until sizePx) {
            bitmap.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
        }
    }
    return bitmap
}

/**
 * A scannable QR code encoding [content] as plain text — e.g. the pairing
 * code itself, so scanning it lets you copy the code instead of typing six
 * characters by hand. Regenerated only when [content] or [sizePx] change.
 */
@Composable
fun QrCodeImage(content: String, sizePx: Int, modifier: Modifier = Modifier) {
    if (content.isEmpty()) return
    val bitmap = remember(content, sizePx) { encodeQrBitmap(content, sizePx) }
    Image(
        bitmap = bitmap.asImageBitmap(),
        contentDescription = "QR code for pairing code $content",
        modifier = modifier
    )
}
