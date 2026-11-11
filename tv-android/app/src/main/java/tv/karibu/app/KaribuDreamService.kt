package tv.karibu.app

import android.service.dreams.DreamService
import android.webkit.WebView

/** Screensaver showing the same /tv WebView. Some Google TV builds hide third-party screensavers; see docs/SETUP_GUIDE.md. */
class KaribuDreamService : DreamService(), WebViewHost {
    private var webView: WebView? = null

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        isInteractive = false
        isFullscreen = true
        isScreenBright = true
        val wv = createKaribuWebView(this, this)
        setContentView(wv)
        wv.loadUrl(Prefs.tvUrl(this))
        webView = wv
    }

    override fun onPageOk() {}
    override fun onPageFailed() { webView?.postDelayed({ webView?.reload() }, 15_000) }
    override fun onRendererGone() { webView?.reload() }

    override fun onDetachedFromWindow() {
        webView?.destroy(); webView = null
        super.onDetachedFromWindow()
    }
}
