using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace MouseBatteryTray
{
    /// <summary>
    /// Draws the tray icon using the same battery glyphs as the built-in Windows tray icons
    /// (white on a dark taskbar, black on a light one).
    /// </summary>
    internal static class IconRenderer
    {
        public const int LowThreshold = 20;
        public const int CriticalThreshold = 10;

        /// <param name="percent">Battery level 0-100, or null when no device is available.</param>
        /// <param name="charging">Shows the charging (lightning bolt) glyph; low-battery colours are dropped while charging.</param>
        public static Icon Render(int? percent, bool charging, int size, bool lightTaskbar)
        {
            Color glyph = lightTaskbar ? Color.Black : Color.White;
            Color fill = glyph;
            if (percent == null)
            {
                glyph = fill = Color.FromArgb(110, glyph);
            }
            else if (charging)
            {
                // Keep the normal colour; the bolt is the indication.
            }
            else if (percent <= CriticalThreshold)
            {
                glyph = fill = lightTaskbar ? Color.FromArgb(0xC4, 0x2B, 0x1C) : Color.FromArgb(0xFF, 0x4D, 0x4D);
            }
            else if (percent <= LowThreshold)
            {
                glyph = fill = lightTaskbar ? Color.FromArgb(0xB5, 0x6A, 0x00) : Color.FromArgb(0xFF, 0xB9, 0x00);
            }

            using (var bmp = new Bitmap(size, size, System.Drawing.Imaging.PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.Transparent);
                    if (!DrawSystemGlyph(g, percent, charging, size, glyph))
                        DrawShape(g, percent, charging, size, glyph, fill);
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

        // The battery glyphs Windows itself uses (Segoe Fluent Icons on Windows 11, MDL2 on Windows 10).
        private static readonly string[] IconFonts = { "Segoe Fluent Icons", "Segoe MDL2 Assets" };
        private const char BatteryUnknown = '\uE996';

        private static FontFamily _iconFont;
        private static bool _iconFontLooked;

        /// <summary>Draws the system battery glyph for this level. Returns false if the icon font isn't installed.</summary>
        private static bool DrawSystemGlyph(Graphics g, int? percent, bool charging, int size, Color color)
        {
            FontFamily family = GetIconFont();
            if (family == null)
                return false;

            string text = GlyphFor(percent, charging).ToString();
            using (var format = (StringFormat)StringFormat.GenericTypographic.Clone())
            using (var font = new Font(family, size, FontStyle.Regular, GraphicsUnit.Pixel))
            using (var brush = new SolidBrush(color))
            {
                // Centre on the full battery outline (same for every level) and snap to whole pixels so the
                // font's hinting keeps the lines sharp.
                RectangleF bounds;
                using (var path = new GraphicsPath())
                {
                    path.AddString(GlyphFor(100, false).ToString(), family, (int)FontStyle.Regular, size, PointF.Empty, format);
                    bounds = path.GetBounds();
                }
                float x = (float)Math.Round((size - bounds.Width) / 2 - bounds.X);
                float y = (float)Math.Round((size - bounds.Height) / 2 - bounds.Y);

                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.DrawString(text, font, brush, x, y, format);
            }
            return true;
        }

        private static char GlyphFor(int? percent, bool charging)
        {
            if (percent == null)
                return BatteryUnknown;

            // One bar per 10%, but never show an empty battery while there is charge left.
            int level = Math.Min(10, (percent.Value + 5) / 10);
            if (level == 0 && percent > 0)
                level = 1;

            if (charging)
                return level == 10 ? '\uEA93' : level == 9 ? '\uE83E' : (char)(0xE85A + level);
            return level == 10 ? '\uE83F' : (char)(0xE850 + level);
        }

        private static FontFamily GetIconFont()
        {
            if (!_iconFontLooked)
            {
                _iconFontLooked = true;
                foreach (string name in IconFonts)
                {
                    try
                    {
                        // FontFamily throws when the font isn't installed rather than substituting another.
                        _iconFont = new FontFamily(name);
                        break;
                    }
                    catch (ArgumentException)
                    {
                    }
                }
            }
            return _iconFont;
        }

        /// <summary>Hand-drawn fallback for systems without the icon font.</summary>
        private static void DrawShape(Graphics g, int? percent, bool charging, int size, Color glyph, Color fill)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.Half;

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

            if (charging)
                DrawBolt(g, glyph, u, x0 + bodyW - 1.5f * u, y0 + bodyH - 1f * u);
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

        /// <summary>
        /// Small lightning bolt badge on the battery's bottom-right corner, with a transparent outline
        /// cut around it so it stays readable on top of the outline while the fill level stays visible.
        /// </summary>
        private static void DrawBolt(Graphics g, Color color, float u, float cx, float cy)
        {
            // Bolt shape on the 16px grid, relative to its centre, shrunk to badge size.
            float scale = 0.62f * u;
            var points = new[]
            {
                new PointF(1.0f, -5.5f), new PointF(-3.0f, 0.5f), new PointF(-0.2f, 0.5f),
                new PointF(-1.0f, 5.5f), new PointF(3.0f, -0.5f), new PointF(0.2f, -0.5f),
            };
            for (int i = 0; i < points.Length; i++)
                points[i] = new PointF(cx + points[i].X * scale, cy + points[i].Y * scale);

            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var path = new GraphicsPath())
            {
                path.AddPolygon(points);

                CompositingMode previous = g.CompositingMode;
                g.CompositingMode = CompositingMode.SourceCopy;
                using (var knockout = new Pen(Color.Transparent, 2f * u) { LineJoin = LineJoin.Round })
                    g.DrawPath(knockout, path);
                g.CompositingMode = previous;

                using (var brush = new SolidBrush(color))
                    g.FillPath(brush, path);
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
