package expo.modules.kioskmode

import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Starts the kiosk after the tablet restarts. Android only lets a device owner
 * open an activity from the background, so on other tablets this does nothing.
 */
class KioskBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    if (!dpm.isDeviceOwnerApp(context.packageName)) return
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(launch)
  }
}
