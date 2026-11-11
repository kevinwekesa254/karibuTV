package tv.karibu.app

import android.content.Context
import java.security.SecureRandom

/** Persistent TV identity: a random 32-char device_key created on first launch (BUILD_SPEC 8.2). */
object Prefs {
    private const val FILE = "karibu"
    private const val KEY = "device_key"
    private const val OVERLAY_ASKED = "overlay_asked"
    private const val ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    fun deviceKey(ctx: Context): String {
        val p = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        p.getString(KEY, null)?.let { return it }
        val rnd = SecureRandom()
        val key = (1..32).map { ALPHABET[rnd.nextInt(ALPHABET.length)] }.joinToString("")
        p.edit().putString(KEY, key).apply()
        return key
    }

    fun overlayAsked(ctx: Context) = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(OVERLAY_ASKED, false)
    fun setOverlayAsked(ctx: Context) = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(OVERLAY_ASKED, true).apply()

    fun tvUrl(ctx: Context) = "${BuildConfig.TV_URL}#device_key=${deviceKey(ctx)}"
}
