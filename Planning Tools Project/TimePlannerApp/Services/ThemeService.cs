using System.Windows;
using System.Windows.Media;

namespace TimePlannerApp.Services;

public enum AppThemeMode
{
    Dark,
    Light,
    Space,
    Seasons
}

public enum SeasonKind
{
    Spring, // Mart, Nisan, Mayıs
    Summer, // Haziran, Temmuz, Ağustos
    Autumn, // Eylül, Ekim, Kasım
    Winter  // Aralık, Ocak, Şubat
}

public sealed class ThemePalette
{
    public bool IsLight { get; init; }
    public bool IsSpace { get; init; }
    public string DisplaySubtitle { get; init; } = string.Empty;

    public Color BgDeep { get; init; }
    public Color BgTitleBar { get; init; }
    public Color BgSidebar { get; init; }
    public Color BgPanel { get; init; }
    public Color BgCard { get; init; }
    public Color BgInput { get; init; }
    public Color BgCellZero { get; init; }
    public Color BgMutedCell { get; init; }
    public Color BgSegmentTrack { get; init; }

    public Color BorderSubtle { get; init; }
    public Color BorderCellZero { get; init; }
    public Color BorderActive { get; init; }

    public Color TextPrimary { get; init; }
    public Color TextSecondary { get; init; }
    public Color TextMuted { get; init; }

    public Color Accent { get; init; }
    public Color AccentSurface { get; init; }
    public Color AccentText { get; init; }

    public Color NavActiveBg { get; init; }
    public Color NavHoverBg { get; init; }

    public Color DayOffBg { get; init; }
    public Color DayOffBorder { get; init; }
    public Color DayOffText { get; init; }
    public Color DayOffBadgeBg { get; init; }

    public Color DbStatusBg { get; init; }
    public Color DbStatusBorder { get; init; }
    public Color DbStatusText { get; init; }

    public Color TooltipBg { get; init; }
    public Color ChartSeparator { get; init; }
    public Color ChartLabel { get; init; }
    public Color ScrollThumb { get; init; }
}

public static class ThemeService
{
    private const string ThemeSettingKey = "SelectedTheme";

    public static AppThemeMode CurrentMode { get; private set; } = AppThemeMode.Dark;
    public static int ActiveCalendarMonth { get; private set; } = DateTime.Today.Month;
    public static ThemePalette CurrentPalette { get; private set; } = BuildPalette(AppThemeMode.Dark, DateTime.Today.Month);
    public static bool IsLightTheme => CurrentPalette.IsLight;

    public static event Action? ThemeChanged;

    public static void LoadSavedTheme()
    {
        var saved = App.Database?.GetSetting(ThemeSettingKey, nameof(AppThemeMode.Dark)) ?? nameof(AppThemeMode.Dark);
        if (!Enum.TryParse<AppThemeMode>(saved, ignoreCase: true, out var mode))
        {
            mode = AppThemeMode.Dark;
        }

        ApplyTheme(mode, DateTime.Today.Month, persist: false);
    }

    public static void ApplyTheme(AppThemeMode mode, int? calendarMonth = null, bool persist = true)
    {
        CurrentMode = mode;
        if (calendarMonth.HasValue && calendarMonth.Value >= 1 && calendarMonth.Value <= 12)
        {
            ActiveCalendarMonth = calendarMonth.Value;
        }

        CurrentPalette = BuildPalette(CurrentMode, ActiveCalendarMonth);

        if (persist && App.Database != null)
        {
            App.Database.SetSetting(ThemeSettingKey, mode.ToString());
        }

        PushToApplicationResources(CurrentPalette);
        ThemeChanged?.Invoke();
    }

    public static void UpdateCalendarMonth(int month)
    {
        if (month < 1 || month > 12)
        {
            return;
        }

        var prevSeason = GetSeasonForMonth(ActiveCalendarMonth);
        ActiveCalendarMonth = month;

        if (CurrentMode == AppThemeMode.Seasons)
        {
            var newSeason = GetSeasonForMonth(month);
            if (newSeason != prevSeason)
            {
                CurrentPalette = BuildPalette(AppThemeMode.Seasons, month);
                PushToApplicationResources(CurrentPalette);
                ThemeChanged?.Invoke();
            }
        }
    }

    public static SeasonKind GetSeasonForMonth(int month) => month switch
    {
        3 or 4 or 5 => SeasonKind.Spring,
        6 or 7 or 8 => SeasonKind.Summer,
        9 or 10 or 11 => SeasonKind.Autumn,
        _ => SeasonKind.Winter
    };

    public static string GetSeasonTurkishName(SeasonKind season) => season switch
    {
        SeasonKind.Spring => "İlkbahar",
        SeasonKind.Summer => "Yaz",
        SeasonKind.Autumn => "Sonbahar",
        _ => "Kış"
    };

    public static string GetModeDisplayName(AppThemeMode mode) => mode switch
    {
        AppThemeMode.Light => "Aydınlık",
        AppThemeMode.Space => "Uzay",
        AppThemeMode.Seasons => $"Mevsimler ({GetSeasonTurkishName(GetSeasonForMonth(ActiveCalendarMonth))})",
        _ => "Karanlık"
    };

    public static SolidColorBrush Brush(Color c)
    {
        var b = new SolidColorBrush(c);
        b.Freeze();
        return b;
    }

    private static void PushToApplicationResources(ThemePalette p)
    {
        var res = Application.Current?.Resources;
        if (res == null)
        {
            return;
        }

        res["BgDeepBrush"] = Brush(p.BgDeep);
        res["BgTitleBarBrush"] = Brush(p.BgTitleBar);
        res["BgSidebarBrush"] = Brush(p.BgSidebar);
        res["BgPanelBrush"] = Brush(p.BgPanel);
        res["BgCardBrush"] = Brush(p.BgCard);
        res["BgInputBrush"] = Brush(p.BgInput);
        res["BgCellZeroBrush"] = Brush(p.BgCellZero);
        res["BgMutedCellBrush"] = Brush(p.BgMutedCell);
        res["BgSegmentTrackBrush"] = Brush(p.BgSegmentTrack);

        res["BorderSubtleBrush"] = Brush(p.BorderSubtle);
        res["BorderCellZeroBrush"] = Brush(p.BorderCellZero);
        res["BorderActiveBrush"] = Brush(p.BorderActive);

        res["TextPrimaryBrush"] = Brush(p.TextPrimary);
        res["TextSecondaryBrush"] = Brush(p.TextSecondary);
        res["TextMutedBrush"] = Brush(p.TextMuted);

        res["AccentBlueBrush"] = Brush(p.Accent);
        res["AccentBlueSurfaceBrush"] = Brush(p.AccentSurface);
        res["AccentTextBrush"] = Brush(p.AccentText);

        res["NavActiveBgBrush"] = Brush(p.NavActiveBg);
        res["NavHoverBgBrush"] = Brush(p.NavHoverBg);

        res["DayOffBgBrush"] = Brush(p.DayOffBg);
        res["DayOffBorderBrush"] = Brush(p.DayOffBorder);
        res["DayOffTextBrush"] = Brush(p.DayOffText);

        res["DbStatusBgBrush"] = Brush(p.DbStatusBg);
        res["DbStatusBorderBrush"] = Brush(p.DbStatusBorder);
        res["DbStatusTextBrush"] = Brush(p.DbStatusText);

        res["TooltipBgBrush"] = Brush(p.TooltipBg);
        res["ScrollThumbBrush"] = Brush(p.ScrollThumb);
    }

    public static ThemePalette BuildPalette(AppThemeMode mode, int month)
    {
        return mode switch
        {
            AppThemeMode.Light => BuildLightPalette(),
            AppThemeMode.Space => BuildSpacePalette(),
            AppThemeMode.Seasons => BuildSeasonPalette(GetSeasonForMonth(month)),
            _ => BuildDarkPalette()
        };
    }

    private static ThemePalette BuildDarkPalette() => new()
    {
        IsLight = false,
        IsSpace = false,
        DisplaySubtitle = "Karanlık",
        BgDeep = Rgb(0x0B, 0x0F, 0x17),
        BgTitleBar = Rgb(0x0E, 0x13, 0x1D),
        BgSidebar = Rgb(0x10, 0x16, 0x22),
        BgPanel = Rgb(0x13, 0x1A, 0x27),
        BgCard = Rgb(0x17, 0x20, 0x30),
        BgInput = Rgb(0x0E, 0x14, 0x20),
        BgCellZero = Rgb(0x12, 0x12, 0x12),
        BgMutedCell = Rgb(0x0E, 0x13, 0x1C),
        BgSegmentTrack = Rgb(0x0E, 0x14, 0x20),
        BorderSubtle = Rgb(0x1F, 0x2A, 0x3C),
        BorderCellZero = Rgb(0x28, 0x33, 0x47),
        BorderActive = Rgb(0x3B, 0x6C, 0xB7),
        TextPrimary = Rgb(0xF1, 0xF5, 0xF9),
        TextSecondary = Rgb(0x94, 0xA3, 0xB8),
        TextMuted = Rgb(0x47, 0x55, 0x69),
        Accent = Rgb(0x5B, 0x9B, 0xF8),
        AccentSurface = Rgb(0x1B, 0x2B, 0x45),
        AccentText = Rgb(0x93, 0xC5, 0xFD),
        NavActiveBg = Rgb(0x1B, 0x2B, 0x45),
        NavHoverBg = Rgb(0x17, 0x21, 0x33),
        DayOffBg = Rgb(0x32, 0x37, 0x41),
        DayOffBorder = Rgb(0x64, 0x6E, 0x82),
        DayOffText = Rgb(0xE2, 0xE8, 0xF0),
        DayOffBadgeBg = Rgb(0x25, 0x2A, 0x33),
        DbStatusBg = Rgb(0x0E, 0x22, 0x19),
        DbStatusBorder = Rgb(0x1D, 0x4A, 0x34),
        DbStatusText = Rgb(0x6E, 0xE7, 0xB7),
        TooltipBg = Color.FromArgb(0xF5, 0x0D, 0x14, 0x22),
        ChartSeparator = Rgb(0x1E, 0x29, 0x3B),
        ChartLabel = Rgb(0x94, 0xA3, 0xB8),
        ScrollThumb = Rgb(0x2A, 0x39, 0x52)
    };

    private static ThemePalette BuildLightPalette() => new()
    {
        IsLight = true,
        IsSpace = false,
        DisplaySubtitle = "Aydınlık",
        BgDeep = Rgb(0xEE, 0xF2, 0xF7),
        BgTitleBar = Rgb(0xFF, 0xFF, 0xFF),
        BgSidebar = Rgb(0xF8, 0xFA, 0xFC),
        BgPanel = Rgb(0xFF, 0xFF, 0xFF),
        BgCard = Rgb(0xF4, 0xF7, 0xFB),
        BgInput = Rgb(0xF8, 0xFA, 0xFC),
        BgCellZero = Rgb(0xF1, 0xF5, 0xF9),
        BgMutedCell = Rgb(0xE8, 0xED, 0xF4),
        BgSegmentTrack = Rgb(0xE8, 0xEE, 0xF6),
        BorderSubtle = Rgb(0xD5, 0xDE, 0xEA),
        BorderCellZero = Rgb(0xCB, 0xD5, 0xE1),
        BorderActive = Rgb(0x25, 0x63, 0xEB),
        TextPrimary = Rgb(0x0F, 0x17, 0x2A),
        TextSecondary = Rgb(0x47, 0x55, 0x69),
        TextMuted = Rgb(0x94, 0xA3, 0xB8),
        Accent = Rgb(0x25, 0x63, 0xEB),
        AccentSurface = Rgb(0xDB, 0xEA, 0xFE),
        AccentText = Rgb(0x1D, 0x4E, 0xD8),
        NavActiveBg = Rgb(0xDB, 0xEA, 0xFE),
        NavHoverBg = Rgb(0xEB, 0xF1, 0xF8),
        DayOffBg = Rgb(0xD1, 0xD5, 0xDB),
        DayOffBorder = Rgb(0x9C, 0xA3, 0xAF),
        DayOffText = Rgb(0x1F, 0x29, 0x37),
        DayOffBadgeBg = Rgb(0xE5, 0xE7, 0xEB),
        DbStatusBg = Rgb(0xEC, 0xFD, 0xF5),
        DbStatusBorder = Rgb(0x6E, 0xE7, 0xB7),
        DbStatusText = Rgb(0x04, 0x78, 0x57),
        TooltipBg = Color.FromArgb(0xFA, 0xFF, 0xFF, 0xFF),
        ChartSeparator = Rgb(0xE2, 0xE8, 0xF0),
        ChartLabel = Rgb(0x47, 0x55, 0x69),
        ScrollThumb = Rgb(0xBD, 0xC8, 0xD8)
    };

    private static ThemePalette BuildSpacePalette() => new()
    {
        IsLight = false,
        IsSpace = true,
        DisplaySubtitle = "Uzay",
        BgDeep = Rgb(0x06, 0x07, 0x16),
        BgTitleBar = Rgb(0x0A, 0x0B, 0x20),
        BgSidebar = Color.FromArgb(0xE8, 0x0C, 0x0E, 0x26),
        BgPanel = Color.FromArgb(0xE6, 0x11, 0x13, 0x30),
        BgCard = Color.FromArgb(0xEC, 0x17, 0x1A, 0x3E),
        BgInput = Rgb(0x0B, 0x0D, 0x24),
        BgCellZero = Color.FromArgb(0xDD, 0x10, 0x11, 0x24),
        BgMutedCell = Color.FromArgb(0xBB, 0x0B, 0x0C, 0x1C),
        BgSegmentTrack = Rgb(0x0C, 0x0E, 0x26),
        BorderSubtle = Rgb(0x28, 0x29, 0x56),
        BorderCellZero = Rgb(0x34, 0x36, 0x6B),
        BorderActive = Rgb(0x8B, 0x5C, 0xF6),
        TextPrimary = Rgb(0xF3, 0xF4, 0xFF),
        TextSecondary = Rgb(0xA5, 0xB4, 0xFC),
        TextMuted = Rgb(0x5B, 0x61, 0x8F),
        Accent = Rgb(0xA7, 0x8B, 0xFA),
        AccentSurface = Rgb(0x24, 0x1D, 0x4D),
        AccentText = Rgb(0xC4, 0xB5, 0xFD),
        NavActiveBg = Rgb(0x25, 0x1E, 0x52),
        NavHoverBg = Rgb(0x1A, 0x19, 0x40),
        DayOffBg = Rgb(0x32, 0x37, 0x41),
        DayOffBorder = Rgb(0x64, 0x6E, 0x82),
        DayOffText = Rgb(0xE2, 0xE8, 0xF0),
        DayOffBadgeBg = Rgb(0x25, 0x2A, 0x33),
        DbStatusBg = Rgb(0x12, 0x23, 0x30),
        DbStatusBorder = Rgb(0x2E, 0x5A, 0x7A),
        DbStatusText = Rgb(0x7D, 0xD3, 0xFC),
        TooltipBg = Color.FromArgb(0xF6, 0x0D, 0x0E, 0x28),
        ChartSeparator = Rgb(0x23, 0x25, 0x4D),
        ChartLabel = Rgb(0xA5, 0xB4, 0xFC),
        ScrollThumb = Rgb(0x3B, 0x3C, 0x75)
    };

    private static ThemePalette BuildSeasonPalette(SeasonKind season) => season switch
    {
        // İlkbahar: Adaçayı yeşili & pastel bahar vurguları
        SeasonKind.Spring => new()
        {
            IsLight = false,
            IsSpace = false,
            DisplaySubtitle = "İlkbahar",
            BgDeep = Rgb(0x0D, 0x15, 0x12),
            BgTitleBar = Rgb(0x10, 0x1A, 0x16),
            BgSidebar = Rgb(0x12, 0x1E, 0x19),
            BgPanel = Rgb(0x16, 0x24, 0x1E),
            BgCard = Rgb(0x1C, 0x2E, 0x26),
            BgInput = Rgb(0x10, 0x1B, 0x17),
            BgCellZero = Rgb(0x12, 0x16, 0x14),
            BgMutedCell = Rgb(0x0F, 0x17, 0x14),
            BgSegmentTrack = Rgb(0x10, 0x1B, 0x17),
            BorderSubtle = Rgb(0x26, 0x3D, 0x33),
            BorderCellZero = Rgb(0x2F, 0x47, 0x3C),
            BorderActive = Rgb(0x52, 0xB7, 0x88),
            TextPrimary = Rgb(0xEC, 0xFD, 0xF5),
            TextSecondary = Rgb(0x9C, 0xC5, 0xB4),
            TextMuted = Rgb(0x55, 0x75, 0x67),
            Accent = Rgb(0x6E, 0xE7, 0xB7),
            AccentSurface = Rgb(0x1C, 0x3D, 0x2E),
            AccentText = Rgb(0xA7, 0xF3, 0xD0),
            NavActiveBg = Rgb(0x1C, 0x3D, 0x2E),
            NavHoverBg = Rgb(0x1A, 0x2E, 0x25),
            DayOffBg = Rgb(0x32, 0x37, 0x41),
            DayOffBorder = Rgb(0x64, 0x6E, 0x82),
            DayOffText = Rgb(0xE2, 0xE8, 0xF0),
            DayOffBadgeBg = Rgb(0x25, 0x2A, 0x33),
            DbStatusBg = Rgb(0x14, 0x33, 0x24),
            DbStatusBorder = Rgb(0x34, 0x78, 0x57),
            DbStatusText = Rgb(0x86, 0xEF, 0xAC),
            TooltipBg = Color.FromArgb(0xF5, 0x0F, 0x1C, 0x17),
            ChartSeparator = Rgb(0x22, 0x38, 0x2E),
            ChartLabel = Rgb(0x9C, 0xC5, 0xB4),
            ScrollThumb = Rgb(0x32, 0x52, 0x44)
        },

        // Yaz: Ferah okyanus turkuazı & sıcak güneş sarısı
        SeasonKind.Summer => new()
        {
            IsLight = false,
            IsSpace = false,
            DisplaySubtitle = "Yaz",
            BgDeep = Rgb(0x08, 0x15, 0x1D),
            BgTitleBar = Rgb(0x0B, 0x1B, 0x24),
            BgSidebar = Rgb(0x0D, 0x20, 0x2B),
            BgPanel = Rgb(0x10, 0x26, 0x33),
            BgCard = Rgb(0x15, 0x31, 0x40),
            BgInput = Rgb(0x0B, 0x1C, 0x26),
            BgCellZero = Rgb(0x10, 0x17, 0x1C),
            BgMutedCell = Rgb(0x0B, 0x19, 0x21),
            BgSegmentTrack = Rgb(0x0B, 0x1C, 0x26),
            BorderSubtle = Rgb(0x1D, 0x3E, 0x50),
            BorderCellZero = Rgb(0x25, 0x4B, 0x60),
            BorderActive = Rgb(0x22, 0xD3, 0xEE),
            TextPrimary = Rgb(0xEC, 0xFE, 0xFF),
            TextSecondary = Rgb(0x94, 0xC6, 0xD4),
            TextMuted = Rgb(0x4D, 0x79, 0x8A),
            Accent = Rgb(0x22, 0xD3, 0xEE),
            AccentSurface = Rgb(0x12, 0x3E, 0x4D),
            AccentText = Rgb(0xFD, 0xE0, 0x47),
            NavActiveBg = Rgb(0x13, 0x3B, 0x4C),
            NavHoverBg = Rgb(0x13, 0x2F, 0x3E),
            DayOffBg = Rgb(0x32, 0x37, 0x41),
            DayOffBorder = Rgb(0x64, 0x6E, 0x82),
            DayOffText = Rgb(0xE2, 0xE8, 0xF0),
            DayOffBadgeBg = Rgb(0x25, 0x2A, 0x33),
            DbStatusBg = Rgb(0x0E, 0x2E, 0x33),
            DbStatusBorder = Rgb(0x1D, 0x68, 0x73),
            DbStatusText = Rgb(0x67, 0xE8, 0xF9),
            TooltipBg = Color.FromArgb(0xF5, 0x0A, 0x1E, 0x29),
            ChartSeparator = Rgb(0x1A, 0x3A, 0x4B),
            ChartLabel = Rgb(0x94, 0xC6, 0xD4),
            ScrollThumb = Rgb(0x26, 0x55, 0x6B)
        },

        // Sonbahar: Sıcak kehribar, kiremit & toprak tonları
        SeasonKind.Autumn => new()
        {
            IsLight = false,
            IsSpace = false,
            DisplaySubtitle = "Sonbahar",
            BgDeep = Rgb(0x16, 0x10, 0x0C),
            BgTitleBar = Rgb(0x1C, 0x14, 0x0F),
            BgSidebar = Rgb(0x20, 0x17, 0x12),
            BgPanel = Rgb(0x26, 0x1B, 0x15),
            BgCard = Rgb(0x30, 0x22, 0x1A),
            BgInput = Rgb(0x1B, 0x13, 0x0E),
            BgCellZero = Rgb(0x18, 0x13, 0x10),
            BgMutedCell = Rgb(0x19, 0x12, 0x0E),
            BgSegmentTrack = Rgb(0x1B, 0x13, 0x0E),
            BorderSubtle = Rgb(0x42, 0x30, 0x24),
            BorderCellZero = Rgb(0x4E, 0x38, 0x2A),
            BorderActive = Rgb(0xEA, 0x8C, 0x38),
            TextPrimary = Rgb(0xFE, 0xF3, 0xC7),
            TextSecondary = Rgb(0xD6, 0xB3, 0x99),
            TextMuted = Rgb(0x87, 0x68, 0x54),
            Accent = Rgb(0xF5, 0x9E, 0x0B),
            AccentSurface = Rgb(0x47, 0x2B, 0x14),
            AccentText = Rgb(0xFD, 0xBA, 0x74),
            NavActiveBg = Rgb(0x45, 0x2A, 0x16),
            NavHoverBg = Rgb(0x33, 0x23, 0x19),
            DayOffBg = Rgb(0x32, 0x37, 0x41),
            DayOffBorder = Rgb(0x64, 0x6E, 0x82),
            DayOffText = Rgb(0xE2, 0xE8, 0xF0),
            DayOffBadgeBg = Rgb(0x25, 0x2A, 0x33),
            DbStatusBg = Rgb(0x2E, 0x21, 0x12),
            DbStatusBorder = Rgb(0x78, 0x4F, 0x1D),
            DbStatusText = Rgb(0xFD, 0xBA, 0x74),
            TooltipBg = Color.FromArgb(0xF5, 0x1F, 0x16, 0x10),
            ChartSeparator = Rgb(0x3D, 0x2B, 0x20),
            ChartLabel = Rgb(0xD6, 0xB3, 0x99),
            ScrollThumb = Rgb(0x5E, 0x42, 0x31)
        },

        // Kış: Buz mavisi, gümüş grisi & soğuk kar tonları
        _ => new()
        {
            IsLight = false,
            IsSpace = false,
            DisplaySubtitle = "Kış",
            BgDeep = Rgb(0x0B, 0x13, 0x1E),
            BgTitleBar = Rgb(0x0F, 0x18, 0x26),
            BgSidebar = Rgb(0x12, 0x1D, 0x2D),
            BgPanel = Rgb(0x16, 0x23, 0x36),
            BgCard = Rgb(0x1D, 0x2C, 0x42),
            BgInput = Rgb(0x10, 0x1A, 0x28),
            BgCellZero = Rgb(0x12, 0x18, 0x22),
            BgMutedCell = Rgb(0x0E, 0x17, 0x24),
            BgSegmentTrack = Rgb(0x10, 0x1A, 0x28),
            BorderSubtle = Rgb(0x2A, 0x3E, 0x58),
            BorderCellZero = Rgb(0x34, 0x4B, 0x69),
            BorderActive = Rgb(0x7D, 0xD3, 0xFC),
            TextPrimary = Rgb(0xF0, 0xF9, 0xFF),
            TextSecondary = Rgb(0xB6, 0xCE, 0xE2),
            TextMuted = Rgb(0x64, 0x7E, 0x99),
            Accent = Rgb(0x7D, 0xD3, 0xFC),
            AccentSurface = Rgb(0x1B, 0x39, 0x54),
            AccentText = Rgb(0xBA, 0xE6, 0xFD),
            NavActiveBg = Rgb(0x1B, 0x39, 0x54),
            NavHoverBg = Rgb(0x1A, 0x2C, 0x42),
            DayOffBg = Rgb(0x32, 0x37, 0x41),
            DayOffBorder = Rgb(0x64, 0x6E, 0x82),
            DayOffText = Rgb(0xE2, 0xE8, 0xF0),
            DayOffBadgeBg = Rgb(0x25, 0x2A, 0x33),
            DbStatusBg = Rgb(0x12, 0x2B, 0x3D),
            DbStatusBorder = Rgb(0x38, 0x7A, 0xA6),
            DbStatusText = Rgb(0xBA, 0xE6, 0xFD),
            TooltipBg = Color.FromArgb(0xF5, 0x10, 0x1C, 0x2C),
            ChartSeparator = Rgb(0x25, 0x38, 0x52),
            ChartLabel = Rgb(0xB6, 0xCE, 0xE2),
            ScrollThumb = Rgb(0x3D, 0x58, 0x7A)
        }
    };

    private static Color Rgb(byte r, byte g, byte b) => Color.FromRgb(r, g, b);
}
