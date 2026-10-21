using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace MouseBatteryTray
{
    /// <summary>The tray icon, its right-click menu and the refresh loop.</summary>
    internal sealed class TrayApp : ApplicationContext
    {
        private static readonly TimeSpan RefreshInterval = TimeSpan.FromSeconds(60);

        // Some mice report in 5-10% steps, so allow a long gap between rises before deciding charging stopped.
        private static readonly TimeSpan ChargingTimeout = TimeSpan.FromMinutes(30);

        private readonly NotifyIcon _tray;
        private readonly ContextMenuStrip _menu;
        private readonly ToolStripMenuItem _statusItem;
        private readonly ToolStripMenuItem _deviceMenu;
        private readonly ToolStripMenuItem _startupItem;
        private readonly Timer _timer;

        private List<BatteryDevice> _devices = new List<BatteryDevice>();
        private readonly Dictionary<string, ChargeState> _chargeStates = new Dictionary<string, ChargeState>(StringComparer.OrdinalIgnoreCase);
        private BatteryDevice _current;
        private bool _charging;
        private Icon _icon;
        private bool _lowWarningShown;
        private bool _refreshing;
        private bool _disposed;
        private readonly TaskScheduler _ui;

        public TrayApp()
        {
            _statusItem = new ToolStripMenuItem { Enabled = false };
            _deviceMenu = new ToolStripMenuItem("Device");
            _startupItem = new ToolStripMenuItem("Start with Windows", null, (s, e) => ToggleStartup());

            _menu = new ContextMenuStrip();
            _menu.Items.Add(_statusItem);
            _menu.Items.Add(new ToolStripSeparator());
            _menu.Items.Add(_deviceMenu);
            _menu.Items.Add(new ToolStripMenuItem("Refresh now", null, (s, e) => Refresh()));
            _menu.Items.Add(_startupItem);
            _menu.Items.Add(new ToolStripSeparator());
            _menu.Items.Add(new ToolStripMenuItem("Exit", null, (s, e) => ExitThread()));
            _menu.Opening += (s, e) => BuildMenu();

            // Creating the menu installed the WinForms synchronization context; results come back through it.
            _ui = TaskScheduler.FromCurrentSynchronizationContext();

            _tray = new NotifyIcon { ContextMenuStrip = _menu, Visible = true };
            _tray.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                    Refresh();
            };

            _timer = new Timer { Interval = (int)RefreshInterval.TotalMilliseconds };
            _timer.Tick += (s, e) => Refresh();
            _timer.Start();

            // Redraw when the user switches light/dark mode or changes display scaling.
            SystemEvents.UserPreferenceChanged += OnSystemChanged;
            SystemEvents.DisplaySettingsChanged += OnSystemChanged;

            Refresh();
        }

        private void OnSystemChanged(object sender, EventArgs e) => UpdateIcon();

        /// <summary>Reads all devices on a background thread (talking to a receiver can take a moment).</summary>
        private void Refresh()
        {
            if (_refreshing)
                return;
            _refreshing = true;

            Task.Run(() =>
            {
                var devices = new List<BatteryDevice>();
                try { devices.AddRange(LogitechReader.GetDevices()); } catch { }
                try { devices.AddRange(BatteryReader.GetDevices()); } catch { }
                // Mice first, and devices that are answering before ones showing an old reading.
                devices.Sort((a, b) => a.IsMouse != b.IsMouse ? (a.IsMouse ? -1 : 1) : a.Asleep.CompareTo(b.Asleep));
                return devices;
            }).ContinueWith(t =>
            {
                _refreshing = false;
                if (_disposed)
                    return;

                _devices = t.Result;
                foreach (BatteryDevice device in _devices)
                {
                    if (device.Charging == null && !device.Asleep)
                        TrackCharging(device);
                }
                ShowCurrent();
            }, _ui);
        }

        private void ShowCurrent()
        {
            _current = PickDevice(_devices);
            _charging = _current != null && !_current.Asleep && (_current.Charging ?? IsCharging(_current));
            UpdateIcon();
            CheckLowBattery();
        }

        /// <summary>
        /// Windows doesn't report whether a Bluetooth mouse is charging, only its level,
        /// so treat a rising level as charging until it drops or stops rising for a while.
        /// </summary>
        private void TrackCharging(BatteryDevice device)
        {
            string key = device.InstanceId ?? device.Name;
            DateTime now = DateTime.UtcNow;

            if (!_chargeStates.TryGetValue(key, out ChargeState state))
            {
                _chargeStates[key] = new ChargeState { Percent = device.Percent };
                return;
            }

            if (device.Percent > state.Percent)
            {
                state.Charging = true;
                state.LastRise = now;
            }
            else if (device.Percent < state.Percent || now - state.LastRise > ChargingTimeout)
            {
                state.Charging = false;
            }
            state.Percent = device.Percent;
        }

        private bool IsCharging(BatteryDevice device) =>
            _chargeStates.TryGetValue(device.InstanceId ?? device.Name, out ChargeState state) && state.Charging;

        private static BatteryDevice PickDevice(List<BatteryDevice> devices)
        {
            string selected = Settings.SelectedDevice;
            if (selected != null)
            {
                // A specific device was picked; if it is currently off, show nothing rather than another device.
                return devices.Find(d => string.Equals(d.InstanceId, selected, StringComparison.OrdinalIgnoreCase));
            }
            return devices.Find(d => d.IsMouse);
        }

        private void UpdateIcon()
        {
            int size = IconRenderer.GetTrayIconSize();
            Icon old = _icon;
            _icon = IconRenderer.Render(_current?.Percent, _charging, size, IconRenderer.IsLightTaskbar());
            _tray.Icon = _icon;
            old?.Dispose();

            string text = _current != null
                ? $"{_current.Name}: {_current.Percent}%{Suffix(" (", ")")}"
                : "Mouse battery: no mouse found";
            // NotifyIcon tooltips are limited to 63 characters.
            _tray.Text = text.Length > 63 ? text.Substring(0, 60) + "..." : text;
        }

        private string Suffix(string before, string after) =>
            _charging ? before + "charging" + after
            : _current != null && _current.Asleep ? before + "asleep, last reading" + after
            : "";

        private void CheckLowBattery()
        {
            if (_current == null)
                return;

            if (_charging || _current.Percent > IconRenderer.CriticalThreshold + 5)
            {
                _lowWarningShown = false;
            }
            else if (_current.Percent <= IconRenderer.CriticalThreshold && !_lowWarningShown)
            {
                _lowWarningShown = true;
                _tray.ShowBalloonTip(5000, "Mouse battery low",
                    $"{_current.Name} is at {_current.Percent}%. Time to charge it.", ToolTipIcon.Warning);
            }
        }

        private void BuildMenu()
        {
            _statusItem.Text = _current != null ? $"{_current.Name} — {_current.Percent}%{Suffix(", ", "")}" : "No mouse found";
            _startupItem.Checked = Settings.StartWithWindows;

            string selected = Settings.SelectedDevice;
            _deviceMenu.DropDownItems.Clear();

            var auto = new ToolStripMenuItem("Automatic (first mouse)", null, (s, e) => SelectDevice(null)) { Checked = selected == null };
            _deviceMenu.DropDownItems.Add(auto);

            if (_devices.Count > 0)
                _deviceMenu.DropDownItems.Add(new ToolStripSeparator());

            foreach (BatteryDevice device in _devices)
            {
                string id = device.InstanceId;
                _deviceMenu.DropDownItems.Add(new ToolStripMenuItem($"{device.Name} ({device.Percent}%)", null, (s, e) => SelectDevice(id))
                {
                    Checked = selected != null && string.Equals(selected, id, StringComparison.OrdinalIgnoreCase),
                });
            }

            if (_devices.Count == 0)
                _deviceMenu.DropDownItems.Add(new ToolStripMenuItem("No devices report a battery level") { Enabled = false });
        }

        private void SelectDevice(string instanceId)
        {
            Settings.SelectedDevice = instanceId;
            _lowWarningShown = false;
            ShowCurrent();
        }

        private void ToggleStartup()
        {
            try
            {
                Settings.StartWithWindows = !Settings.StartWithWindows;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not change the startup setting:\n" + ex.Message, "Mouse Battery", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private sealed class ChargeState
        {
            public int Percent;
            public bool Charging;
            public DateTime LastRise;
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _disposed = true;
                SystemEvents.UserPreferenceChanged -= OnSystemChanged;
                SystemEvents.DisplaySettingsChanged -= OnSystemChanged;
                _timer.Dispose();
                _tray.Visible = false;
                _tray.Dispose();
                _menu.Dispose();
                _icon?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
