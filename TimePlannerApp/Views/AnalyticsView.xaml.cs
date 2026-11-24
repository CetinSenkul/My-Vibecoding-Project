using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using LiveChartsCore;
using LiveChartsCore.Defaults;
using LiveChartsCore.Kernel;
using LiveChartsCore.Kernel.Sketches;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Drawing.Geometries;
using LiveChartsCore.SkiaSharpView.Painting;
using LiveChartsCore.SkiaSharpView.Painting.ImageFilters;
using SkiaSharp;
using TimePlannerApp.Services;

namespace TimePlannerApp.Views;

public partial class AnalyticsView : UserControl
{
    private sealed class GoalBarDatum
    {
        public int Index { get; init; }
        public double Hours { get; init; }
        public GoalAnalyticsItem Item { get; init; } = null!;
    }

    private sealed class ScatterDotDatum
    {
        public double X { get; init; }
        public double Y { get; init; }
        public double Weight { get; init; }
        public TaskScatterPointInfo Info { get; init; } = null!;
    }

    private readonly string _timeFilterGroupName = $"AnalyticsFilter_{Guid.NewGuid():N}";
    private readonly string _scatterGroupName = $"ScatterPeriod_{Guid.NewGuid():N}";

    private AnalyticsService? _analytics;
    private AnalyticsTimeFilter _activeFilter = AnalyticsTimeFilter.Weekly;
    private TaskScatterPeriod _activeScatterPeriod = TaskScatterPeriod.Weekly;
    private bool _isCompactMode;
    private Point _lastPointerPos = new(60, 60);
    private bool _tooltipActive;

    // Hover glow state tracking
    private RoundedRectangleGeometry? _hoveredBarVisual;
    private GoalBarDatum? _hoveredBarDatum;
    private CircleGeometry? _hoveredDotVisual;
    private ScatterDotDatum? _hoveredDotDatum;

    public bool IsCompactMode
    {
        get => _isCompactMode;
        set
        {
            _isCompactMode = value;
            ApplyCompactLayout();
        }
    }

    public AnalyticsView()
    {
        InitializeComponent();

        // Birden fazla AnalyticsView (Dashboard + Analiz sekmesi) aynı anda yaşarken RadioButton gruplarını izole et
        FilterDailyRadio.GroupName = _timeFilterGroupName;
        FilterWeeklyRadio.GroupName = _timeFilterGroupName;
        FilterMonthlyRadio.GroupName = _timeFilterGroupName;
        FilterOverallRadio.GroupName = _timeFilterGroupName;

        ScatterDailyRadio.GroupName = _scatterGroupName;
        ScatterWeeklyRadio.GroupName = _scatterGroupName;
        ScatterMonthlyRadio.GroupName = _scatterGroupName;

        Loaded += AnalyticsView_Loaded;
    }

    private void AnalyticsView_Loaded(object sender, RoutedEventArgs e)
    {
        _analytics ??= new AnalyticsService(App.Database);
        ApplyCompactLayout();
        RefreshAnalytics();
    }

    private void ApplyCompactLayout()
    {
        if (KpiStripGrid == null)
        {
            return;
        }

        KpiStripGrid.Visibility = _isCompactMode ? Visibility.Collapsed : Visibility.Visible;
        DonutCenterValueText.FontSize = _isCompactMode ? 14 : 22;
        DonutCenterLabelText.FontSize = _isCompactMode ? 9.5 : 12;
        DonutTitleText.FontSize = _isCompactMode ? 11.5 : 14.5;
        ColumnTitleText.FontSize = _isCompactMode ? 11.5 : 14.5;
        ScatterTitleText.FontSize = _isCompactMode ? 11.5 : 14.5;
        ScatterTitleText.Text = _isCompactMode ? "Görev Nokta Dağılımı" : "Görev Grafiği (Nokta Dağılımı)";
    }

    public void RefreshAnalytics()
    {
        if (!IsLoaded)
        {
            return;
        }

        _analytics ??= new AnalyticsService(App.Database);
        HideRpgTooltip();

        var overview = _analytics.GetOverview(_activeFilter, DateTime.Today);
        UpdateKpis(overview);
        BuildDonutChart(overview);
        BuildColumnChart(overview);

        var scatter = _analytics.GetTaskScatter(_activeScatterPeriod, DateTime.Today);
        BuildScatterChart(scatter);
    }

    private void UpdateKpis(AnalyticsSnapshot snapshot)
    {
        KpiTotalTimeText.Text = FormatDurationVerbose(snapshot.TotalSeconds);
        KpiSessionsText.Text = $"{snapshot.TotalSessions} oturum";
        KpiTopGoalText.Text = snapshot.TopGoalTitle;
        KpiActiveDaysText.Text = $"{snapshot.ActiveDaysCount} gün";

        var totalHours = snapshot.TotalSeconds / 3600.0;
        DonutCenterValueText.Text = snapshot.TotalSeconds > 0 && totalHours < 0.1
            ? $"{Math.Max(1, snapshot.TotalSeconds / 60)}dk"
            : $"{totalHours:0.1}s";
        DonutCenterLabelText.Text = snapshot.FilterLabel;
    }

    private void BuildDonutChart(AnalyticsSnapshot snapshot)
    {
        if (snapshot.Items.Count == 0)
        {
            DonutChart.Series = Array.Empty<ISeries>();
            DonutCenterOverlay.Visibility = Visibility.Collapsed;
            DonutEmptyText.Visibility = Visibility.Visible;
            return;
        }

        DonutCenterOverlay.Visibility = Visibility.Visible;
        DonutEmptyText.Visibility = Visibility.Collapsed;

        var innerRadius = _isCompactMode ? 32 : 68;
        var pushout = _isCompactMode ? 6 : 11;
        var seriesList = new List<ISeries>();

        foreach (var item in snapshot.Items)
        {
            var skColor = ToSkColor(item.AccentColor);
            var capturedItem = item;
            var normalFill = new SolidColorPaint(skColor);
            var glowFill = new SolidColorPaint(Brighten(skColor, 1.18f))
            {
                ImageFilter = new DropShadow(0, 0, 10, 10, skColor)
            };

            var pieSeries = new PieSeries<double>
            {
                Name = item.Title,
                Values = new[] { Math.Max(0.001, item.DurationHours) },
                InnerRadius = innerRadius,
                HoverPushout = pushout,
                Fill = normalFill,
                Stroke = new SolidColorPaint(new SKColor(0x13, 0x1A, 0x27)) { StrokeThickness = 2 },
                DataLabelsPaint = null,
                IsHoverable = true
            };

            pieSeries.ChartPointPointerHover += (_, point) =>
            {
                if (point == null)
                {
                    return;
                }

                pieSeries.Fill = glowFill;
                ShowGoalRpgTooltip(capturedItem, snapshot.FilterLabel);
            };

            pieSeries.ChartPointPointerHoverLost += (_, _) =>
            {
                pieSeries.Fill = normalFill;
                HideRpgTooltip();
            };

            seriesList.Add(pieSeries);
        }

        DonutChart.Series = seriesList;
    }

    private void BuildColumnChart(AnalyticsSnapshot snapshot)
    {
        _hoveredBarVisual = null;
        _hoveredBarDatum = null;

        if (snapshot.Items.Count == 0)
        {
            ColumnChart.Series = Array.Empty<ISeries>();
            ColumnChart.XAxes = Array.Empty<Axis>();
            ColumnChart.YAxes = Array.Empty<Axis>();
            ColumnEmptyText.Visibility = Visibility.Visible;
            return;
        }

        ColumnEmptyText.Visibility = Visibility.Collapsed;

        // Kompakt modda en çok çalışılan ilk 6 hedef, tam ekranda ilk 12 hedef
        var maxBars = _isCompactMode ? 6 : 12;
        var topItems = snapshot.Items.Take(maxBars).ToList();
        var data = topItems
            .Select((item, idx) => new GoalBarDatum
            {
                Index = idx,
                Hours = Math.Round(Math.Max(0.02, item.DurationHours), 2),
                Item = item
            })
            .ToList();

        var columnSeries = new ColumnSeries<GoalBarDatum>
        {
            Values = data,
            Mapping = (datum, _) => new Coordinate(datum.Index, datum.Hours),
            Rx = 5,
            Ry = 5,
            MaxBarWidth = _isCompactMode ? 22 : 42,
            Padding = _isCompactMode ? 4 : 8,
            Fill = new SolidColorPaint(new SKColor(0x5B, 0x9B, 0xF8)),
            IsHoverable = true
        };

        columnSeries.PointMeasured += point =>
        {
            if (point.Model is not GoalBarDatum datum || point.Visual == null)
            {
                return;
            }

            var skColor = ToSkColor(datum.Item.AccentColor);
            point.Visual.Fill = new SolidColorPaint(skColor);
            point.Visual.Stroke = null;
        };

        columnSeries.ChartPointPointerHover += (_, point) =>
        {
            if (point?.Model is not GoalBarDatum datum)
            {
                return;
            }

            RestoreHoveredBar();

            if (point.Visual is RoundedRectangleGeometry visual)
            {
                var skColor = ToSkColor(datum.Item.AccentColor);
                visual.Fill = new SolidColorPaint(Brighten(skColor, 1.2f))
                {
                    ImageFilter = new DropShadow(0, 0, 12, 12, skColor)
                };
                visual.Stroke = new SolidColorPaint(SKColors.White) { StrokeThickness = 1.6f };
                _hoveredBarVisual = visual;
                _hoveredBarDatum = datum;
            }

            ShowGoalRpgTooltip(datum.Item, snapshot.FilterLabel);
        };

        columnSeries.ChartPointPointerHoverLost += (_, _) =>
        {
            RestoreHoveredBar();
            HideRpgTooltip();
        };

        ColumnChart.Series = [columnSeries];

        var labelPaint = new SolidColorPaint(new SKColor(0x94, 0xA3, 0xB8));
        var separatorPaint = new SolidColorPaint(new SKColor(0x1E, 0x29, 0x3B)) { StrokeThickness = 1 };

        ColumnChart.XAxes =
        [
            new Axis
            {
                Labels = topItems.Select(x => x.ShortLabel).ToArray(),
                LabelsPaint = labelPaint,
                TextSize = _isCompactMode ? 9.5f : 11.5f,
                MinStep = 1,
                ForceStepToMin = true,
                SeparatorsPaint = null,
                TicksPaint = null
            }
        ];

        ColumnChart.YAxes =
        [
            new Axis
            {
                MinLimit = 0,
                LabelsPaint = _isCompactMode ? null : labelPaint,
                TextSize = 11f,
                Labeler = val => $"{val:0.#}s",
                SeparatorsPaint = separatorPaint,
                TicksPaint = null
            }
        ];
    }

    private void RestoreHoveredBar()
    {
        if (_hoveredBarVisual != null && _hoveredBarDatum != null)
        {
            var skColor = ToSkColor(_hoveredBarDatum.Item.AccentColor);
            _hoveredBarVisual.Fill = new SolidColorPaint(skColor);
            _hoveredBarVisual.Stroke = null;
        }

        _hoveredBarVisual = null;
        _hoveredBarDatum = null;
    }

    private void BuildScatterChart(TaskScatterSnapshot snapshot)
    {
        _hoveredDotVisual = null;
        _hoveredDotDatum = null;

        if (snapshot.TaskLabels.Count == 0)
        {
            ScatterChart.Series = Array.Empty<ISeries>();
            ScatterChart.XAxes = Array.Empty<Axis>();
            ScatterChart.YAxes = Array.Empty<Axis>();
            ScatterEmptyText.Visibility = Visibility.Visible;
            return;
        }

        ScatterEmptyText.Visibility = Visibility.Collapsed;

        // Her performans dilimi (ve %0 soluk referans noktaları) için ayrı ScatterSeries
        var tiers = new[]
        {
            PerformanceTier.Zero,
            PerformanceTier.Red,
            PerformanceTier.Orange,
            PerformanceTier.Yellow,
            PerformanceTier.Green,
            PerformanceTier.Blue
        };

        var seriesList = new List<ISeries>();
        var minDot = _isCompactMode ? 7.0 : 12.0;
        var maxDot = _isCompactMode ? 15.0 : 26.0;

        foreach (var tier in tiers)
        {
            var tierPoints = snapshot.Points
                .Where(p => p.Tier == tier)
                .Select(p => new ScatterDotDatum
                {
                    X = p.BucketIndex,
                    Y = p.TaskRowIndex,
                    Weight = tier == PerformanceTier.Zero
                        ? 1.0
                        : Math.Clamp(p.CompletionPercent, 20.0, 140.0),
                    Info = p
                })
                .ToList();

            if (tierPoints.Count == 0)
            {
                continue;
            }

            var isZero = tier == PerformanceTier.Zero;
            var colorInfo = ColorScaleService.GetColorInfo(tier);
            var skColor = isZero
                ? new SKColor(0x28, 0x35, 0x4A)
                : ToSkColor(colorInfo.PrimaryColor);

            var normalFill = isZero
                ? new SolidColorPaint(skColor)
                : new SolidColorPaint(skColor)
                {
                    ImageFilter = new DropShadow(0, 0, 6, 6, skColor)
                };

            var scatterSeries = new ScatterSeries<ScatterDotDatum>
            {
                Name = colorInfo.TierLabel,
                Values = tierPoints,
                Mapping = (d, _) => new Coordinate(d.X, d.Y, d.Weight),
                GeometrySize = isZero ? (_isCompactMode ? 4.5 : 6.0) : maxDot,
                MinGeometrySize = isZero ? (_isCompactMode ? 4.5 : 6.0) : minDot,
                Fill = normalFill,
                Stroke = isZero ? null : new SolidColorPaint(Brighten(skColor, 1.25f)) { StrokeThickness = 1.2f },
                IsHoverable = true
            };

            scatterSeries.ChartPointPointerHover += (_, point) =>
            {
                if (point?.Model is not ScatterDotDatum datum)
                {
                    return;
                }

                RestoreHoveredDot();

                if (point.Visual is CircleGeometry circle)
                {
                    circle.Stroke = new SolidColorPaint(SKColors.White) { StrokeThickness = 2.4f };
                    _hoveredDotVisual = circle;
                    _hoveredDotDatum = datum;
                }

                ShowScatterRpgTooltip(datum.Info, snapshot.PeriodLabel);
            };

            scatterSeries.ChartPointPointerHoverLost += (_, _) =>
            {
                RestoreHoveredDot();
                HideRpgTooltip();
            };

            seriesList.Add(scatterSeries);
        }

        ScatterChart.Series = seriesList;

        var labelPaint = new SolidColorPaint(new SKColor(0x94, 0xA3, 0xB8));
        var gridPaint = new SolidColorPaint(new SKColor(0x1B, 0x25, 0x36)) { StrokeThickness = 1 };

        ScatterChart.XAxes =
        [
            new Axis
            {
                Labels = snapshot.BucketLabels.ToArray(),
                LabelsPaint = labelPaint,
                TextSize = _isCompactMode ? 9.5f : 11.5f,
                MinLimit = -0.5,
                MaxLimit = snapshot.BucketLabels.Count - 0.5,
                MinStep = 1,
                ForceStepToMin = true,
                SeparatorsPaint = null,
                TicksPaint = null
            }
        ];

        ScatterChart.YAxes =
        [
            new Axis
            {
                Labels = snapshot.TaskLabels.ToArray(),
                LabelsPaint = labelPaint,
                TextSize = _isCompactMode ? 9.5f : 12f,
                MinLimit = -0.5,
                MaxLimit = snapshot.TaskLabels.Count - 0.5,
                MinStep = 1,
                ForceStepToMin = true,
                SeparatorsPaint = gridPaint,
                TicksPaint = null
            }
        ];
    }

    private void RestoreHoveredDot()
    {
        if (_hoveredDotVisual != null && _hoveredDotDatum != null)
        {
            if (_hoveredDotDatum.Info.Tier == PerformanceTier.Zero)
            {
                _hoveredDotVisual.Stroke = null;
            }
            else
            {
                var c = ToSkColor(ColorScaleService.GetColorInfo(_hoveredDotDatum.Info.Tier).PrimaryColor);
                _hoveredDotVisual.Stroke = new SolidColorPaint(Brighten(c, 1.25f)) { StrokeThickness = 1.2f };
            }
        }

        _hoveredDotVisual = null;
        _hoveredDotDatum = null;
    }

    private void ShowGoalRpgTooltip(GoalAnalyticsItem item, string filterLabel)
    {
        var accent = item.AccentColor;
        var accentBrush = new SolidColorBrush(accent);

        RpgTooltipCard.BorderBrush = accentBrush;
        RpgTooltipGlow.Color = accent;

        TooltipTitleText.Text = item.Title;
        TooltipTitleText.Foreground = accentBrush;

        var isTask = item.GoalType == "Task";
        TooltipBadgeText.Text = isTask ? "GÖREV" : "SÜREÇ";
        TooltipBadgeBorder.BorderBrush = accentBrush;

        var timeText = item.DurationHours >= 0.1
            ? $"{item.DurationHours:0.1} Saat"
            : FormatDurationVerbose(item.DurationSeconds);

        var sharePctRounded = (int)Math.Round(item.SharePercent);
        TooltipPrimaryStatText.Text = $"{timeText} (Pay: %{sharePctRounded})";

        if (isTask && item.PeriodTargetMinutes > 0)
        {
            var targetHrs = item.PeriodTargetMinutes / 60.0;
            var completionRounded = (int)Math.Round(item.TaskCompletionPercent);
            TooltipSecondaryStatText.Text = $"{filterLabel} Hedef: {targetHrs:0.1} Saat • %{completionRounded}";
        }
        else
        {
            TooltipSecondaryStatText.Text = $"{filterLabel} • Toplam {item.SessionCount} oturum";
        }

        _tooltipActive = true;
        RpgTooltipCard.Visibility = Visibility.Visible;
        PositionTooltip(_lastPointerPos);
    }

    private void ShowScatterRpgTooltip(TaskScatterPointInfo info, string periodLabel)
    {
        var colorInfo = ColorScaleService.GetColorInfo(info.Tier);
        var accent = info.Tier == PerformanceTier.Zero
            ? Color.FromRgb(0x64, 0x74, 0x8B)
            : colorInfo.PrimaryColor;
        var accentBrush = new SolidColorBrush(accent);

        RpgTooltipCard.BorderBrush = accentBrush;
        RpgTooltipGlow.Color = accent;

        TooltipTitleText.Text = info.GoalTitle;
        TooltipTitleText.Foreground = info.Tier == PerformanceTier.Zero
            ? new SolidColorBrush(Color.FromRgb(0xCB, 0xD5, 0xE1))
            : colorInfo.CreateAccentTextBrush();

        TooltipBadgeText.Text = info.BucketLabel.ToUpperInvariant();
        TooltipBadgeBorder.BorderBrush = accentBrush;

        var pctDisplay = info.DurationSeconds > 0 && info.CompletionPercent < 1.0
            ? 1
            : (int)Math.Round(info.CompletionPercent);

        if (info.DurationSeconds == 0)
        {
            TooltipPrimaryStatText.Text = $"{info.BucketLabel}: Çalışma yok (%0)";
        }
        else
        {
            var hrs = info.DurationHours >= 0.1
                ? $"{info.DurationHours:0.1}s"
                : FormatDurationVerbose(info.DurationSeconds);
            TooltipPrimaryStatText.Text = $"{info.BucketLabel}: {hrs} (%{pctDisplay})";
        }

        var targetHrs = info.TargetBucketMinutes / 60.0;
        TooltipSecondaryStatText.Text = $"{periodLabel} Dilim Hedefi: {targetHrs:0.1}s • {colorInfo.TierLabel}";

        _tooltipActive = true;
        RpgTooltipCard.Visibility = Visibility.Visible;
        PositionTooltip(_lastPointerPos);
    }

    private void HideRpgTooltip()
    {
        _tooltipActive = false;
        if (RpgTooltipCard != null)
        {
            RpgTooltipCard.Visibility = Visibility.Collapsed;
        }
    }

    private void RootAnalyticsGrid_MouseMove(object sender, MouseEventArgs e)
    {
        _lastPointerPos = e.GetPosition(RootAnalyticsGrid);
        if (_tooltipActive)
        {
            PositionTooltip(_lastPointerPos);
        }
    }

    private void RootAnalyticsGrid_MouseLeave(object sender, MouseEventArgs e)
    {
        RestoreHoveredBar();
        RestoreHoveredDot();
        HideRpgTooltip();
    }

    private void PositionTooltip(Point pointer)
    {
        if (RpgTooltipCard.Visibility != Visibility.Visible)
        {
            return;
        }

        RpgTooltipCard.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
        var cardW = RpgTooltipCard.DesiredSize.Width;
        var cardH = RpgTooltipCard.DesiredSize.Height;

        const double offset = 14.0;
        var left = pointer.X + offset;
        var top = pointer.Y - cardH - 10;

        if (left + cardW > RootAnalyticsGrid.ActualWidth - 6)
        {
            left = Math.Max(6, pointer.X - cardW - offset);
        }

        if (top < 6)
        {
            top = Math.Min(RootAnalyticsGrid.ActualHeight - cardH - 6, pointer.Y + offset);
        }

        Canvas.SetLeft(RpgTooltipCard, Math.Max(4, left));
        Canvas.SetTop(RpgTooltipCard, Math.Max(4, top));
    }

    private void TimeFilter_Checked(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || sender is not RadioButton rb || rb.Tag is not string tag)
        {
            return;
        }

        _activeFilter = tag switch
        {
            "Daily" => AnalyticsTimeFilter.Daily,
            "Monthly" => AnalyticsTimeFilter.Monthly,
            "Overall" => AnalyticsTimeFilter.Overall,
            _ => AnalyticsTimeFilter.Weekly
        };

        RefreshAnalytics();
    }

    private void ScatterPeriod_Checked(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || sender is not RadioButton rb || rb.Tag is not string tag)
        {
            return;
        }

        _activeScatterPeriod = tag switch
        {
            "Daily" => TaskScatterPeriod.Daily,
            "Monthly" => TaskScatterPeriod.Monthly,
            _ => TaskScatterPeriod.Weekly
        };

        if (_analytics != null)
        {
            var scatter = _analytics.GetTaskScatter(_activeScatterPeriod, DateTime.Today);
            BuildScatterChart(scatter);
        }
    }

    private static SKColor ToSkColor(Color color) => new(color.R, color.G, color.B, color.A);

    private static SKColor Brighten(SKColor color, float factor)
    {
        var r = (byte)Math.Clamp((int)(color.Red * factor), 0, 255);
        var g = (byte)Math.Clamp((int)(color.Green * factor), 0, 255);
        var b = (byte)Math.Clamp((int)(color.Blue * factor), 0, 255);
        return new SKColor(r, g, b, color.Alpha);
    }

    private static string FormatDurationVerbose(int totalSeconds)
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
