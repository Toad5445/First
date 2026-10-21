using System;
using System.Threading;
using System.Windows.Forms;

namespace MouseBatteryTray
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            using (var mutex = new Mutex(true, @"Local\MouseBatteryTray", out bool firstInstance))
            {
                if (!firstInstance)
                    return;

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                Settings.ApplyFirstRunDefaults();
                Settings.RefreshStartupPath();

                using (var app = new TrayApp())
                    Application.Run(app);
            }
        }
    }
}
