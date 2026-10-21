using System;
using System.Drawing;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace MouseBatteryTray
{
    /// <summary>
    /// Draws a pixel-exact battery icon in the same flat, single-colour style as the built-in
    /// Windows tray icons (white on a dark taskbar, black on a light one). Every line sits on whole
    /// pixels so the icon stays sharp at 16px, where anti-aliased shapes and font glyphs go blurry.
    /// </summary>
    internal static class IconRenderer
    {
        public const int LowThreshold = 20;
        public const int CriticalThreshold = 10;

        // Charging bolts as pixel art; the tallest one that fits inside the battery is used.
        private static readonly string[] SmallBolt =
        {
            "...##",
            "..##.",
            ".####",
            "####.",
            ".##..",
            "##...",
        };

        private static readonly string[] LargeBolt =
        {
            "....##",
            "...##.",
            "..##..",
            ".#####",
            "#####.",
            "..##..",
            ".##...",
            "##....",
        };

        /// <param name="percent">Battery level 0-100, or null when no device is available.</param>
        /// <param name="charging">Shows a bolt over a dimmed level; low-battery colours are dropped while charging.</param>
        public static Icon Render(int? percent, bool charging, int size, bool lightTaskbar)
        {
            Color color = lightTaskbar ? Color.Black : Color.White;
            if (percent == null)
                color = Color.FromArgb(110, color);
            else if (!charging && percent <= CriticalThreshold)
                color = lightTaskbar ? Color.FromArgb(0xC4, 0x2B, 0x1C) : Color.FromArgb(0xFF, 0x4D, 0x4D);
            else if (!charging && percent <= LowThreshold)
                color = lightTaskbar ? Color.FromArgb(0xB5, 0x6A, 0x00) : Color.FromArgb(0xFF, 0xB9, 0x00);

            byte[,] alpha = DrawMask(percent ?? 0, charging, size);

            using (var bmp = new Bitmap(size, size, System.Drawing.Imaging.PixelFormat.Format32bppArgb))
            {
                for (int y = 0; y < size; y++)
                {
                    for (int x = 0; x < size; x++)
                    {
                        int a = alpha[x, y] * color.A / 255;
                        bmp.SetPixel(x, y, a == 0 ? Color.Transparent : Color.FromArgb(a, color));
                    }
                }

                IntPtr hIcon = bmp.GetHicon();
                try
                {
                    // Clone so the Icon owns its own handle and we can free the GDI one right away.
                    using (var temp = Icon.FromHandle(hIcon))
                        return (Icon)temp.Clone();
                }
                finally
                {
                    DestroyIcon(hIcon);
                }
            }
        }

        /// <summary>Coverage (0-255) of each pixel. All geometry is in whole pixels.</summary>
        private static byte[,] DrawMask(int percent, bool charging, int size)
        {
            var mask = new byte[size, size];
            void Fill(int x, int y, int w, int h, byte value)
            {
                for (int yy = Math.Max(0, y); yy < Math.Min(size, y + h); yy++)
                    for (int xx = Math.Max(0, x); xx < Math.Min(size, x + w); xx++)
                        mask[xx, yy] = value;
            }

            // At 16px (100% scaling): a 14x8 body with a 1px outline, a 1px terminal and a 10px-wide level bar.
            int stroke = size >= 24 ? 2 : 1;
            int nubW = stroke;
            int bodyW = size - 1 - nubW;
            int bodyH = (int)Math.Round(size * 0.5);
            if ((size - bodyH) % 2 != 0)
                bodyH--;
            int nubH = bodyH / 2;
            if ((bodyH - nubH) % 2 != 0)
                nubH++;
            int x0 = 0;
            int y0 = (size - bodyH) / 2;

            // Outline, with the outer corners softened.
            Fill(x0, y0, bodyW, stroke, 255);
            Fill(x0, y0 + bodyH - stroke, bodyW, stroke, 255);
            Fill(x0, y0, stroke, bodyH, 255);
            Fill(x0 + bodyW - stroke, y0, stroke, bodyH, 255);
            byte corner = stroke == 1 ? (byte)80 : (byte)0;
            mask[x0, y0] = mask[x0 + bodyW - 1, y0] = mask[x0, y0 + bodyH - 1] = mask[x0 + bodyW - 1, y0 + bodyH - 1] = corner;

            // Terminal.
            Fill(x0 + bodyW, y0 + (bodyH - nubH) / 2, nubW, nubH, 255);

            // Level bar, separated from the outline by a gap as wide as the stroke.
            int inset = 2 * stroke;
            int barW = bodyW - 2 * inset;
            int barH = bodyH - 2 * inset;
            int level = percent > 0 ? Math.Max(1, (int)Math.Round(barW * percent / 100.0)) : 0;
            // While charging the bar is dimmed so the bolt on top stays readable.
            Fill(x0 + inset, y0 + inset, level, barH, charging ? (byte)95 : (byte)255);

            if (charging)
            {
                int inner = bodyH - 2 * stroke;
                string[] bolt = inner >= LargeBolt.Length ? LargeBolt : SmallBolt;
                int scale = Math.Max(1, inner / bolt.Length);
                int boltW = bolt[0].Length * scale;
                int boltH = bolt.Length * scale;
                int bx = x0 + (bodyW - boltW) / 2;
                int by = y0 + (bodyH - boltH) / 2;
                for (int row = 0; row < bolt.Length; row++)
                    for (int col = 0; col < bolt[row].Length; col++)
                        if (bolt[row][col] == '#')
                            Fill(bx + col * scale, by + row * scale, scale, scale, 255);
            }

            return mask;
        }

        /// <summary>True when the taskbar uses the light theme (so icons should be dark).</summary>
        public static bool IsLightTaskbar()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                    return key?.GetValue("SystemUsesLightTheme") is int v && v != 0;
            }
            catch
            {
                return false;
            }
        }

        [DllImport("user32.dll")]
        private static extern bool DestroyIcon(IntPtr hIcon);
    }
}
