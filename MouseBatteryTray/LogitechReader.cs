using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace MouseBatteryTray
{
    /// <summary>
    /// Reads battery levels from Logitech devices using Logitech's HID++ 2.0 protocol, the same way
    /// G HUB / Options do. Covers LIGHTSPEED and Unifying receivers (e.g. G Pro X Superlight) and
    /// mice plugged in by cable. Windows itself never sees these batteries.
    /// </summary>
    internal static class LogitechReader
    {
        private const ushort LogitechVendorId = 0x046D;
        private const ushort HidppUsagePage = 0xFF00;
        private const ushort ShortUsage = 0x0001; // report 0x10, 7 bytes
        private const ushort LongUsage = 0x0002;  // report 0x11, 20 bytes
        private const byte ShortReportId = 0x10;
        private const byte LongReportId = 0x11;
        private const byte SoftwareId = 0x0B;
        private const int RequestTimeoutMs = 1000;

        private const ushort FeatureDeviceName = 0x0005;
        private const ushort FeatureBatteryStatus = 0x1000;
        private const ushort FeatureBatteryVoltage = 0x1001;
        private const ushort FeatureUnifiedBattery = 0x1004;

        // Receivers number their paired devices 1-6; a device on a USB cable answers on 0xFF.
        private static readonly byte[] DeviceIndexes = { 1, 2, 3, 4, 5, 6, 0xFF };

        // LGHUB's discharge curve (mV -> %) for devices that only report voltage (feature 0x1001).
        private static readonly int[,] VoltageCurve =
        {
            { 4186, 100 }, { 4067, 90 }, { 3989, 80 }, { 3922, 70 }, { 3859, 60 }, { 3811, 50 },
            { 3778, 40 }, { 3751, 30 }, { 3717, 20 }, { 3671, 10 }, { 3646, 5 }, { 3579, 2 }, { 3500, 0 },
        };

        /// <summary>What we learned about a device the first time it answered, so later polls are a single request.</summary>
        private sealed class Route
        {
            public byte BatteryIndex;
            public ushort BatteryFeature;
            public string Name;
            public bool IsMouse;
        }

        private static readonly Dictionary<string, Route> Routes = new Dictionary<string, Route>();

        // Last good reading per device, shown while the mouse sleeps (it stops answering to save power).
        private static readonly Dictionary<string, BatteryDevice> LastReadings = new Dictionary<string, BatteryDevice>();

        /// <summary>Not thread-safe; call from one thread at a time.</summary>
        public static List<BatteryDevice> GetDevices()
        {
            var live = new List<BatteryDevice>();
            var seenParents = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (HidppInterface hidpp in FindInterfaces())
            {
                seenParents.Add(hidpp.ParentId);
                using (hidpp)
                {
                    foreach (byte index in DeviceIndexes)
                    {
                        string key = "hidpp:" + hidpp.ParentId + ":" + index.ToString("X2");
                        BatteryDevice device = Query(hidpp, index, key);
                        if (device != null)
                        {
                            LastReadings[key] = device;
                            live.Add(device);
                        }
                    }
                }
            }

            // Sleeping devices: show the last reading, as long as their receiver is still plugged in
            // and the same device isn't also answering another way (e.g. now on a cable).
            var result = new List<BatteryDevice>(live);
            foreach (var pair in LastReadings)
            {
                bool receiverPresent = false;
                foreach (string parent in seenParents)
                    receiverPresent |= pair.Key.StartsWith("hidpp:" + parent + ":", StringComparison.OrdinalIgnoreCase);
                bool answering = live.Exists(d => d.InstanceId == pair.Key || d.Name == pair.Value.Name);
                if (receiverPresent && !answering)
                {
                    result.Add(new BatteryDevice
                    {
                        InstanceId = pair.Key,
                        Name = pair.Value.Name,
                        Percent = pair.Value.Percent,
                        IsMouse = pair.Value.IsMouse,
                        Asleep = true,
                    });
                }
            }
            return result;
        }

        private static BatteryDevice Query(HidppInterface hidpp, byte index, string key)
        {
            if (!Routes.TryGetValue(key, out Route route))
            {
                route = Discover(hidpp, index);
                if (route == null)
                    return null;
                Routes[key] = route;
            }

            if (!ReadBattery(hidpp, index, route, out int percent, out bool charging))
                return null;

            return new BatteryDevice
            {
                InstanceId = key,
                Name = route.Name,
                Percent = percent,
                Charging = charging,
                IsMouse = route.IsMouse,
            };
        }

        private static Route Discover(HidppInterface hidpp, byte index)
        {
            // Ping (root feature, getProtocolVersion). Empty slots and HID++ 1.0 receivers fail here.
            byte[] ping = hidpp.Request(index, 0x00, 1, 0, 0, 0x5A);
            if (ping == null || ping[0] < 2)
                return null;

            var route = new Route();
            foreach (ushort feature in new[] { FeatureUnifiedBattery, FeatureBatteryVoltage, FeatureBatteryStatus })
            {
                byte featureIndex = GetFeatureIndex(hidpp, index, feature);
                if (featureIndex != 0)
                {
                    route.BatteryIndex = featureIndex;
                    route.BatteryFeature = feature;
                    break;
                }
            }
            if (route.BatteryIndex == 0)
                return null;

            route.Name = "Logitech device";
            route.IsMouse = true; // Assume a mouse unless the device says otherwise.
            byte nameIndex = GetFeatureIndex(hidpp, index, FeatureDeviceName);
            if (nameIndex != 0)
            {
                byte[] count = hidpp.Request(index, nameIndex, 0);
                if (count != null && count[0] > 0)
                {
                    var name = new StringBuilder();
                    while (name.Length < count[0])
                    {
                        byte[] chunk = hidpp.Request(index, nameIndex, 1, (byte)name.Length);
                        if (chunk == null)
                            break;
                        int take = Math.Min(chunk.Length, count[0] - name.Length);
                        name.Append(Encoding.ASCII.GetString(chunk, 0, take));
                    }
                    string text = name.ToString().TrimEnd('\0', ' ');
                    if (text.Length > 0)
                        route.Name = "Logitech " + text;
                }

                // 0 keyboard, 1 remote, 2 numpad, 3 mouse, 4 touchpad, 5 trackball, 6 presenter, 7 receiver.
                byte[] type = hidpp.Request(index, nameIndex, 2);
                if (type != null)
                    route.IsMouse = type[0] == 3 || type[0] == 4 || type[0] == 5;
            }
            return route;
        }

        private static byte GetFeatureIndex(HidppInterface hidpp, byte index, ushort feature)
        {
            byte[] response = hidpp.Request(index, 0x00, 0, (byte)(feature >> 8), (byte)feature);
            return response != null ? response[0] : (byte)0;
        }

        private static bool ReadBattery(HidppInterface hidpp, byte index, Route route, out int percent, out bool charging)
        {
            percent = 0;
            charging = false;

            switch (route.BatteryFeature)
            {
                case FeatureUnifiedBattery:
                {
                    // get_status: state of charge %, level flags, charging status, external power.
                    byte[] r = hidpp.Request(index, route.BatteryIndex, 1);
                    if (r == null)
                        return false;
                    percent = r[0];
                    if (percent == 0 && r[1] != 0)
                        percent = (r[1] & 8) != 0 ? 100 : (r[1] & 4) != 0 ? 50 : (r[1] & 2) != 0 ? 20 : 5;
                    // 0 discharging, 1 charging, 2 charging slowly, 3 complete, 4 error.
                    charging = r[2] >= 1 && r[2] <= 3;
                    break;
                }
                case FeatureBatteryVoltage:
                {
                    byte[] r = hidpp.Request(index, route.BatteryIndex, 0);
                    if (r == null)
                        return false;
                    percent = VoltageToPercent((r[0] << 8) | r[1]);
                    charging = (r[2] & 0x80) != 0;
                    break;
                }
                case FeatureBatteryStatus:
                {
                    // level %, next level %, status (1 recharging, 2 almost full, 3 full, 4 slow recharge).
                    byte[] r = hidpp.Request(index, route.BatteryIndex, 0);
                    if (r == null)
                        return false;
                    percent = r[0];
                    charging = r[2] >= 1 && r[2] <= 4;
                    break;
                }
                default:
                    return false;
            }

            percent = Math.Max(0, Math.Min(100, percent));
            return true;
        }

        private static int VoltageToPercent(int millivolts)
        {
            int last = VoltageCurve.GetLength(0) - 1;
            if (millivolts >= VoltageCurve[0, 0])
                return 100;
            if (millivolts <= VoltageCurve[last, 0])
                return 0;
            for (int i = 0; i < last; i++)
            {
                int vHigh = VoltageCurve[i, 0], pHigh = VoltageCurve[i, 1];
                int vLow = VoltageCurve[i + 1, 0], pLow = VoltageCurve[i + 1, 1];
                if (millivolts <= vHigh && millivolts >= vLow)
                    return (int)Math.Round(pLow + (pHigh - pLow) * (millivolts - vLow) / (double)(vHigh - vLow));
            }
            return 0;
        }

        // ---- Finding and talking to the receiver ----

        /// <summary>The short and long HID++ collections of one Logitech receiver or wired device.</summary>
        private sealed class HidppInterface : IDisposable
        {
            public string ParentId;
            public HidChannel Short;
            public HidChannel Long;

            /// <summary>Sends a HID++ 2.0 request and returns the response parameters, or null on error/timeout.</summary>
            public byte[] Request(byte deviceIndex, byte featureIndex, int function, params byte[] args)
            {
                byte functionByte = (byte)((function << 4) | SoftwareId);
                bool useShort = Short != null && args.Length <= 3;
                HidChannel writer = useShort ? Short : Long;
                if (writer == null)
                    return null;

                var report = new byte[useShort ? 7 : 20];
                report[0] = useShort ? ShortReportId : LongReportId;
                report[1] = deviceIndex;
                report[2] = featureIndex;
                report[3] = functionByte;
                Array.Copy(args, 0, report, 4, Math.Min(args.Length, report.Length - 4));

                // Start listening before writing so a fast reply can't slip past.
                Short?.BeginRead();
                Long?.BeginRead();
                if (!writer.Write(report))
                    return null;

                var waits = new List<HidChannel>();
                if (Short != null) waits.Add(Short);
                if (Long != null) waits.Add(Long);
                var handles = waits.ConvertAll(c => (WaitHandle)c.ReadEvent).ToArray();

                int deadline = Environment.TickCount + RequestTimeoutMs;
                while (true)
                {
                    int remaining = deadline - Environment.TickCount;
                    if (remaining <= 0)
                        return null;
                    int signalled = WaitHandle.WaitAny(handles, remaining);
                    if (signalled == WaitHandle.WaitTimeout)
                        return null;

                    HidChannel channel = waits[signalled];
                    byte[] r = channel.EndRead();
                    channel.BeginRead();
                    if (r == null || r.Length < 7 || r[1] != deviceIndex)
                        continue;

                    // HID++ 1.0 error (unknown device index, device off, ...).
                    if (r[0] == ShortReportId && r[2] == 0x8F && r[3] == featureIndex && r[4] == functionByte)
                        return null;
                    // HID++ 2.0 error.
                    if (r[2] == 0xFF && r[3] == featureIndex && r[4] == functionByte)
                        return null;
                    if (r[2] == featureIndex && r[3] == functionByte)
                    {
                        var result = new byte[16];
                        Array.Copy(r, 4, result, 0, Math.Min(16, r.Length - 4));
                        return result;
                    }
                }
            }

            public void Dispose()
            {
                Short?.Dispose();
                Long?.Dispose();
            }
        }

        private static List<HidppInterface> FindInterfaces()
        {
            var byParent = new Dictionary<string, HidppInterface>(StringComparer.OrdinalIgnoreCase);
            HidD_GetHidGuid(out Guid hidGuid);
            IntPtr set = SetupDiGetClassDevsW(ref hidGuid, null, IntPtr.Zero, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
            if (set == INVALID_HANDLE_VALUE)
                return new List<HidppInterface>();

            try
            {
                var iface = new SP_DEVICE_INTERFACE_DATA { cbSize = (uint)Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA)) };
                for (uint i = 0; SetupDiEnumDeviceInterfaces(set, IntPtr.Zero, ref hidGuid, i, ref iface); i++)
                {
                    var info = new SP_DEVINFO_DATA { cbSize = (uint)Marshal.SizeOf(typeof(SP_DEVINFO_DATA)) };
                    string path = GetInterfacePath(set, ref iface, ref info);
                    if (path == null || path.IndexOf("vid_046d", StringComparison.OrdinalIgnoreCase) < 0)
                        continue;

                    if (!GetCaps(path, out ushort vendor, out HIDP_CAPS caps) || vendor != LogitechVendorId || caps.UsagePage != HidppUsagePage)
                        continue;
                    if (caps.Usage != ShortUsage && caps.Usage != LongUsage)
                        continue;

                    // Both collections hang off the same parent (the USB interface), which pairs them up.
                    string parent = CM_Get_Parent(out uint parentInst, info.DevInst, 0) == 0 ? GetDeviceId(parentInst) : null;
                    if (parent == null)
                        continue;

                    HidChannel channel = HidChannel.Open(path, caps.InputReportByteLength);
                    if (channel == null)
                        continue;

                    if (!byParent.TryGetValue(parent, out HidppInterface hidpp))
                        byParent[parent] = hidpp = new HidppInterface { ParentId = parent };
                    if (caps.Usage == ShortUsage && hidpp.Short == null)
                        hidpp.Short = channel;
                    else if (caps.Usage == LongUsage && hidpp.Long == null)
                        hidpp.Long = channel;
                    else
                        channel.Dispose();
                }
            }
            finally
            {
                SetupDiDestroyDeviceInfoList(set);
            }

            // Replies to HID++ 2.0 requests come back as long reports, so the long collection is required.
            var result = new List<HidppInterface>();
            foreach (HidppInterface hidpp in byParent.Values)
            {
                if (hidpp.Long != null)
                    result.Add(hidpp);
                else
                    hidpp.Dispose();
            }
            return result;
        }

        private static string GetInterfacePath(IntPtr set, ref SP_DEVICE_INTERFACE_DATA iface, ref SP_DEVINFO_DATA info)
        {
            SetupDiGetDeviceInterfaceDetailW(set, ref iface, IntPtr.Zero, 0, out uint size, IntPtr.Zero);
            if (size == 0)
                return null;
            IntPtr buffer = Marshal.AllocHGlobal((int)size);
            try
            {
                // cbSize of SP_DEVICE_INTERFACE_DETAIL_DATA_W: 8 on 64-bit, 6 on 32-bit.
                Marshal.WriteInt32(buffer, IntPtr.Size == 8 ? 8 : 6);
                if (!SetupDiGetDeviceInterfaceDetailW(set, ref iface, buffer, size, out size, ref info))
                    return null;
                return Marshal.PtrToStringUni(IntPtr.Add(buffer, 4));
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }

        private static bool GetCaps(string path, out ushort vendor, out HIDP_CAPS caps)
        {
            vendor = 0;
            caps = default(HIDP_CAPS);
            // No read/write access needed just to look; this works even on collections Windows holds exclusively.
            using (SafeFileHandle h = CreateFileW(path, 0, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero))
            {
                if (h.IsInvalid)
                    return false;
                var attributes = new HIDD_ATTRIBUTES { Size = Marshal.SizeOf(typeof(HIDD_ATTRIBUTES)) };
                if (!HidD_GetAttributes(h, ref attributes))
                    return false;
                vendor = attributes.VendorID;
                if (!HidD_GetPreparsedData(h, out IntPtr preparsed))
                    return false;
                try
                {
                    return HidP_GetCaps(preparsed, out caps) == HIDP_STATUS_SUCCESS;
                }
                finally
                {
                    HidD_FreePreparsedData(preparsed);
                }
            }
        }

        private static string GetDeviceId(uint devInst)
        {
            var sb = new StringBuilder(512);
            return CM_Get_Device_IDW(devInst, sb, sb.Capacity, 0) == 0 ? sb.ToString() : null;
        }

        /// <summary>One HID collection opened for overlapped I/O, so reads can time out.</summary>
        private sealed class HidChannel : IDisposable
        {
            private readonly SafeFileHandle _handle;
            private readonly int _inputLength;
            private readonly IntPtr _readBuffer;
            private readonly IntPtr _readOverlapped;
            private bool _readPending;

            public readonly ManualResetEvent ReadEvent = new ManualResetEvent(false);

            private HidChannel(SafeFileHandle handle, int inputLength)
            {
                _handle = handle;
                _inputLength = inputLength;
                _readBuffer = Marshal.AllocHGlobal(inputLength);
                _readOverlapped = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(NativeOverlapped)));
            }

            public static HidChannel Open(string path, int inputLength)
            {
                SafeFileHandle h = CreateFileW(path, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
                    IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_OVERLAPPED, IntPtr.Zero);
                if (h.IsInvalid || inputLength <= 0)
                {
                    h.Dispose();
                    return null;
                }
                return new HidChannel(h, inputLength);
            }

            public void BeginRead()
            {
                if (_readPending)
                    return;
                ReadEvent.Reset();
                WriteOverlapped(_readOverlapped, ReadEvent);
                if (ReadFile(_handle, _readBuffer, (uint)_inputLength, IntPtr.Zero, _readOverlapped) || Marshal.GetLastWin32Error() == ERROR_IO_PENDING)
                    _readPending = true;
                else
                    ReadEvent.Set(); // Let EndRead report the failure instead of waiting forever.
            }

            /// <summary>Call once ReadEvent is signalled. Returns the report, or null if the read failed.</summary>
            public byte[] EndRead()
            {
                if (!_readPending)
                {
                    ReadEvent.Reset();
                    return null;
                }
                _readPending = false;
                if (!GetOverlappedResult(_handle, _readOverlapped, out uint read, false) || read == 0)
                    return null;
                var data = new byte[read];
                Marshal.Copy(_readBuffer, data, 0, (int)read);
                return data;
            }

            public bool Write(byte[] report)
            {
                IntPtr buffer = Marshal.AllocHGlobal(report.Length);
                IntPtr overlapped = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(NativeOverlapped)));
                using (var done = new ManualResetEvent(false))
                {
                    try
                    {
                        Marshal.Copy(report, 0, buffer, report.Length);
                        WriteOverlapped(overlapped, done);
                        if (!WriteFile(_handle, buffer, (uint)report.Length, IntPtr.Zero, overlapped) && Marshal.GetLastWin32Error() != ERROR_IO_PENDING)
                            return false;
                        if (!done.WaitOne(RequestTimeoutMs))
                        {
                            CancelIoEx(_handle, overlapped);
                            GetOverlappedResult(_handle, overlapped, out _, true);
                            return false;
                        }
                        return GetOverlappedResult(_handle, overlapped, out uint written, false) && written > 0;
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(overlapped);
                        Marshal.FreeHGlobal(buffer);
                    }
                }
            }

            public void Dispose()
            {
                if (_readPending)
                {
                    // The OS still owns the buffer until the cancelled read completes.
                    CancelIoEx(_handle, _readOverlapped);
                    GetOverlappedResult(_handle, _readOverlapped, out _, true);
                    _readPending = false;
                }
                _handle.Dispose();
                ReadEvent.Dispose();
                Marshal.FreeHGlobal(_readBuffer);
                Marshal.FreeHGlobal(_readOverlapped);
            }

            private static void WriteOverlapped(IntPtr target, ManualResetEvent evt)
            {
                var ov = new NativeOverlapped { EventHandle = evt.SafeWaitHandle.DangerousGetHandle() };
                Marshal.StructureToPtr(ov, target, false);
            }
        }

        // ---- Interop ----

        private const uint DIGCF_PRESENT = 0x2;
        private const uint DIGCF_DEVICEINTERFACE = 0x10;
        private const uint GENERIC_READ = 0x80000000;
        private const uint GENERIC_WRITE = 0x40000000;
        private const uint FILE_SHARE_READ = 0x1;
        private const uint FILE_SHARE_WRITE = 0x2;
        private const uint OPEN_EXISTING = 3;
        private const uint FILE_FLAG_OVERLAPPED = 0x40000000;
        private const int ERROR_IO_PENDING = 997;
        private const int HIDP_STATUS_SUCCESS = 0x00110000;
        private static readonly IntPtr INVALID_HANDLE_VALUE = new IntPtr(-1);

        [StructLayout(LayoutKind.Sequential)]
        private struct SP_DEVICE_INTERFACE_DATA
        {
            public uint cbSize;
            public Guid InterfaceClassGuid;
            public uint Flags;
            public IntPtr Reserved;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct SP_DEVINFO_DATA
        {
            public uint cbSize;
            public Guid ClassGuid;
            public uint DevInst;
            public IntPtr Reserved;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct HIDD_ATTRIBUTES
        {
            public int Size;
            public ushort VendorID;
            public ushort ProductID;
            public ushort VersionNumber;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct HIDP_CAPS
        {
            public ushort Usage;
            public ushort UsagePage;
            public ushort InputReportByteLength;
            public ushort OutputReportByteLength;
            public ushort FeatureReportByteLength;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)]
            public ushort[] Reserved;
            public ushort NumberLinkCollectionNodes;
            public ushort NumberInputButtonCaps;
            public ushort NumberInputValueCaps;
            public ushort NumberInputDataIndices;
            public ushort NumberOutputButtonCaps;
            public ushort NumberOutputValueCaps;
            public ushort NumberOutputDataIndices;
            public ushort NumberFeatureButtonCaps;
            public ushort NumberFeatureValueCaps;
            public ushort NumberFeatureDataIndices;
        }

        [DllImport("hid.dll")]
        private static extern void HidD_GetHidGuid(out Guid hidGuid);

        [DllImport("hid.dll")]
        private static extern bool HidD_GetAttributes(SafeFileHandle device, ref HIDD_ATTRIBUTES attributes);

        [DllImport("hid.dll")]
        private static extern bool HidD_GetPreparsedData(SafeFileHandle device, out IntPtr preparsedData);

        [DllImport("hid.dll")]
        private static extern bool HidD_FreePreparsedData(IntPtr preparsedData);

        [DllImport("hid.dll")]
        private static extern int HidP_GetCaps(IntPtr preparsedData, out HIDP_CAPS capabilities);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern IntPtr SetupDiGetClassDevsW(ref Guid classGuid, string enumerator, IntPtr hwndParent, uint flags);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern bool SetupDiEnumDeviceInterfaces(IntPtr deviceInfoSet, IntPtr deviceInfoData, ref Guid interfaceClassGuid,
            uint memberIndex, ref SP_DEVICE_INTERFACE_DATA deviceInterfaceData);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern bool SetupDiGetDeviceInterfaceDetailW(IntPtr deviceInfoSet, ref SP_DEVICE_INTERFACE_DATA deviceInterfaceData,
            IntPtr deviceInterfaceDetailData, uint deviceInterfaceDetailDataSize, out uint requiredSize, IntPtr deviceInfoData);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern bool SetupDiGetDeviceInterfaceDetailW(IntPtr deviceInfoSet, ref SP_DEVICE_INTERFACE_DATA deviceInterfaceData,
            IntPtr deviceInterfaceDetailData, uint deviceInterfaceDetailDataSize, out uint requiredSize, ref SP_DEVINFO_DATA deviceInfoData);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern bool SetupDiDestroyDeviceInfoList(IntPtr deviceInfoSet);

        [DllImport("cfgmgr32.dll")]
        private static extern int CM_Get_Parent(out uint parentDevInst, uint devInst, uint flags);

        [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
        private static extern int CM_Get_Device_IDW(uint devInst, StringBuilder buffer, int bufferLen, uint flags);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern SafeFileHandle CreateFileW(string fileName, uint desiredAccess, uint shareMode, IntPtr securityAttributes,
            uint creationDisposition, uint flagsAndAttributes, IntPtr templateFile);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool ReadFile(SafeFileHandle file, IntPtr buffer, uint numberOfBytesToRead, IntPtr numberOfBytesRead, IntPtr overlapped);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool WriteFile(SafeFileHandle file, IntPtr buffer, uint numberOfBytesToWrite, IntPtr numberOfBytesWritten, IntPtr overlapped);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetOverlappedResult(SafeFileHandle file, IntPtr overlapped, out uint numberOfBytesTransferred, bool wait);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CancelIoEx(SafeFileHandle file, IntPtr overlapped);
    }
}
