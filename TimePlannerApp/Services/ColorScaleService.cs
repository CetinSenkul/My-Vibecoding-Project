using System.Windows.Media;
using System.Windows.Media.Effects;

namespace TimePlannerApp.Services;

public enum PerformanceTier
{
    Zero,    // %0        -> Siyah (#121212)
    Red,     // %1 - %50  -> Kırmızı (#E53935)
    Orange,  // %50 - %70 -> Turuncu (#FB8C00)
    Yellow,  // %70 - %90 -> Sarı (#FDD835)
    Green,   // %90 - %110 -> Yeşil (#43A047)
    Blue     // %110+     -> Mavi (#1E88E5)
}

public sealed class PerformanceColorInfo
{
    public PerformanceTier Tier { get; init; }
    public string TierLabel { get; init; } = string.Empty;
    public string PrimaryHex { get; init; } = "#121212";
    public Color PrimaryColor { get; init; }
    public Color SurfaceColor { get; init; }
    public Color BorderColor { get; init; }
    public Color AccentTextColor { get; init; }
    public double GlowBlurRadius { get; init; }
    public double GlowOpacity { get; init; }

    public SolidColorBrush CreatePrimaryBrush() => CreateFrozenBrush(PrimaryColor);
    public SolidColorBrush CreateSurfaceBrush() => CreateFrozenBrush(SurfaceColor);
    public SolidColorBrush CreateBorderBrush() => CreateFrozenBrush(BorderColor);
    public SolidColorBrush CreateAccentTextBrush() => CreateFrozenBrush(AccentTextColor);

    public DropShadowEffect? CreateGlowEffect(double opacityScale = 1.0)
    {
        if (Tier == PerformanceTier.Zero || GlowOpacity <= 0)
        {
            return null;
        }

        return new DropShadowEffect
        {
            Color = PrimaryColor,
            BlurRadius = GlowBlurRadius,
            ShadowDepth = 0,
            Opacity = Math.Clamp(GlowOpacity * opacityScale, 0.0, 1.0)
        };
    }

    private static SolidColorBrush CreateFrozenBrush(Color color)
    {
        var brush = new SolidColorBrush(color);
        brush.Freeze();
        return brush;
    }
}

public static class ColorScaleService
{
    /// <summary>
    /// Gerçekleşen saniye ve hedef dakikaya göre tamamlanma yüzdesini hesaplar.
    /// </summary>
    public static double CalculateCompletionPercent(int actualSeconds, int targetMinutes)
    {
        if (actualSeconds <= 0)
        {
            return 0.0;
        }

        if (targetMinutes <= 0)
        {
            return 110.0;
        }

        return (actualSeconds / 60.0) / targetMinutes * 100.0;
    }

    /// <summary>
    /// Sınır değerlerde bir üst dilim geçerlidir:
    /// %0 Siyah | (0, 50) Kırmızı | [50, 70) Turuncu | [70, 90) Sarı | [90, 110) Yeşil | [110, ∞) Mavi
    /// </summary>
    public static PerformanceTier GetTier(double completionPercent)
    {
        if (completionPercent <= 0.0)
        {
            return PerformanceTier.Zero;
        }

        if (completionPercent < 50.0)
        {
            return PerformanceTier.Red;
        }

        if (completionPercent < 70.0)
        {
            return PerformanceTier.Orange;
        }

        if (completionPercent < 90.0)
        {
            return PerformanceTier.Yellow;
        }

        if (completionPercent < 110.0)
        {
            return PerformanceTier.Green;
        }

        return PerformanceTier.Blue;
    }

    public static PerformanceColorInfo GetColorInfo(double completionPercent)
    {
        return GetColorInfo(GetTier(completionPercent));
    }

    public static PerformanceColorInfo GetColorInfo(int actualSeconds, int targetMinutes)
    {
        var percent = CalculateCompletionPercent(actualSeconds, targetMinutes);
        return GetColorInfo(GetTier(percent));
    }

    public static PerformanceColorInfo GetColorInfo(PerformanceTier tier)
    {
        if (ThemeService.IsLightTheme)
        {
            return GetLightThemeColorInfo(tier);
        }

        return tier switch
        {
            PerformanceTier.Red => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Red,
                TierLabel = "Kırmızı (%1–%50)",
                PrimaryHex = "#E53935",
                PrimaryColor = Color.FromRgb(0xE5, 0x39, 0x35),
                SurfaceColor = Color.FromRgb(0x46, 0x1A, 0x1F),
                BorderColor = Color.FromRgb(0xC9, 0x38, 0x35),
                AccentTextColor = Color.FromRgb(0xFC, 0xA5, 0xA5),
                GlowBlurRadius = 14,
                GlowOpacity = 0.40
            },
            PerformanceTier.Orange => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Orange,
                TierLabel = "Turuncu (%50–%70)",
                PrimaryHex = "#FB8C00",
                PrimaryColor = Color.FromRgb(0xFB, 0x8C, 0x00),
                SurfaceColor = Color.FromRgb(0x4A, 0x2D, 0x12),
                BorderColor = Color.FromRgb(0xDF, 0x7E, 0x08),
                AccentTextColor = Color.FromRgb(0xFD, 0xBA, 0x74),
                GlowBlurRadius = 14,
                GlowOpacity = 0.42
            },
            PerformanceTier.Yellow => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Yellow,
                TierLabel = "Sarı (%70–%90)",
                PrimaryHex = "#FDD835",
                PrimaryColor = Color.FromRgb(0xFD, 0xD8, 0x35),
                SurfaceColor = Color.FromRgb(0x47, 0x3F, 0x14),
                BorderColor = Color.FromRgb(0xDC, 0xBA, 0x26),
                AccentTextColor = Color.FromRgb(0xFD, 0xE0, 0x47),
                GlowBlurRadius = 15,
                GlowOpacity = 0.44
            },
            PerformanceTier.Green => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Green,
                TierLabel = "Yeşil (%90–%110)",
                PrimaryHex = "#43A047",
                PrimaryColor = Color.FromRgb(0x43, 0xA0, 0x47),
                SurfaceColor = Color.FromRgb(0x17, 0x3E, 0x24),
                BorderColor = Color.FromRgb(0x43, 0xA0, 0x47),
                AccentTextColor = Color.FromRgb(0x86, 0xEF, 0xAC),
                GlowBlurRadius = 16,
                GlowOpacity = 0.50
            },
            PerformanceTier.Blue => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Blue,
                TierLabel = "Mavi (%110+)",
                PrimaryHex = "#1E88E5",
                PrimaryColor = Color.FromRgb(0x1E, 0x88, 0xE5),
                SurfaceColor = Color.FromRgb(0x14, 0x34, 0x56),
                BorderColor = Color.FromRgb(0x1E, 0x88, 0xE5),
                AccentTextColor = Color.FromRgb(0x93, 0xC5, 0xFD),
                GlowBlurRadius = 18,
                GlowOpacity = 0.56
            },
            _ => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Zero,
                TierLabel = "Siyah (%0)",
                PrimaryHex = "#121212",
                PrimaryColor = Color.FromRgb(0x12, 0x12, 0x12),
                SurfaceColor = ThemeService.CurrentPalette.BgCellZero,
                BorderColor = ThemeService.CurrentPalette.BorderCellZero,
                AccentTextColor = ThemeService.CurrentPalette.TextSecondary,
                GlowBlurRadius = 0,
                GlowOpacity = 0
            }
        };
    }

    private static PerformanceColorInfo GetLightThemeColorInfo(PerformanceTier tier)
    {
        return tier switch
        {
            PerformanceTier.Red => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Red,
                TierLabel = "Kırmızı (%1–%50)",
                PrimaryHex = "#E53935",
                PrimaryColor = Color.FromRgb(0xE5, 0x39, 0x35),
                SurfaceColor = Color.FromRgb(0xFE, 0xE2, 0xE2),
                BorderColor = Color.FromRgb(0xE5, 0x39, 0x35),
                AccentTextColor = Color.FromRgb(0xB9, 0x1C, 0x1C),
                GlowBlurRadius = 10,
                GlowOpacity = 0.28
            },
            PerformanceTier.Orange => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Orange,
                TierLabel = "Turuncu (%50–%70)",
                PrimaryHex = "#FB8C00",
                PrimaryColor = Color.FromRgb(0xFB, 0x8C, 0x00),
                SurfaceColor = Color.FromRgb(0xFF, 0xED, 0xD5),
                BorderColor = Color.FromRgb(0xEA, 0x76, 0x00),
                AccentTextColor = Color.FromRgb(0xC2, 0x41, 0x0C),
                GlowBlurRadius = 10,
                GlowOpacity = 0.28
            },
            PerformanceTier.Yellow => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Yellow,
                TierLabel = "Sarı (%70–%90)",
                PrimaryHex = "#FDD835",
                PrimaryColor = Color.FromRgb(0xE5, 0xB8, 0x00),
                SurfaceColor = Color.FromRgb(0xFE, 0xF9, 0xC3),
                BorderColor = Color.FromRgb(0xCA, 0x8A, 0x04),
                AccentTextColor = Color.FromRgb(0x85, 0x4D, 0x0E),
                GlowBlurRadius = 10,
                GlowOpacity = 0.30
            },
            PerformanceTier.Green => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Green,
                TierLabel = "Yeşil (%90–%110)",
                PrimaryHex = "#43A047",
                PrimaryColor = Color.FromRgb(0x43, 0xA0, 0x47),
                SurfaceColor = Color.FromRgb(0xDC, 0xFC, 0xE7),
                BorderColor = Color.FromRgb(0x2E, 0x8B, 0x38),
                AccentTextColor = Color.FromRgb(0x16, 0x65, 0x34),
                GlowBlurRadius = 12,
                GlowOpacity = 0.32
            },
            PerformanceTier.Blue => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Blue,
                TierLabel = "Mavi (%110+)",
                PrimaryHex = "#1E88E5",
                PrimaryColor = Color.FromRgb(0x1E, 0x88, 0xE5),
                SurfaceColor = Color.FromRgb(0xDB, 0xEA, 0xFE),
                BorderColor = Color.FromRgb(0x1E, 0x88, 0xE5),
                AccentTextColor = Color.FromRgb(0x1E, 0x40, 0xAF),
                GlowBlurRadius = 14,
                GlowOpacity = 0.36
            },
            _ => new PerformanceColorInfo
            {
                Tier = PerformanceTier.Zero,
                TierLabel = "Siyah (%0)",
                PrimaryHex = "#121212",
                PrimaryColor = Color.FromRgb(0x12, 0x12, 0x12),
                SurfaceColor = Color.FromRgb(0xF1, 0xF5, 0xF9),
                BorderColor = Color.FromRgb(0xCB, 0xD5, 0xE1),
                AccentTextColor = Color.FromRgb(0x64, 0x74, 0x8B),
                GlowBlurRadius = 0,
                GlowOpacity = 0
            }
        };
    }
}
