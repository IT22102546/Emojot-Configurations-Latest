package expo.modules.kioskmode

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Locks the tablet to this app with Android's lock task mode.
 *
 * - Device owner (set up once per tablet, see README): full kiosk. Home, recent
 *   apps, notifications, the status bar and the lock screen are blocked, with
 *   no prompt, and the app reopens after a restart.
 * - Any other tablet: screen pinning. Android pins the app; it can only be
 *   unpinned with the system gesture (protected by the device PIN if
 *   "Ask for PIN before unpinning" is on).
 */
class KioskModeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  private val dpm: DevicePolicyManager
    get() = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  private val admin: ComponentName
    get() = ComponentName(context, KioskAdminReceiver::class.java)

  private fun isOwner(): Boolean = dpm.isDeviceOwnerApp(context.packageName)

  /** "none", "locked" (full kiosk) or "pinned" (screen pinning). */
  private fun lockState(): String {
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return when (am.lockTaskModeState) {
      ActivityManager.LOCK_TASK_MODE_LOCKED -> "locked"
      ActivityManager.LOCK_TASK_MODE_PINNED -> "pinned"
      else -> "none"
    }
  }

  private fun setOwnerRestrictions(on: Boolean) {
    if (!isOwner()) return
    if (on) {
      dpm.setLockTaskPackages(admin, arrayOf(context.packageName))
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
      }
    }
    dpm.setStatusBarDisabled(admin, on)
    dpm.setKeyguardDisabled(admin, on)
  }

  override fun definition() = ModuleDefinition {
    Name("KioskMode")

    Function("getState") {
      mapOf("deviceOwner" to isOwner(), "lockTask" to lockState())
    }

    AsyncFunction("lock") {
      val activity = appContext.currentActivity ?: return@AsyncFunction lockState()
      setOwnerRestrictions(true)
      if (lockState() == "none") activity.startLockTask()
      lockState()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("unlock") {
      val activity = appContext.currentActivity ?: return@AsyncFunction lockState()
      if (lockState() != "none") activity.stopLockTask()
      setOwnerRestrictions(false)
      lockState()
    }.runOnQueue(Queues.MAIN)
  }
}
