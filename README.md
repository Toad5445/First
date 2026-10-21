# Mouse Battery Tray

A tiny Windows tray app that shows your wireless mouse's battery as a battery icon,
drawn in the same flat style as the built-in Windows 11 tray icons.

Supported mice:
- **Logitech** mice on a LIGHTSPEED or Unifying USB receiver, or plugged in by cable
  (e.g. G Pro X Superlight). Read directly from the mouse over Logitech's HID++ protocol, like G HUB does;
  G HUB doesn't need to be running.
- **Bluetooth** mice that report their battery to Windows (the level shown in Settings → Bluetooth & devices).

- The icon fills up according to the battery level; hover it to see the exact percentage.
- **≤ 20%** the icon turns amber, **≤ 10%** it turns red and you get a one-time "battery low" notification.
- While charging, a small lightning bolt appears on the icon. Logitech mice report this directly.
  Windows doesn't report charging for Bluetooth mice, so for those it's detected from the level rising;
  it can take a few minutes to show up and clears once the level stops rising for 30 minutes.
- Wireless Logitech mice go to sleep when idle and stop answering; the icon keeps showing the last reading
  (tooltip says "asleep") until the mouse wakes up.
- Follows light/dark taskbar and display scaling automatically.
- Starts with Windows (toggle in the right-click menu).
- Right-click → **Device** to pick a specific device if it didn't pick the right one automatically.
- Left-click refreshes immediately; otherwise it refreshes every 60 seconds.

## Install

1. Download `MouseBatteryTray.exe` from the latest successful run in the **Actions** tab
   (Build → MouseBatteryTray artifact), or build it yourself (below).
2. Put it somewhere permanent, e.g. `%LOCALAPPDATA%\MouseBatteryTray\MouseBatteryTray.exe`.
3. Run it once. It adds itself to startup automatically.
4. To keep it always visible next to your other icons: **Settings → Personalization → Taskbar →
   Other system tray icons** and turn on **MouseBatteryTray** (or drag it out of the `^` overflow).

It needs nothing else installed — it uses .NET Framework 4.8, which ships with Windows 10 and 11.

## Notes

- Logitech mice that only report battery voltage (like the original Superlight) are converted to a
  percentage with the same curve G HUB uses, so the number should match G HUB.
- Logitech Bolt receivers and Logitech mice connected over Bluetooth aren't supported yet.
- The icon is faded out when no mouse is connected.

## Build

```
dotnet build MouseBatteryTray/MouseBatteryTray.csproj -c Release
```

Output: `MouseBatteryTray/bin/Release/net48/MouseBatteryTray.exe`
