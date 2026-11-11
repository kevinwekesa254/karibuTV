package tv.karibu.app

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/** Exposed to the page as window.KaribuAndroid (heartbeat reports the native app version). */
class KaribuBridge {
    @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME
}

interface WebViewHost {
    fun onPageOk()
    fun onPageFailed()
    fun onRendererGone()
}

/** Full-screen WebView configured for the /tv route: JS, DOM storage, service workers, no autoplay. */
@SuppressLint("SetJavaScriptEnabled")
fun createKaribuWebView(ctx: Context, host: WebViewHost): WebView {
    val wv = WebView(ctx)
    wv.setBackgroundColor(Color.parseColor("#0C1F16"))
    wv.settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        databaseEnabled = true
        cacheMode = WebSettings.LOAD_DEFAULT
        mediaPlaybackRequiresUserGesture = true
        loadWithOverviewMode = true
        useWideViewPort = true
        setSupportZoom(false)
        builtInZoomControls = false
        displayZoomControls = false
    }
    wv.isVerticalScrollBarEnabled = false
    wv.isHorizontalScrollBarEnabled = false
    // Keep key events flowing to the page (long-press OK menu) without drawing a focus ring.
    wv.isFocusable = true
    wv.isFocusableInTouchMode = true
    wv.defaultFocusHighlightEnabledCompat()
    wv.addJavascriptInterface(KaribuBridge(), "KaribuAndroid")

    wv.webViewClient = object : WebViewClient() {
        private var failed = false
        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) { failed = false }
        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
            if (request?.isForMainFrame == true) { failed = true; host.onPageFailed() }
        }
        override fun onPageFinished(view: WebView?, url: String?) { if (!failed) host.onPageOk() }
        override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
            host.onRendererGone()
            return true
        }
    }
    return wv
}

private fun WebView.defaultFocusHighlightEnabledCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) defaultFocusHighlightEnabled = false
}
