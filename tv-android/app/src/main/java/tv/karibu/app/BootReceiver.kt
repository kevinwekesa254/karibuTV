package tv.karibu.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Starts the welcome screen when the TV powers on (works once "Display over other apps" is granted). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == "android.intent.action.QUICKBOOT_POWERON") {
            context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
