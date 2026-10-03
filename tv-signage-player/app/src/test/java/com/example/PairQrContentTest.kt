package com.example

import com.example.ui.components.pairQrContent
import org.junit.Assert.assertEquals
import org.junit.Test

class PairQrContentTest {
    @Test
    fun linkWithCodeFilledIn() {
        assertEquals(
            "https://app.example.com/#/pair?code=AB12CD",
            pairQrContent("https://app.example.com/#/pair?code={code}", "AB12CD")
        )
    }

    @Test
    fun fallsBackToCodeWithoutTemplate() {
        assertEquals("AB12CD", pairQrContent("", "AB12CD"))
        assertEquals("AB12CD", pairQrContent("https://no-placeholder", "AB12CD"))
    }

    @Test
    fun emptyCodeStaysEmpty() {
        assertEquals("", pairQrContent("https://app.example.com/#/pair?code={code}", ""))
    }
}
