# Mouse Battery Tray

A tiny Windows tray app that shows your Bluetooth mouse's battery as a battery icon,
drawn in the same flat style as the built-in Windows 11 tray icons.

- The icon fills up according to the battery level; hover it to see the exact percentage.
- **≤ 20%** the icon turns amber, **≤ 10%** it turns red and you get a one-time "battery low" notification.
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

- Works with mice that report battery to Windows over Bluetooth (the same level shown in
  Settings → Bluetooth & devices). Mice connected through a USB receiver (e.g. Logitech Unifying/Bolt)
  don't report battery to Windows this way.
- The icon is faded out when no mouse is connected.

## Build

```
dotnet build MouseBatteryTray/MouseBatteryTray.csproj -c Release
```

Output: `MouseBatteryTray/bin/Release/net48/MouseBatteryTray.exe`
