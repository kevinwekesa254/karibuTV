package tv.karibu.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** One-screen explanation before opening "Display over other apps" (needed for start-on-boot on Android 10+). */
class OverlayPermissionActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.setOverlayAsked(this)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(getColor(R.color.karibu_bg))
            setPadding(160, 80, 160, 80)
        }
        layout.addView(TextView(this).apply { text = getString(R.string.overlay_title); textSize = 34f; setTextColor(getColor(R.color.karibu_mint)); gravity = Gravity.CENTER })
        layout.addView(TextView(this).apply { text = getString(R.string.overlay_body); textSize = 22f; setTextColor(getColor(R.color.karibu_text)); gravity = Gravity.CENTER; setPadding(0, 24, 0, 40) })
        val go = Button(this).apply {
            text = getString(R.string.overlay_continue)
            setOnClickListener {
                try {
                    startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
                } catch (_: Exception) {
                    // Some TVs have no such settings screen: skip.
                }
                finish()
            }
        }
        val skip = Button(this).apply { text = getString(R.string.overlay_skip); setOnClickListener { finish() } }
        layout.addView(go)
        layout.addView(skip)
        setContentView(layout)
        go.requestFocus()
    }
}
