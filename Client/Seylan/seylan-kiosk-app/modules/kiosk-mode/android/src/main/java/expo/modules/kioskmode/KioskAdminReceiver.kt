package expo.modules.kioskmode

import android.app.admin.DeviceAdminReceiver

/** Device admin receiver. Making it the device owner enables the full kiosk lock. */
class KioskAdminReceiver : DeviceAdminReceiver()
