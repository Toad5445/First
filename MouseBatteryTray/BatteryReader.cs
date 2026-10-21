using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace MouseBatteryTray
{
    /// <summary>A Bluetooth device that reports a battery level to Windows.</summary>
    internal sealed class BatteryDevice
    {
        public string InstanceId;
        public string Name;
        public int Percent;
        public bool IsMouse;
    }

    /// <summary>
    /// Reads Bluetooth battery levels the same way the Windows Settings app does:
    /// Bluetooth LE devices expose their level as a device property on the device node.
    /// </summary>
    internal static class BatteryReader
    {
        // The property Windows fills from the Bluetooth LE Battery Service (shown in Settings > Bluetooth & devices).
        private static readonly DEVPROPKEY BatteryKey = new DEVPROPKEY(new Guid("104EA319-6EE2-4701-BD47-8DDBF425BBE5"), 2);
        private static readonly DEVPROPKEY FriendlyNameKey = new DEVPROPKEY(new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), 14);
        private static readonly DEVPROPKEY DeviceDescKey = new DEVPROPKEY(new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), 2);
        private static readonly DEVPROPKEY ContainerIdKey = new DEVPROPKEY(new Guid("8c7ed206-3f8a-4827-b3ab-ae9e1faefc6c"), 2);

        private static readonly Guid MouseClassGuid = new Guid("4d36e96f-e325-11ce-bfc1-08002be10318");

        /// <summary>Every connected device that reports a battery level, mice first.</summary>
        public static List<BatteryDevice> GetDevices()
        {
            var batteries = new List<KeyValuePair<Guid, BatteryDevice>>();
            var mouseContainers = new HashSet<Guid>();

            IntPtr set = SetupDiGetClassDevsW(IntPtr.Zero, null, IntPtr.Zero, DIGCF_PRESENT | DIGCF_ALLCLASSES);
            if (set == INVALID_HANDLE_VALUE)
                return new List<BatteryDevice>();

            try
            {
                var info = new SP_DEVINFO_DATA { cbSize = (uint)Marshal.SizeOf(typeof(SP_DEVINFO_DATA)) };
                for (uint i = 0; SetupDiEnumDeviceInfo(set, i, ref info); i++)
                {
                    Guid container = GetGuid(set, ref info, ContainerIdKey);

                    // The battery lives on the Bluetooth node, while the "Mouse" class node is a child
                    // of it. Both share a container id, which is how we know which battery is the mouse.
                    if (info.ClassGuid == MouseClassGuid && container != Guid.Empty)
                        mouseContainers.Add(container);

                    int? level = GetByte(set, ref info, BatteryKey);
                    if (level == null)
                        continue;

                    batteries.Add(new KeyValuePair<Guid, BatteryDevice>(container, new BatteryDevice
                    {
                        InstanceId = GetInstanceId(set, ref info),
                        Name = GetString(set, ref info, FriendlyNameKey) ?? GetString(set, ref info, DeviceDescKey) ?? "Bluetooth device",
                        Percent = Math.Max(0, Math.Min(100, level.Value)),
                    }));
                }
            }
            finally
            {
                SetupDiDestroyDeviceInfoList(set);
            }

            var result = new List<BatteryDevice>();
            foreach (var pair in batteries)
            {
                pair.Value.IsMouse = pair.Key != Guid.Empty && mouseContainers.Contains(pair.Key);
                result.Add(pair.Value);
            }
            result.Sort((a, b) => a.IsMouse == b.IsMouse ? string.Compare(a.Name, b.Name, StringComparison.CurrentCultureIgnoreCase) : (a.IsMouse ? -1 : 1));
            return result;
        }

        private static byte[] GetProperty(IntPtr set, ref SP_DEVINFO_DATA info, DEVPROPKEY key, out uint type)
        {
            SetupDiGetDevicePropertyW(set, ref info, ref key, out type, null, 0, out uint size, 0);
            if (size == 0)
                return null;
            var buffer = new byte[size];
            return SetupDiGetDevicePropertyW(set, ref info, ref key, out type, buffer, size, out size, 0) ? buffer : null;
        }

        private static int? GetByte(IntPtr set, ref SP_DEVINFO_DATA info, DEVPROPKEY key)
        {
            byte[] data = GetProperty(set, ref info, key, out uint type);
            return data != null && type == DEVPROP_TYPE_BYTE && data.Length >= 1 ? data[0] : (int?)null;
        }

        private static string GetString(IntPtr set, ref SP_DEVINFO_DATA info, DEVPROPKEY key)
        {
            byte[] data = GetProperty(set, ref info, key, out uint type);
            if (data == null || type != DEVPROP_TYPE_STRING)
                return null;
            string s = Encoding.Unicode.GetString(data).TrimEnd('\0');
            return s.Length > 0 ? s : null;
        }

        private static Guid GetGuid(IntPtr set, ref SP_DEVINFO_DATA info, DEVPROPKEY key)
        {
            byte[] data = GetProperty(set, ref info, key, out uint type);
            return data != null && type == DEVPROP_TYPE_GUID && data.Length == 16 ? new Guid(data) : Guid.Empty;
        }

        private static string GetInstanceId(IntPtr set, ref SP_DEVINFO_DATA info)
        {
            var sb = new StringBuilder(512);
            return SetupDiGetDeviceInstanceIdW(set, ref info, sb, sb.Capacity, out _) ? sb.ToString() : null;
        }

        // ---- SetupAPI interop ----

        private const uint DIGCF_PRESENT = 0x2;
        private const uint DIGCF_ALLCLASSES = 0x4;
        private const uint DEVPROP_TYPE_GUID = 0x0D;
        private const uint DEVPROP_TYPE_BYTE = 0x03;
        private const uint DEVPROP_TYPE_STRING = 0x12;
        private static readonly IntPtr INVALID_HANDLE_VALUE = new IntPtr(-1);

        [StructLayout(LayoutKind.Sequential)]
        private struct DEVPROPKEY
        {
            public Guid fmtid;
            public uint pid;

            public DEVPROPKEY(Guid fmtid, uint pid)
            {
                this.fmtid = fmtid;
                this.pid = pid;
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct SP_DEVINFO_DATA
        {
            public uint cbSize;
            public Guid ClassGuid;
            public uint DevInst;
            public IntPtr Reserved;
        }

        [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr SetupDiGetClassDevsW(IntPtr classGuid, string enumerator, IntPtr hwndParent, uint flags);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern bool SetupDiEnumDeviceInfo(IntPtr deviceInfoSet, uint memberIndex, ref SP_DEVINFO_DATA deviceInfoData);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern bool SetupDiGetDevicePropertyW(IntPtr deviceInfoSet, ref SP_DEVINFO_DATA deviceInfoData, ref DEVPROPKEY propertyKey,
            out uint propertyType, byte[] propertyBuffer, uint propertyBufferSize, out uint requiredSize, uint flags);

        [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool SetupDiGetDeviceInstanceIdW(IntPtr deviceInfoSet, ref SP_DEVINFO_DATA deviceInfoData,
            StringBuilder deviceInstanceId, int deviceInstanceIdSize, out int requiredSize);

        [DllImport("setupapi.dll", SetLastError = true)]
        private static extern bool SetupDiDestroyDeviceInfoList(IntPtr deviceInfoSet);
    }
}
