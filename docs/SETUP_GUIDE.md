# Karibu TV setup guide (for hosts)

You need: an Android TV or Google TV (TCL, Hisense, Vitron, Skyworth, Syinix, Sony, Xiaomi, Chromecast with Google TV), Wi-Fi, and your phone.

1. **Install Downloader.** On the TV, open the Play Store, search **Downloader** (by AFTVnews) and install it.
2. **Install Karibu TV.** Open Downloader, type the Karibu TV link we sent you and press Go. When the TV asks, allow Downloader to install unknown apps, then tap Install.
3. **Open Karibu TV.** The first time, it asks to *Display over other apps*. Choose Continue, switch it on, then press Back. This lets Karibu open by itself when the TV turns on.
4. **Pair it.** The TV shows a code like `K7Q 4MZ`. On your phone, open karibu.tv → TVs → Pair a TV, type the code, choose the property and room. The TV switches to the welcome screen in a few seconds.

## Tips
- **Long-press OK for 3 seconds** on the remote to open the Karibu menu (Refresh, Show pairing code, About).
- Leave the TV on the Karibu screen when guests arrive. If the power goes, the TV opens Karibu again by itself.
- Change the Wi-Fi password, rules or photos on your phone at any time. The TV updates within seconds.

## If the TV doesn't open Karibu after a power cut
Some TVs block apps from starting by themselves. Try, in order:
1. Settings → Apps → Special app access → Display over other apps → Karibu TV → On.
2. Settings → Device preferences → Screen saver → choose **Karibu TV** (not available on every Google TV).
3. **ADB fallback (for installers):** enable Developer options and USB/network debugging on the TV, then from a computer:
   ```bash
   adb connect <tv-ip>
   adb shell settings put secure screensaver_components tv.karibu.app/.KaribuDreamService
   adb shell settings put secure screensaver_enabled 1
   adb shell appops set tv.karibu.app SYSTEM_ALERT_WINDOW allow
   ```
