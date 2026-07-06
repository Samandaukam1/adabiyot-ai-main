/**
 * TODO: build-time branding sync for native launcher icons.
 *
 * Native iOS/Android launcher icons cannot be changed from a remote URL at
 * runtime. Before an EAS build, this script can read:
 *
 * app_settings where key = "branding" and is_public = true
 *
 * Then download `value.app_icon_url` into `assets/images/icon.png` and, when
 * needed, refresh `assets/images/adaptive-icon.png` / `splash-icon.png`.
 */
export {};
