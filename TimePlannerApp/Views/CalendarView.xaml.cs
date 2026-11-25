using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using TimePlannerApp.Models;
using TimePlannerApp.Services;

namespace TimePlannerApp.Views;

public enum CalendarDisplayMode
{
    Monthly,
    Weekly,
    Daily
}

public partial class CalendarView : UserControl
{
    private const double PixelsPerHour = 60.0; // 1 px = 1 dakika
    private const double TimelineTopPadding = 12.0;

    private readonly CultureInfo _trCulture = new("tr-TR");
    private CalendarDisplayMode _currentMode = CalendarDisplayMode.Monthly;
    private DateTime _selectedDate = DateTime.Today;
    private bool _suppressComboEvents;
    private List<WorkSessionDetail> _currentDailySessions = [];

    public int DisplayedMonth => _selectedDate.Month;
    public event Action? DayOffsChanged;

    private static readonly string[] TurkishMonths =
    [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    private static readonly string[] TurkishDayNamesMondayFirst =
    [
        "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"
    ];

    public CalendarView()
    {
        InitializeComponent();
        InitializeMonthYearSelectors();
        Loaded += CalendarView_Loaded;
        SessionBlocksCanvas.SizeChanged += (_, _) =>
        {
            if (_currentMode == CalendarDisplayMode.Daily)
            {
                LayoutDailySessionBlocks();
            }
        };
    }

    public void OpenDateInDailyView(DateTime date)
    {
        _selectedDate = date.Date;
        SwitchToMode(CalendarDisplayMode.Daily);
    }

    private void CalendarView_Loaded(object sender, RoutedEventArgs e)
    {
        BuildDailyTimelineSkeleton();
        RefreshCalendar();
    }

    private void InitializeMonthYearSelectors()
    {
        _suppressComboEvents = true;

        MonthComboBox.ItemsSource = TurkishMonths;

        var currentYear = DateTime.Today.Year;
        var years = Enumerable.Range(currentYear - 6, 16).ToList();
        YearComboBox.ItemsSource = years;

        SyncMonthYearSelectors();
        _suppressComboEvents = false;
    }

    private void SyncMonthYearSelectors()
    {
        _suppressComboEvents = true;
        MonthComboBox.SelectedIndex = _selectedDate.Month - 1;

        if (YearComboBox.ItemsSource is List<int> years && !years.Contains(_selectedDate.Year))
        {
            var minYear = Math.Min(years.Min(), _selectedDate.Year - 2);
            var maxYear = Math.Max(years.Max(), _selectedDate.Year + 2);
            YearComboBox.ItemsSource = Enumerable.Range(minYear, maxYear - minYear + 1).ToList();
        }

        YearComboBox.SelectedItem = _selectedDate.Year;
        _suppressComboEvents = false;
    }

    public void RefreshCalendar()
    {
        if (!IsLoaded)
        {
            return;
        }

        // Mevsimler teması aktifse görüntülenen aya göre mevsimi senkronize et
        ThemeService.UpdateCalendarMonth(_selectedDate.Month);

        SyncMonthYearSelectors();

        MonthlyViewContainer.Visibility = _currentMode == CalendarDisplayMode.Monthly
            ? Visibility.Visible : Visibility.Collapsed;
        WeeklyViewContainer.Visibility = _currentMode == CalendarDisplayMode.Weekly
            ? Visibility.Visible : Visibility.Collapsed;
        DailyViewContainer.Visibility = _currentMode == CalendarDisplayMode.Daily
            ? Visibility.Visible : Visibility.Collapsed;

        MonthComboBox.Visibility = Visibility.Visible;
        YearComboBox.Visibility = Visibility.Visible;

        switch (_currentMode)
        {
            case CalendarDisplayMode.Monthly:
                RenderMonthlyView();
                break;
            case CalendarDisplayMode.Weekly:
                RenderWeeklyView();
                break;
            case CalendarDisplayMode.Daily:
                RenderDailyView();
                break;
        }
    }

    private void RenderMonthlyView()
    {
        HeaderTitleText.Text = $"{TurkishMonths[_selectedDate.Month - 1]} {_selectedDate.Year}";

        MonthlyDaysGrid.Children.Clear();

        var firstDayOfMonth = new DateTime(_selectedDate.Year, _selectedDate.Month, 1);
        var offsetFromMonday = ((int)firstDayOfMonth.DayOfWeek + 6) % 7;
        var gridStart = firstDayOfMonth.AddDays(-offsetFromMonday);
        var gridEnd = gridStart.AddDays(41);

        var targets = App.Database.GetDailyTargets();
        var dailyTotals = App.Database.GetDailyTotalSecondsByRange(gridStart, gridEnd);
        var dayOffs = App.Database.GetDayOffsByRange(gridStart, gridEnd);
        var today = DateTime.Today;

        for (var i = 0; i < 42; i++)
        {
            var cellDate = gridStart.AddDays(i);
            var isCurrentMonth = cellDate.Month == _selectedDate.Month;
            var isToday = cellDate.Date == today;
            var isSelected = cellDate.Date == _selectedDate.Date;

            var dateKey = cellDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var totalSeconds = dailyTotals.TryGetValue(dateKey, out var sec) ? sec : 0;
            var targetMinutes = targets.TryGetValue((int)cellDate.DayOfWeek, out var tm) ? tm : 120;
            var exactPercent = ColorScaleService.CalculateCompletionPercent(totalSeconds, targetMinutes);
            dayOffs.TryGetValue(dateKey, out var dayOff);

            var card = CreateMonthlyDayCell(cellDate, isCurrentMonth, isToday, isSelected, exactPercent, totalSeconds, targetMinutes, dayOff);
            MonthlyDaysGrid.Children.Add(card);
        }
    }

    private Border CreateMonthlyDayCell(
        DateTime date,
        bool isCurrentMonth,
        bool isToday,
        bool isSelected,
        double exactPercent,
        int totalSeconds,
        int targetMinutes,
        DayOff? dayOff)
    {
        var p = ThemeService.CurrentPalette;
        var isDayOff = dayOff != null && isCurrentMonth;
        var displayPercent = totalSeconds > 0 && exactPercent < 1.0
            ? 1
            : (int)Math.Round(exactPercent);
        var colorInfo = ColorScaleService.GetColorInfo(exactPercent);
        var hasWork = !isDayOff && colorInfo.Tier != PerformanceTier.Zero;

        Brush bgBrush;
        Brush borderBrush;
        if (!isCurrentMonth)
        {
            bgBrush = ThemeService.Brush(p.BgMutedCell);
            borderBrush = ThemeService.Brush(p.BorderSubtle);
        }
        else if (isDayOff)
        {
            bgBrush = ThemeService.Brush(p.DayOffBg);
            borderBrush = ThemeService.Brush(p.DayOffBorder);
        }
        else
        {
            bgBrush = colorInfo.CreateSurfaceBrush();
            if (hasWork)
            {
                borderBrush = colorInfo.CreateBorderBrush();
            }
            else if (isToday)
            {
                borderBrush = ThemeService.Brush(p.Accent);
            }
            else if (isSelected)
            {
                borderBrush = ThemeService.Brush(p.BorderActive);
            }
            else
            {
                borderBrush = colorInfo.CreateBorderBrush();
            }
        }

        var borderThickness = isToday ? new Thickness(1.8) : new Thickness(1.1);
        var ambientGlow = isCurrentMonth && !isDayOff && (colorInfo.Tier >= PerformanceTier.Green || (isToday && hasWork))
            ? colorInfo.CreateGlowEffect(0.55)
            : null;

        var tooltipText = isDayOff
            ? $"{date.ToString("d MMMM yyyy, dddd", _trCulture)}\nİzinli Gün (Hedef Muaf)\nSebep: {dayOff!.Reason}\nSağ tık: İzni düzenle veya kaldır"
            : $"{date.ToString("d MMMM yyyy, dddd", _trCulture)}\n" +
              $"Hedef: {FormatMinutesReadable(targetMinutes)} • Çalışılan: {FormatDurationCompact(totalSeconds)} (%{displayPercent})\n" +
              $"Durum: {colorInfo.TierLabel}\nSol tık: Günlük çizelge • Sağ tık: İzin günü işaretle";

        var border = new Border
        {
            Background = bgBrush,
            BorderBrush = borderBrush,
            BorderThickness = borderThickness,
            CornerRadius = new CornerRadius(8),
            Margin = new Thickness(3),
            Padding = new Thickness(9, 5, 9, 5),
            Cursor = Cursors.Hand,
            Tag = date,
            Effect = ambientGlow,
            ToolTip = tooltipText,
            ContextMenu = BuildDayContextMenu(date, dayOff)
        };

        var rootGrid = new Grid();
        rootGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        rootGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        // Top row: Day Number + Bugün or İzinli badge
        var topGrid = new Grid();
        topGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        topGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var dayNumText = new TextBlock
        {
            Text = date.Day.ToString(),
            FontSize = 13.5,
            FontWeight = isCurrentMonth ? FontWeights.Bold : FontWeights.Normal,
            Foreground = !isCurrentMonth
                ? ThemeService.Brush(p.TextMuted)
                : isDayOff
                    ? ThemeService.Brush(p.DayOffText)
                    : ThemeService.Brush(p.TextPrimary)
        };
        Grid.SetColumn(dayNumText, 0);
        topGrid.Children.Add(dayNumText);

        if (isDayOff)
        {
            var offBadge = new Border
            {
                Background = ThemeService.Brush(p.DayOffBadgeBg),
                BorderBrush = ThemeService.Brush(p.DayOffBorder),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(5, 1, 5, 1),
                VerticalAlignment = VerticalAlignment.Center
            };
            offBadge.Child = new TextBlock
            {
                Text = isToday ? "Bugün • İzin" : "İzinli",
                FontSize = 9.5,
                FontWeight = FontWeights.SemiBold,
                Foreground = ThemeService.Brush(p.DayOffText)
            };
            Grid.SetColumn(offBadge, 1);
            topGrid.Children.Add(offBadge);
        }
        else if (isToday)
        {
            var todayBadge = new Border
            {
                Background = ThemeService.Brush(p.AccentSurface),
                BorderBrush = hasWork ? colorInfo.CreateBorderBrush() : ThemeService.Brush(p.Accent),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(6, 1, 6, 2),
                VerticalAlignment = VerticalAlignment.Center
            };
            todayBadge.Child = new TextBlock
            {
                Text = "Bugün",
                FontSize = 10,
                FontWeight = FontWeights.SemiBold,
                Foreground = ThemeService.Brush(p.AccentText)
            };
            Grid.SetColumn(todayBadge, 1);
            topGrid.Children.Add(todayBadge);
        }

        Grid.SetRow(topGrid, 0);
        rootGrid.Children.Add(topGrid);

        // Bottom / Middle content for current month days
        if (isCurrentMonth)
        {
            if (isDayOff)
            {
                var reasonText = new TextBlock
                {
                    Text = dayOff!.Reason,
                    FontSize = 11.5,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = ThemeService.Brush(p.DayOffText),
                    TextTrimming = TextTrimming.CharacterEllipsis,
                    VerticalAlignment = VerticalAlignment.Bottom
                };
                Grid.SetRow(reasonText, 2);
                rootGrid.Children.Add(reasonText);
            }
            else
            {
                var bottomGrid = new Grid();
                bottomGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                bottomGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

                var percentText = new TextBlock
                {
                    Text = $"%{displayPercent}",
                    FontSize = 12,
                    FontWeight = FontWeights.Bold,
                    Foreground = hasWork
                        ? (p.IsLight ? colorInfo.CreateAccentTextBrush() : ThemeService.Brush(p.TextPrimary))
                        : ThemeService.Brush(p.TextSecondary)
                };
                Grid.SetColumn(percentText, 0);
                bottomGrid.Children.Add(percentText);

                var hoursText = new TextBlock
                {
                    Text = FormatHoursShort(totalSeconds),
                    FontSize = 11.5,
                    FontWeight = hasWork ? FontWeights.SemiBold : FontWeights.Normal,
                    Foreground = hasWork
                        ? colorInfo.CreateAccentTextBrush()
                        : ThemeService.Brush(p.TextSecondary)
                };
                Grid.SetColumn(hoursText, 1);
                bottomGrid.Children.Add(hoursText);

                Grid.SetRow(bottomGrid, 2);
                rootGrid.Children.Add(bottomGrid);
            }
        }

        border.Child = rootGrid;

        var defaultBorderBrush = borderBrush;
        border.MouseEnter += (_, _) =>
        {
            if (isCurrentMonth && hasWork)
            {
                border.BorderBrush = colorInfo.CreatePrimaryBrush();
                border.Effect = colorInfo.CreateGlowEffect(0.95);
            }
            else if (!isToday)
            {
                border.BorderBrush = ThemeService.Brush(p.Accent);
            }
        };
        border.MouseLeave += (_, _) =>
        {
            border.BorderBrush = defaultBorderBrush;
            border.Effect = ambientGlow;
        };
        border.MouseLeftButtonUp += (_, _) =>
        {
            _selectedDate = date;
            SwitchToMode(CalendarDisplayMode.Daily);
        };

        return border;
    }

    private void RenderWeeklyView()
    {
        var weekStart = GetMondayOfWeek(_selectedDate);
        var weekEnd = weekStart.AddDays(6);

        if (weekStart.Month == weekEnd.Month)
        {
            HeaderTitleText.Text = $"{weekStart.Day} – {weekEnd.Day} {TurkishMonths[weekStart.Month - 1]} {weekStart.Year}";
        }
        else if (weekStart.Year == weekEnd.Year)
        {
            HeaderTitleText.Text = $"{weekStart.Day} {TurkishMonths[weekStart.Month - 1]} – {weekEnd.Day} {TurkishMonths[weekEnd.Month - 1]} {weekStart.Year}";
        }
        else
        {
            HeaderTitleText.Text = $"{weekStart.Day} {TurkishMonths[weekStart.Month - 1]} {weekStart.Year} – {weekEnd.Day} {TurkishMonths[weekEnd.Month - 1]} {weekEnd.Year}";
        }

        WeeklyDaysGrid.Children.Clear();

        var targets = App.Database.GetDailyTargets();
        var dailyTotals = App.Database.GetDailyTotalSecondsByRange(weekStart, weekEnd);
        var dayOffs = App.Database.GetDayOffsByRange(weekStart, weekEnd);
        var weekSessionsByDate = App.Database
            .GetSessionDetailsForDateRange(weekStart, weekEnd)
            .GroupBy(s => s.SessionDate)
            .ToDictionary(g => g.Key, g => g.ToList());
        var today = DateTime.Today;

        for (var i = 0; i < 7; i++)
        {
            var dayDate = weekStart.AddDays(i);
            var isToday = dayDate.Date == today;
            var dateKey = dayDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var totalSeconds = dailyTotals.TryGetValue(dateKey, out var sec) ? sec : 0;
            var targetMinutes = targets.TryGetValue((int)dayDate.DayOfWeek, out var tm) ? tm : 120;
            var exactPercent = ColorScaleService.CalculateCompletionPercent(totalSeconds, targetMinutes);
            var daySessions = weekSessionsByDate.TryGetValue(dateKey, out var list) ? list : [];
            dayOffs.TryGetValue(dateKey, out var dayOff);

            WeeklyDaysGrid.Children.Add(CreateWeeklyDayColumn(
                dayDate,
                TurkishDayNamesMondayFirst[i],
                isToday,
                exactPercent,
                totalSeconds,
                targetMinutes,
                daySessions,
                dayOff));
        }
    }

    private Border CreateWeeklyDayColumn(
        DateTime date,
        string dayName,
        bool isToday,
        double exactPercent,
        int totalSeconds,
        int targetMinutes,
        List<WorkSessionDetail> sessions,
        DayOff? dayOff)
    {
        var p = ThemeService.CurrentPalette;
        var isDayOff = dayOff != null;
        var displayPercent = totalSeconds > 0 && exactPercent < 1.0
            ? 1
            : (int)Math.Round(exactPercent);
        var colorInfo = ColorScaleService.GetColorInfo(exactPercent);
        var hasWork = !isDayOff && colorInfo.Tier != PerformanceTier.Zero;

        Brush bgBrush = isDayOff ? ThemeService.Brush(p.DayOffBg) : colorInfo.CreateSurfaceBrush();
        Brush defaultBorderBrush = isDayOff
            ? ThemeService.Brush(p.DayOffBorder)
            : hasWork
                ? colorInfo.CreateBorderBrush()
                : isToday
                    ? ThemeService.Brush(p.Accent)
                    : colorInfo.CreateBorderBrush();

        var ambientGlow = hasWork ? colorInfo.CreateGlowEffect(0.65) : null;

        var card = new Border
        {
            Background = bgBrush,
            BorderBrush = defaultBorderBrush,
            BorderThickness = isToday ? new Thickness(1.8) : new Thickness(1.1),
            CornerRadius = new CornerRadius(10),
            Margin = new Thickness(4, 4, 4, 4),
            Padding = new Thickness(12),
            Cursor = Cursors.Hand,
            Effect = ambientGlow,
            ContextMenu = BuildDayContextMenu(date, dayOff)
        };

        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var headerStack = new StackPanel();
        var topRow = new Grid();
        topRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        topRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var dayNameText = new TextBlock
        {
            Text = dayName,
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            Foreground = isDayOff
                ? ThemeService.Brush(p.DayOffText)
                : isToday
                    ? ThemeService.Brush(p.AccentText)
                    : ThemeService.Brush(p.TextSecondary)
        };
        Grid.SetColumn(dayNameText, 0);
        topRow.Children.Add(dayNameText);

        if (isToday)
        {
            var badge = new Border
            {
                Background = ThemeService.Brush(p.AccentSurface),
                BorderBrush = ThemeService.Brush(p.Accent),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(5, 1, 5, 1)
            };
            badge.Child = new TextBlock
            {
                Text = "Bugün",
                FontSize = 10,
                FontWeight = FontWeights.SemiBold,
                Foreground = ThemeService.Brush(p.AccentText)
            };
            Grid.SetColumn(badge, 1);
            topRow.Children.Add(badge);
        }

        headerStack.Children.Add(topRow);
        headerStack.Children.Add(new TextBlock
        {
            Text = $"{date.Day} {TurkishMonths[date.Month - 1][..3]}",
            FontSize = 20,
            FontWeight = FontWeights.Bold,
            Foreground = isDayOff ? ThemeService.Brush(p.DayOffText) : ThemeService.Brush(p.TextPrimary),
            Margin = new Thickness(0, 4, 0, 10)
        });
        Grid.SetRow(headerStack, 0);
        grid.Children.Add(headerStack);

        // Info box
        var infoBorder = new Border
        {
            Background = ThemeService.Brush(isDayOff ? p.DayOffBadgeBg : p.BgCard),
            BorderBrush = ThemeService.Brush(isDayOff ? p.DayOffBorder : p.BorderSubtle),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(8, 6, 8, 6),
            Margin = new Thickness(0, 0, 0, 10)
        };
        var infoStack = new StackPanel();
        infoStack.Children.Add(new TextBlock
        {
            Text = isDayOff ? "Hedef: Muaf (İzinli)" : $"Hedef: {FormatMinutesReadable(targetMinutes)}",
            FontSize = 11.5,
            Foreground = ThemeService.Brush(isDayOff ? p.DayOffText : p.TextSecondary)
        });
        infoStack.Children.Add(new TextBlock
        {
            Text = $"Gerçekleşen: {FormatHoursShort(totalSeconds)}",
            FontSize = 11.5,
            FontWeight = FontWeights.SemiBold,
            Foreground = ThemeService.Brush(isDayOff ? p.DayOffText : p.TextPrimary),
            Margin = new Thickness(0, 2, 0, 0)
        });
        infoBorder.Child = infoStack;
        Grid.SetRow(infoBorder, 1);
        grid.Children.Add(infoBorder);

        // Middle content: DayOff banner or session chips
        var centerPanel = new StackPanel
        {
            VerticalAlignment = (isDayOff || sessions.Count == 0) ? VerticalAlignment.Center : VerticalAlignment.Top
        };

        if (isDayOff)
        {
            centerPanel.Children.Add(new Border
            {
                Background = ThemeService.Brush(p.DayOffBadgeBg),
                BorderBrush = ThemeService.Brush(p.DayOffBorder),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(8, 8, 8, 8),
                Child = new StackPanel
                {
                    Children =
                    {
                        new TextBlock
                        {
                            Text = "İZİNLİ GÜN",
                            FontSize = 10,
                            FontWeight = FontWeights.Bold,
                            Foreground = ThemeService.Brush(p.DayOffText),
                            HorizontalAlignment = HorizontalAlignment.Center
                        },
                        new TextBlock
                        {
                            Text = dayOff!.Reason,
                            FontSize = 12.5,
                            FontWeight = FontWeights.SemiBold,
                            Foreground = ThemeService.Brush(p.DayOffText),
                            TextAlignment = TextAlignment.Center,
                            TextWrapping = TextWrapping.Wrap,
                            Margin = new Thickness(0, 4, 0, 0)
                        }
                    }
                }
            });
        }
        else if (sessions.Count == 0)
        {
            centerPanel.Children.Add(new TextBlock
            {
                Text = "Oturum yok",
                FontSize = 11.5,
                Foreground = ThemeService.Brush(p.TextMuted),
                HorizontalAlignment = HorizontalAlignment.Center
            });
        }
        else
        {
            const int maxVisibleChips = 4;
            foreach (var session in sessions.Take(maxVisibleChips))
            {
                var isTask = session.GoalType == "Task";
                var chip = new Border
                {
                    Background = isTask
                        ? new SolidColorBrush(p.IsLight ? Color.FromRgb(0xDC, 0xFC, 0xE7) : Color.FromRgb(0x14, 0x33, 0x22))
                        : new SolidColorBrush(p.IsLight ? Color.FromRgb(0xDB, 0xEA, 0xFE) : Color.FromRgb(0x14, 0x28, 0x45)),
                    BorderBrush = isTask
                        ? new SolidColorBrush(Color.FromRgb(0x2E, 0x7D, 0x4B))
                        : new SolidColorBrush(Color.FromRgb(0x2B, 0x56, 0x94)),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(5),
                    Padding = new Thickness(6, 4, 6, 4),
                    Margin = new Thickness(0, 0, 0, 5)
                };

                var chipStack = new StackPanel();
                chipStack.Children.Add(new TextBlock
                {
                    Text = session.GoalTitle,
                    FontSize = 11,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = ThemeService.Brush(p.TextPrimary),
                    TextTrimming = TextTrimming.CharacterEllipsis
                });

                var startShort = session.StartTime.Length >= 5 ? session.StartTime[..5] : session.StartTime;
                chipStack.Children.Add(new TextBlock
                {
                    Text = $"{startShort} • {FormatDurationCompact(session.DurationSeconds)}",
                    FontSize = 10,
                    Foreground = ThemeService.Brush(p.TextSecondary)
                });
                chip.Child = chipStack;
                centerPanel.Children.Add(chip);
            }

            if (sessions.Count > maxVisibleChips)
            {
                centerPanel.Children.Add(new TextBlock
                {
                    Text = $"+{sessions.Count - maxVisibleChips} oturum daha",
                    FontSize = 10.5,
                    Foreground = ThemeService.Brush(p.AccentText),
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Margin = new Thickness(0, 2, 0, 0)
                });
            }
        }
        Grid.SetRow(centerPanel, 2);
        grid.Children.Add(centerPanel);

        // Footer
        var footerBorder = new Border
        {
            BorderBrush = ThemeService.Brush(isDayOff ? p.DayOffBorder : p.BorderSubtle),
            BorderThickness = new Thickness(0, 1, 0, 0),
            Padding = new Thickness(0, 8, 0, 0)
        };
        var footerGrid = new Grid();
        footerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        footerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        footerGrid.Children.Add(new TextBlock
        {
            Text = isDayOff ? "Durum" : "Tamamlanma",
            FontSize = 11,
            Foreground = ThemeService.Brush(isDayOff ? p.DayOffText : p.TextSecondary)
        });

        var pctBlock = new TextBlock
        {
            Text = isDayOff ? "Muaf" : $"%{displayPercent}",
            FontSize = 13.5,
            FontWeight = FontWeights.Bold,
            Foreground = isDayOff
                ? ThemeService.Brush(p.DayOffText)
                : hasWork
                    ? colorInfo.CreateAccentTextBrush()
                    : ThemeService.Brush(p.TextSecondary)
        };
        Grid.SetColumn(pctBlock, 1);
        footerGrid.Children.Add(pctBlock);

        footerBorder.Child = footerGrid;
        Grid.SetRow(footerBorder, 3);
        grid.Children.Add(footerBorder);

        card.Child = grid;

        card.MouseEnter += (_, _) =>
        {
            if (hasWork)
            {
                card.BorderBrush = colorInfo.CreatePrimaryBrush();
                card.Effect = colorInfo.CreateGlowEffect(1.0);
            }
            else if (!isToday)
            {
                card.BorderBrush = ThemeService.Brush(p.Accent);
            }
        };
        card.MouseLeave += (_, _) =>
        {
            card.BorderBrush = defaultBorderBrush;
            card.Effect = ambientGlow;
        };
        card.MouseLeftButtonUp += (_, _) =>
        {
            _selectedDate = date;
            SwitchToMode(CalendarDisplayMode.Daily);
        };

        return card;
    }

    private ContextMenu BuildDayContextMenu(DateTime date, DayOff? existingDayOff)
    {
        var menu = new ContextMenu();

        var openDailyItem = new MenuItem { Header = "Günlük Zaman Çizelgesini Aç" };
        openDailyItem.Click += (_, _) =>
        {
            _selectedDate = date;
            SwitchToMode(CalendarDisplayMode.Daily);
        };
        menu.Items.Add(openDailyItem);

        if (existingDayOff == null)
        {
            var markOffItem = new MenuItem { Header = "İzin Günü Olarak İşaretle..." };
            markOffItem.Click += (_, _) => OpenDayOffDialog(date, null);
            menu.Items.Add(markOffItem);
        }
        else
        {
            var editOffItem = new MenuItem { Header = $"İzin Sebebini Düzenle ({existingDayOff.Reason})..." };
            editOffItem.Click += (_, _) => OpenDayOffDialog(date, existingDayOff.Reason);
            menu.Items.Add(editOffItem);

            var removeOffItem = new MenuItem { Header = "İzni Kaldır" };
            removeOffItem.Click += (_, _) =>
            {
                App.Database.RemoveDayOff(date);
                RefreshCalendar();
                DayOffsChanged?.Invoke();
            };
            menu.Items.Add(removeOffItem);
        }

        return menu;
    }

    private void OpenDayOffDialog(DateTime date, string? existingReason)
    {
        var dialog = new DayOffDialog(date, existingReason)
        {
            Owner = Window.GetWindow(this)
        };

        if (dialog.ShowDialog() != true)
        {
            return;
        }

        if (dialog.ResultAction == DayOffDialogAction.Save)
        {
            App.Database.SetDayOff(date, dialog.ReasonText);
            RefreshCalendar();
            DayOffsChanged?.Invoke();
        }
        else if (dialog.ResultAction == DayOffDialogAction.Remove)
        {
            App.Database.RemoveDayOff(date);
            RefreshCalendar();
            DayOffsChanged?.Invoke();
        }
    }

    private void DailyDayOffButton_Click(object sender, RoutedEventArgs e)
    {
        var existing = App.Database.GetDayOff(_selectedDate);
        OpenDayOffDialog(_selectedDate, existing?.Reason);
    }

    private void BuildDailyTimelineSkeleton()
    {
        var p = ThemeService.CurrentPalette;
        TimelineHoursCanvas.Children.Clear();
        TimelineGridLinesCanvas.Children.Clear();

        var hourTextBrush = ThemeService.Brush(p.TextSecondary);
        var hourLineBrush = ThemeService.Brush(p.BorderSubtle);
        var halfHourLineBrush = new SolidColorBrush(Color.FromArgb(0x55, p.BorderSubtle.R, p.BorderSubtle.G, p.BorderSubtle.B));

        for (var hour = 0; hour < 24; hour++)
        {
            var y = TimelineTopPadding + hour * PixelsPerHour;

            var label = new TextBlock
            {
                Text = $"{hour:00}:00",
                FontSize = 11.5,
                FontWeight = FontWeights.Medium,
                Foreground = hourTextBrush
            };
            Canvas.SetLeft(label, 8);
            Canvas.SetTop(label, y - 8);
            TimelineHoursCanvas.Children.Add(label);

            var hourLine = new Border { Height = 1, Background = hourLineBrush };
            hourLine.SetBinding(WidthProperty, new System.Windows.Data.Binding("ActualWidth") { Source = TimelineGridLinesCanvas });
            Canvas.SetTop(hourLine, y);
            TimelineGridLinesCanvas.Children.Add(hourLine);

            var halfLine = new Border { Height = 1, Background = halfHourLineBrush };
            halfLine.SetBinding(WidthProperty, new System.Windows.Data.Binding("ActualWidth") { Source = TimelineGridLinesCanvas });
            Canvas.SetTop(halfLine, y + PixelsPerHour / 2.0);
            TimelineGridLinesCanvas.Children.Add(halfLine);
        }

        var endY = TimelineTopPadding + 24 * PixelsPerHour;
        var endLabel = new TextBlock
        {
            Text = "23:59",
            FontSize = 11,
            FontWeight = FontWeights.Medium,
            Foreground = ThemeService.Brush(p.TextMuted)
        };
        Canvas.SetLeft(endLabel, 8);
        Canvas.SetTop(endLabel, endY - 8);
        TimelineHoursCanvas.Children.Add(endLabel);

        var endLine = new Border { Height = 1, Background = hourLineBrush };
        endLine.SetBinding(WidthProperty, new System.Windows.Data.Binding("ActualWidth") { Source = TimelineGridLinesCanvas });
        Canvas.SetTop(endLine, endY);
        TimelineGridLinesCanvas.Children.Add(endLine);
    }

    private void RenderDailyView()
    {
        BuildDailyTimelineSkeleton();

        var p = ThemeService.CurrentPalette;
        var formattedFull = _selectedDate.ToString("d MMMM yyyy, dddd", _trCulture);
        HeaderTitleText.Text = $"{_selectedDate.Day} {TurkishMonths[_selectedDate.Month - 1]} {_selectedDate.Year}";
        DailySummaryDateText.Text = formattedFull;

        var isToday = _selectedDate.Date == DateTime.Today;
        DailyTodayBadge.Visibility = isToday ? Visibility.Visible : Visibility.Collapsed;

        var dayOff = App.Database.GetDayOff(_selectedDate);
        var targetMinutes = App.Database.GetDailyTargetMinutes(_selectedDate.DayOfWeek);
        _currentDailySessions = App.Database.GetSessionDetailsForDate(_selectedDate);
        var totalSeconds = _currentDailySessions.Sum(s => s.DurationSeconds);

        if (dayOff != null)
        {
            DailyTargetInfoText.Text = "Günlük Hedef: Muaf (İzinli)";
            DailyProgressInfoText.Text = $"İzinli • {dayOff.Reason}";
            DailyProgressInfoText.Foreground = ThemeService.Brush(p.DayOffText);
            DailyProgressBadge.Background = ThemeService.Brush(p.DayOffBg);
            DailyProgressBadge.BorderBrush = ThemeService.Brush(p.DayOffBorder);
            DailyProgressBadge.Effect = null;
            DailyDayOffButton.Content = "İzni Düzenle";
        }
        else
        {
            var exactPercent = ColorScaleService.CalculateCompletionPercent(totalSeconds, targetMinutes);
            var displayPercent = totalSeconds > 0 && exactPercent < 1.0
                ? 1
                : (int)Math.Round(exactPercent);
            var dayColorInfo = ColorScaleService.GetColorInfo(exactPercent);

            DailyTargetInfoText.Text = $"Günlük Hedef: {FormatMinutesReadable(targetMinutes)}";
            DailyProgressInfoText.Text = $"Çalışılan: {FormatDurationCompact(totalSeconds)} (%{displayPercent})";
            DailyProgressInfoText.Foreground = dayColorInfo.Tier == PerformanceTier.Zero
                ? ThemeService.Brush(p.TextPrimary)
                : dayColorInfo.CreateAccentTextBrush();
            DailyProgressBadge.Background = dayColorInfo.CreateSurfaceBrush();
            DailyProgressBadge.BorderBrush = dayColorInfo.CreateBorderBrush();
            DailyProgressBadge.Effect = dayColorInfo.CreateGlowEffect(0.7);
            DailyDayOffButton.Content = "İzin Günü İşaretle";
        }

        LayoutDailySessionBlocks();
        UpdateCurrentTimeIndicator();

        var defaultHour = 8;
        if (isToday)
        {
            defaultHour = Math.Max(0, DateTime.Now.Hour - 2);
        }
        else if (_currentDailySessions.Count > 0 &&
                 TimeSpan.TryParseExact(_currentDailySessions[0].StartTime, @"hh\:mm\:ss", CultureInfo.InvariantCulture, out var firstTs))
        {
            defaultHour = Math.Max(0, firstTs.Hours - 1);
        }

        Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Loaded, () =>
        {
            LayoutDailySessionBlocks();
            DailyTimelineScrollViewer.ScrollToVerticalOffset(defaultHour * PixelsPerHour);
        });
    }

    private void LayoutDailySessionBlocks()
    {
        SessionBlocksCanvas.Children.Clear();
        if (_currentDailySessions.Count == 0)
        {
            return;
        }

        var canvasWidth = SessionBlocksCanvas.ActualWidth;
        if (canvasWidth < 40)
        {
            return;
        }

        var items = new List<(WorkSessionDetail Session, double StartMin, double EndMin, int Col)>();
        foreach (var s in _currentDailySessions)
        {
            if (!TimeSpan.TryParseExact(s.StartTime, @"hh\:mm\:ss", CultureInfo.InvariantCulture, out var startTs))
            {
                startTs = TimeSpan.Zero;
            }

            var startMin = Math.Clamp(startTs.TotalMinutes, 0, 1438);
            var visualHeight = Math.Max(24.0, s.DurationSeconds / 60.0);
            var endMin = Math.Min(1440.0, startMin + visualHeight);
            items.Add((s, startMin, endMin, 0));
        }

        var colEndTimes = new List<double>();
        for (var i = 0; i < items.Count; i++)
        {
            var cur = items[i];
            var assignedCol = -1;
            for (var c = 0; c < colEndTimes.Count; c++)
            {
                if (colEndTimes[c] <= cur.StartMin)
                {
                    assignedCol = c;
                    colEndTimes[c] = cur.EndMin;
                    break;
                }
            }

            if (assignedCol == -1)
            {
                assignedCol = colEndTimes.Count;
                colEndTimes.Add(cur.EndMin);
            }

            items[i] = (cur.Session, cur.StartMin, cur.EndMin, assignedCol);
        }

        const double horizontalMargin = 8.0;
        const double columnGap = 6.0;
        var usableWidth = Math.Max(80.0, canvasWidth - horizontalMargin * 2);

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];

            var maxColInGroup = item.Col;
            for (var j = 0; j < items.Count; j++)
            {
                var other = items[j];
                if (other.StartMin < item.EndMin && other.EndMin > item.StartMin)
                {
                    if (other.Col > maxColInGroup)
                    {
                        maxColInGroup = other.Col;
                    }
                }
            }

            var colsCount = maxColInGroup + 1;
            var blockWidth = Math.Max(60.0, (usableWidth - (colsCount - 1) * columnGap) / colsCount);
            var left = horizontalMargin + item.Col * (blockWidth + columnGap);
            var top = TimelineTopPadding + item.StartMin;
            var height = Math.Max(24.0, item.EndMin - item.StartMin);

            var block = CreateDailySessionBlock(item.Session, blockWidth, height);
            Canvas.SetLeft(block, left);
            Canvas.SetTop(block, top);
            SessionBlocksCanvas.Children.Add(block);
        }
    }

    private static Border CreateDailySessionBlock(WorkSessionDetail session, double width, double height)
    {
        var isLight = ThemeService.IsLightTheme;
        var isTask = session.GoalType == "Task";
        var bgBrush = isTask
            ? new SolidColorBrush(isLight ? Color.FromArgb(0xEE, 0xDC, 0xFC, 0xE7) : Color.FromArgb(0xE6, 0x16, 0x3D, 0x26))
            : new SolidColorBrush(isLight ? Color.FromArgb(0xEE, 0xDB, 0xEA, 0xFE) : Color.FromArgb(0xE6, 0x16, 0x31, 0x57));
        var borderBrush = isTask
            ? new SolidColorBrush(Color.FromRgb(0x43, 0xA0, 0x47))
            : new SolidColorBrush(Color.FromRgb(0x3B, 0x82, 0xF6));
        var titleBrush = ThemeService.Brush(ThemeService.CurrentPalette.TextPrimary);
        var subTextBrush = isTask
            ? new SolidColorBrush(isLight ? Color.FromRgb(0x16, 0x65, 0x34) : Color.FromRgb(0xA7, 0xF3, 0xD0))
            : new SolidColorBrush(isLight ? Color.FromRgb(0x1E, 0x40, 0xAF) : Color.FromRgb(0xBF, 0xDB, 0xFE));

        var startShort = session.StartTime.Length >= 5 ? session.StartTime[..5] : session.StartTime;
        var endShort = session.EndTime.Length >= 5 ? session.EndTime[..5] : session.EndTime;
        var durText = FormatDurationCompact(session.DurationSeconds);

        var block = new Border
        {
            Width = width,
            Height = height,
            Background = bgBrush,
            BorderBrush = borderBrush,
            BorderThickness = new Thickness(3, 1, 1, 1),
            CornerRadius = new CornerRadius(6),
            Padding = new Thickness(9, 3, 9, 3),
            ToolTip = $"{session.GoalTitle} ({(isTask ? "Görev" : "Süreç")})\nSaat: {session.StartTime} – {session.EndTime}\nSüre: {durText}"
        };

        if (height >= 40)
        {
            var stack = new StackPanel { VerticalAlignment = VerticalAlignment.Top };
            stack.Children.Add(new TextBlock
            {
                Text = session.GoalTitle,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Foreground = titleBrush,
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            stack.Children.Add(new TextBlock
            {
                Text = $"{startShort} – {endShort}  •  {durText}",
                FontSize = 11,
                Foreground = subTextBrush,
                Margin = new Thickness(0, 1, 0, 0),
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            block.Child = stack;
        }
        else
        {
            var row = new Grid { VerticalAlignment = VerticalAlignment.Center };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var title = new TextBlock
            {
                Text = session.GoalTitle,
                FontSize = 11.5,
                FontWeight = FontWeights.SemiBold,
                Foreground = titleBrush,
                VerticalAlignment = VerticalAlignment.Center,
                TextTrimming = TextTrimming.CharacterEllipsis
            };
            Grid.SetColumn(title, 0);
            row.Children.Add(title);

            var meta = new TextBlock
            {
                Text = $"{startShort}–{endShort} • {durText}",
                FontSize = 10.5,
                Foreground = subTextBrush,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(8, 0, 0, 0)
            };
            Grid.SetColumn(meta, 1);
            row.Children.Add(meta);

            block.Child = row;
        }

        return block;
    }

    public void UpdateCurrentTimeIndicator()
    {
        if (!IsLoaded || _currentMode != CalendarDisplayMode.Daily)
        {
            return;
        }

        CurrentTimeCanvas.Children.Clear();

        if (_selectedDate.Date != DateTime.Today)
        {
            return;
        }

        var p = ThemeService.CurrentPalette;
        var now = DateTime.Now;
        var minutesFromMidnight = now.Hour * 60.0 + now.Minute + now.Second / 60.0;
        var y = TimelineTopPadding + minutesFromMidnight;

        var line = new Border { Height = 2, Background = ThemeService.Brush(p.Accent) };
        line.SetBinding(WidthProperty, new System.Windows.Data.Binding("ActualWidth") { Source = CurrentTimeCanvas });
        Canvas.SetTop(line, y);
        CurrentTimeCanvas.Children.Add(line);

        var dot = new Ellipse { Width = 9, Height = 9, Fill = ThemeService.Brush(p.Accent) };
        Canvas.SetLeft(dot, -4);
        Canvas.SetTop(dot, y - 3.5);
        CurrentTimeCanvas.Children.Add(dot);

        var timePill = new Border
        {
            Background = ThemeService.Brush(p.AccentSurface),
            BorderBrush = ThemeService.Brush(p.Accent),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(6, 1, 6, 2)
        };
        timePill.Child = new TextBlock
        {
            Text = now.ToString("HH:mm"),
            FontSize = 10.5,
            FontWeight = FontWeights.SemiBold,
            Foreground = ThemeService.Brush(p.AccentText)
        };
        Canvas.SetLeft(timePill, 10);
        Canvas.SetTop(timePill, y - 10);
        CurrentTimeCanvas.Children.Add(timePill);
    }

    private void SwitchToMode(CalendarDisplayMode mode)
    {
        _currentMode = mode;

        ModeMonthlyRadio.IsChecked = mode == CalendarDisplayMode.Monthly;
        ModeWeeklyRadio.IsChecked = mode == CalendarDisplayMode.Weekly;
        ModeDailyRadio.IsChecked = mode == CalendarDisplayMode.Daily;

        RefreshCalendar();
    }

    private void CalendarMode_Checked(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || sender is not RadioButton rb || rb.Tag is not string tag)
        {
            return;
        }

        _currentMode = tag switch
        {
            "Weekly" => CalendarDisplayMode.Weekly,
            "Daily" => CalendarDisplayMode.Daily,
            _ => CalendarDisplayMode.Monthly
        };

        RefreshCalendar();
    }

    private void PrevButton_Click(object sender, RoutedEventArgs e)
    {
        _selectedDate = _currentMode switch
        {
            CalendarDisplayMode.Monthly => _selectedDate.AddMonths(-1),
            CalendarDisplayMode.Weekly => _selectedDate.AddDays(-7),
            CalendarDisplayMode.Daily => _selectedDate.AddDays(-1),
            _ => _selectedDate
        };

        RefreshCalendar();
    }

    private void NextButton_Click(object sender, RoutedEventArgs e)
    {
        _selectedDate = _currentMode switch
        {
            CalendarDisplayMode.Monthly => _selectedDate.AddMonths(1),
            CalendarDisplayMode.Weekly => _selectedDate.AddDays(7),
            CalendarDisplayMode.Daily => _selectedDate.AddDays(1),
            _ => _selectedDate
        };

        RefreshCalendar();
    }

    private void TodayButton_Click(object sender, RoutedEventArgs e)
    {
        _selectedDate = DateTime.Today;
        RefreshCalendar();
    }

    private void MonthYearComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_suppressComboEvents || !IsLoaded)
        {
            return;
        }

        if (MonthComboBox.SelectedIndex < 0 || YearComboBox.SelectedItem is not int year)
        {
            return;
        }

        var month = MonthComboBox.SelectedIndex + 1;
        var day = Math.Min(_selectedDate.Day, DateTime.DaysInMonth(year, month));
        _selectedDate = new DateTime(year, month, day);

        RefreshCalendar();
    }

    private static DateTime GetMondayOfWeek(DateTime date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.Date.AddDays(-diff);
    }

    private static string FormatHoursShort(int totalSeconds)
    {
        if (totalSeconds <= 0)
        {
            return "0s";
        }

        var hours = totalSeconds / 3600.0;
        return $"{hours:0.0}s";
    }

    private static string FormatMinutesReadable(int minutes)
    {
        if (minutes <= 0)
        {
            return "0dk";
        }

        var h = minutes / 60;
        var m = minutes % 60;
        if (h == 0)
        {
            return $"{m}dk";
        }

        return m == 0 ? $"{h}s" : $"{h}s {m}dk";
    }

    private static string FormatDurationCompact(int totalSeconds)
    {
        if (totalSeconds <= 0)
        {
            return "0dk";
        }

        var h = totalSeconds / 3600;
        var m = (totalSeconds % 3600) / 60;
        var s = totalSeconds % 60;

        if (h > 0)
        {
            return m > 0 ? $"{h}s {m}dk" : $"{h}s";
        }

        if (m > 0)
        {
            return $"{m}dk";
        }

        return $"{s}sn";
    }
}
