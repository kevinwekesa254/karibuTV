package tv.karibu.app

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import kotlin.concurrent.thread

/**
 * Single activity: immersive, keep-screen-on WebView showing /tv (BUILD_SPEC 12).
 * Native "Reconnecting…" view with 5 s → 60 s backoff, renderer-crash recovery,
 * daily 04:00 reload, and a min_app_version check.
 */
class MainActivity : Activity(), WebViewHost {
    private lateinit var root: FrameLayout
    private var webView: WebView? = null
    private lateinit var offlineView: View
    private var updateView: View? = null
    private val handler = Handler(Looper.getMainLooper())
    private var backoffMs = 5_000L
    private val retry = Runnable { webView?.loadUrl(Prefs.tvUrl(this)) }
    private val watchdog = object : Runnable {
        override fun run() { webView?.reload(); scheduleWatchdog() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        root = FrameLayout(this)
        setContentView(root)
        offlineView = buildOfflineView()
        root.addView(offlineView, ViewGroup.LayoutParams(-1, -1))
        offlineView.visibility = View.GONE
        mountWebView()
        scheduleWatchdog()
        checkForUpdate()

        if (!Prefs.overlayAsked(this) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            startActivity(Intent(this, OverlayPermissionActivity::class.java))
        }
    }

    private fun mountWebView() {
        webView?.let { root.removeView(it); it.destroy() }
        val wv = createKaribuWebView(this, this)
        root.addView(wv, 0, ViewGroup.LayoutParams(-1, -1))
        webView = wv
        wv.loadUrl(Prefs.tvUrl(this))
        wv.requestFocus()
    }

    override fun onResume() { super.onResume(); hideSystemUi() }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUi() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
    }

    // ---- WebViewHost
    override fun onPageOk() {
        backoffMs = 5_000L
        offlineView.visibility = View.GONE
    }

    override fun onPageFailed() {
        // The page's service worker usually serves /tv offline; this only shows if even that fails.
        offlineView.visibility = View.VISIBLE
        handler.removeCallbacks(retry)
        handler.postDelayed(retry, backoffMs)
        backoffMs = (backoffMs * 2).coerceAtMost(60_000L)
    }

    override fun onRendererGone() { handler.post { mountWebView() } }

    // ---- Remote: Back does nothing for guests; it closes the web menu if open.
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) {
                webView?.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", null)
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun scheduleWatchdog() {
        val now = Calendar.getInstance()
        val next = (now.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, 4); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0)
            if (!after(now)) add(Calendar.DAY_OF_MONTH, 1)
        }
        handler.removeCallbacks(watchdog)
        handler.postDelayed(watchdog, next.timeInMillis - now.timeInMillis)
    }

    private fun checkForUpdate() {
        thread(isDaemon = true) {
            try {
                val c = URL(BuildConfig.CONFIG_URL).openConnection() as HttpURLConnection
                c.connectTimeout = 10_000; c.readTimeout = 10_000
                val json = JSONObject(c.inputStream.bufferedReader().readText())
                val min = json.optString("min_app_version", "0")
                val apk = json.optString("apk_url", "")
                if (isNewer(min, BuildConfig.VERSION_NAME) && apk.isNotEmpty()) handler.post { showUpdate(apk) }
            } catch (_: Exception) { /* offline: try next launch */ }
        }
    }

    private fun isNewer(a: String, b: String): Boolean {
        val pa = a.split(".").map { it.toIntOrNull() ?: 0 }
        val pb = b.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(pa.size, pb.size)) {
            val x = pa.getOrElse(i) { 0 }; val y = pb.getOrElse(i) { 0 }
            if (x != y) return x > y
        }
        return false
    }

    private fun showUpdate(apk: String) {
        if (updateView != null) return
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(getColor(R.color.karibu_panel))
            setPadding(48, 36, 48, 36)
            addView(text(getString(R.string.update_title), 28f, R.color.karibu_mint))
            addView(text(getString(R.string.update_body), 20f, R.color.karibu_text))
            addView(text(apk, 24f, R.color.karibu_mint))
        }
        val lp = FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM or Gravity.END).apply { setMargins(0, 0, 48, 48) }
        root.addView(box, lp)
        updateView = box
    }

    private fun buildOfflineView(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(getColor(R.color.karibu_bg))
        addView(text(getString(R.string.app_name), 40f, R.color.karibu_mint))
        addView(text(getString(R.string.reconnecting), 32f, R.color.karibu_text))
        addView(text(getString(R.string.reconnecting_hint), 20f, R.color.karibu_muted))
    }

    private fun text(s: String, size: Float, color: Int) = TextView(this).apply {
        text = s; textSize = size; setTextColor(getColor(color)); gravity = Gravity.CENTER; setPadding(0, 8, 0, 8)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        webView?.destroy()
        super.onDestroy()
    }
}
