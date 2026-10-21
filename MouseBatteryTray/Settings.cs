using System.Windows.Forms;
using Microsoft.Win32;

namespace MouseBatteryTray
{
    /// <summary>Per-user settings, kept in the registry next to the "run at startup" entry.</summary>
    internal static class Settings
    {
        private const string AppKey = @"Software\MouseBatteryTray";
        private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string RunValue = "MouseBatteryTray";

        /// <summary>Instance id of the device picked from the menu, or null to follow the first mouse found.</summary>
        public static string SelectedDevice
        {
            get => Read("SelectedDevice") as string;
            set => Write("SelectedDevice", value);
        }

        public static bool StartWithWindows
        {
            get
            {
                using (var key = Registry.CurrentUser.OpenSubKey(RunKey))
                    return key?.GetValue(RunValue) != null;
            }
            set
            {
                using (var key = Registry.CurrentUser.CreateSubKey(RunKey))
                {
                    if (value)
                        key.SetValue(RunValue, "\"" + Application.ExecutablePath + "\"");
                    else
                        key.DeleteValue(RunValue, false);
                }
            }
        }

        /// <summary>Turns on start-up launch the very first time the app runs.</summary>
        public static void ApplyFirstRunDefaults()
        {
            if (Read("Initialized") != null)
                return;
            StartWithWindows = true;
            Write("Initialized", 1);
        }

        /// <summary>Keeps the startup entry pointing at this exe if it was moved.</summary>
        public static void RefreshStartupPath()
        {
            if (StartWithWindows)
                StartWithWindows = true;
        }

        private static object Read(string name)
        {
            using (var key = Registry.CurrentUser.OpenSubKey(AppKey))
                return key?.GetValue(name);
        }

        private static void Write(string name, object value)
        {
            using (var key = Registry.CurrentUser.CreateSubKey(AppKey))
            {
                if (value == null)
                    key.DeleteValue(name, false);
                else
                    key.SetValue(name, value);
            }
        }
    }
}
