package com.example.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/** Renders [content] as a black-on-white QR bitmap, [sizePx] square. */
private fun encodeQrBitmap(content: String, sizePx: Int): Bitmap {
    // ZXing's default quiet zone is 4 modules — generous enough that a short
    // 6-character code renders as a small QR pattern floating in a mostly-
    // white square, which is what actually made the "big white box, small
    // code" look, not the padding around it in Compose. 1 module is still a
    // safely scannable margin, just not a wasteful one.
    val hints = mapOf(EncodeHintType.MARGIN to 1)
    val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
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
