using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace MouseBatteryTray
{
    /// <summary>
    /// Draws a horizontal battery glyph in the same flat, single-colour style as the
    /// built-in Windows 11 tray icons (white on a dark taskbar, black on a light one).
    /// </summary>
    internal static class IconRenderer
    {
        public const int LowThreshold = 20;
        public const int CriticalThreshold = 10;

        /// <param name="percent">Battery level 0-100, or null when no device is available.</param>
        public static Icon Render(int? percent, int size, bool lightTaskbar)
        {
            Color glyph = lightTaskbar ? Color.Black : Color.White;
            Color fill = glyph;
            if (percent == null)
            {
                glyph = fill = Color.FromArgb(110, glyph);
            }
            else if (percent <= CriticalThreshold)
            {
                glyph = fill = lightTaskbar ? Color.FromArgb(0xC4, 0x2B, 0x1C) : Color.FromArgb(0xFF, 0x4D, 0x4D);
            }
            else if (percent <= LowThreshold)
            {
                glyph = fill = lightTaskbar ? Color.FromArgb(0xB5, 0x6A, 0x00) : Color.FromArgb(0xFF, 0xB9, 0x00);
            }

            // Layout is designed on a 16px grid and scaled, snapping to whole pixels so it stays crisp.
            float u = size / 16f;
            int stroke = Math.Max(1, (int)Math.Round(u));
            int gap = Math.Max(1, (int)Math.Round(0.75 * u));
            int bodyW = (int)Math.Round(13 * u);
            int bodyH = (int)Math.Round(8 * u);
            int nubW = Math.Max(1, (int)Math.Round(1.5 * u));
            int nubH = Math.Max(2, (int)Math.Round(bodyH * 0.4));
            if ((bodyH - nubH) % 2 != 0)
                nubH++;
            int x0 = (size - (bodyW + nubW)) / 2;
            int y0 = (size - bodyH) / 2;

            using (var bmp = new Bitmap(size, size, System.Drawing.Imaging.PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.Transparent);
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.PixelOffsetMode = PixelOffsetMode.Half;

                    // Outline.
                    float half = stroke / 2f;
                    var outline = new RectangleF(x0 + half, y0 + half, bodyW - stroke, bodyH - stroke);
                    using (var path = RoundedRect(outline, 1.6f * u))
                    using (var pen = new Pen(glyph, stroke))
                        g.DrawPath(pen, path);

                    // Terminal nub on the right.
                    using (var brush = new SolidBrush(glyph))
                        g.FillRectangle(brush, x0 + bodyW, y0 + (bodyH - nubH) / 2, nubW, nubH);

                    // Charge level.
                    if (percent > 0)
                    {
                        int inset = stroke + gap;
                        int innerW = bodyW - 2 * inset;
                        int innerH = bodyH - 2 * inset;
                        int w = Math.Max(1, (int)Math.Round(innerW * percent.Value / 100.0));
                        g.SmoothingMode = SmoothingMode.None;
                        using (var brush = new SolidBrush(fill))
                            g.FillRectangle(brush, x0 + inset, y0 + inset, w, innerH);
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

        private static GraphicsPath RoundedRect(RectangleF r, float radius)
        {
            float d = Math.Min(radius * 2, Math.Min(r.Width, r.Height));
            var path = new GraphicsPath();
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        [DllImport("user32.dll")]
        private static extern bool DestroyIcon(IntPtr hIcon);
    }
}
