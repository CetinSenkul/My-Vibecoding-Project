using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using TimePlannerApp.Models;
using TimePlannerApp.Services;

namespace TimePlannerApp.Views;

public partial class GoalSummaryPanel : UserControl
{
    public event Action? ManageGoalsRequested;

    public GoalSummaryPanel()
    {
        InitializeComponent();
        Loaded += (_, _) => RefreshSummary();
    }

    public void RefreshSummary()
    {
        if (!IsLoaded)
        {
            return;
        }

        var summaries = App.Database.GetActiveGoalSummaries(DateTime.Today);
        var processGoals = summaries.Where(s => s.Goal.Type == "Process").ToList();
        var taskGoals = summaries.Where(s => s.Goal.Type == "Task").ToList();

        ProcessSummaryStack.Children.Clear();
        if (processGoals.Count == 0)
        {
            ProcessSummaryStack.Children.Add(CreateCompactEmpty("Henüz süreç hedefi yok. 'Yönet' ile ekleyin."));
        }
        else
        {
            foreach (var item in processGoals)
            {
                ProcessSummaryStack.Children.Add(CreateCompactProcessCard(item));
            }
        }

        TaskSummaryStack.Children.Clear();
        if (taskGoals.Count == 0)
        {
            TaskSummaryStack.Children.Add(CreateCompactEmpty("Henüz görev hedefi yok. 'Yönet' ile ekleyin."));
        }
        else
        {
            foreach (var item in taskGoals)
            {
                TaskSummaryStack.Children.Add(CreateCompactTaskCard(item));
            }
        }
    }

    private static Border CreateCompactProcessCard(GoalSummary summary)
    {
        var p = ThemeService.CurrentPalette;
        var card = new Border
        {
            Background = ThemeService.Brush(p.BgCard),
            BorderBrush = ThemeService.Brush(p.BorderSubtle),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(9),
            Padding = new Thickness(12, 9, 12, 9),
            Margin = new Thickness(0, 0, 0, 7)
        };

        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var left = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        left.Children.Add(new TextBlock
        {
            Text = summary.Goal.Title,
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            Foreground = ThemeService.Brush(p.TextPrimary),
            TextTrimming = TextTrimming.CharacterEllipsis
        });
        left.Children.Add(new TextBlock
        {
            Text = $"Toplam {summary.TotalSessionCount} oturum",
            FontSize = 11,
            Foreground = ThemeService.Brush(p.TextSecondary)
        });
        Grid.SetColumn(left, 0);
        grid.Children.Add(left);

        var pill = new Border
        {
            Background = ThemeService.Brush(p.AccentSurface),
            BorderBrush = ThemeService.Brush(p.BorderActive),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(6),
            Padding = new Thickness(9, 4, 9, 4),
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(8, 0, 0, 0)
        };
        pill.Child = new TextBlock
        {
            Text = FormatDurationShort(summary.TotalDurationSeconds),
            FontSize = 11.5,
            FontWeight = FontWeights.SemiBold,
            Foreground = ThemeService.Brush(p.AccentText)
        };
        Grid.SetColumn(pill, 1);
        grid.Children.Add(pill);

        card.Child = grid;
        return card;
    }

    private static Border CreateCompactTaskCard(GoalSummary summary)
    {
        var pct = ColorScaleService.CalculateCompletionPercent(summary.WeeklyDurationSeconds, summary.Goal.WeeklyMinMinutes);
        var pctDisplay = summary.WeeklyDurationSeconds > 0 && pct < 1.0
            ? 1
            : (int)Math.Round(pct);
        var actualHours = summary.WeeklyDurationSeconds / 3600.0;
        var targetHours = summary.Goal.WeeklyMinMinutes / 60.0;
        var colorInfo = ColorScaleService.GetColorInfo(pct);
        var hasWork = colorInfo.Tier != PerformanceTier.Zero;
        var defaultBorderBrush = colorInfo.CreateBorderBrush();
        var ambientGlow = colorInfo.CreateGlowEffect(0.70);

        var card = new Border
        {
            Background = colorInfo.CreateSurfaceBrush(),
            BorderBrush = defaultBorderBrush,
            BorderThickness = new Thickness(1.2),
            CornerRadius = new CornerRadius(9),
            Padding = new Thickness(12, 9, 12, 9),
            Margin = new Thickness(4, 2, 4, 8),
            Effect = ambientGlow,
            ToolTip = $"{summary.Goal.Title}\nBu Hafta: {actualHours:0.1}s / {targetHours:0.1}s (%{pctDisplay})\nDurum: {colorInfo.TierLabel}"
        };

        var stack = new StackPanel();
        var topRow = new Grid { Margin = new Thickness(0, 0, 0, 7) };
        topRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        topRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var title = new TextBlock
        {
            Text = summary.Goal.Title,
            FontSize = 13,
            FontWeight = FontWeights.SemiBold,
            Foreground = ThemeService.Brush(ThemeService.CurrentPalette.TextPrimary),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        Grid.SetColumn(title, 0);
        topRow.Children.Add(title);

        var ratio = new TextBlock
        {
            Text = $"{actualHours:0.1} / {targetHours:0.1}s • %{pctDisplay}",
            FontSize = 11.5,
            FontWeight = FontWeights.SemiBold,
            Foreground = hasWork
                ? colorInfo.CreateAccentTextBrush()
                : ThemeService.Brush(ThemeService.CurrentPalette.TextSecondary),
            Margin = new Thickness(8, 0, 0, 0)
        };
        Grid.SetColumn(ratio, 1);
        topRow.Children.Add(ratio);

        stack.Children.Add(topRow);

        var track = new Border
        {
            Height = 6,
            CornerRadius = new CornerRadius(3),
            Background = new SolidColorBrush(Color.FromArgb(0x99, 0x0A, 0x0F, 0x18)),
            ClipToBounds = true
        };

        var clampedRatio = Math.Clamp(pct / 100.0, 0.0, 1.0);
        if (clampedRatio > 0)
        {
            var fillGrid = new Grid();
            fillGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(clampedRatio, GridUnitType.Star) });
            if (clampedRatio < 1.0)
            {
                fillGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.0 - clampedRatio, GridUnitType.Star) });
            }

            var fillBar = new Border
            {
                Background = colorInfo.CreatePrimaryBrush(),
                CornerRadius = new CornerRadius(3)
            };
            Grid.SetColumn(fillBar, 0);
            fillGrid.Children.Add(fillBar);

            track.Child = fillGrid;
        }
        stack.Children.Add(track);

        card.Child = stack;

        if (hasWork)
        {
            card.MouseEnter += (_, _) =>
            {
                card.BorderBrush = colorInfo.CreatePrimaryBrush();
                card.Effect = colorInfo.CreateGlowEffect(1.0);
            };
            card.MouseLeave += (_, _) =>
            {
                card.BorderBrush = defaultBorderBrush;
                card.Effect = ambientGlow;
            };
        }

        return card;
    }

    private static Border CreateCompactEmpty(string text)
    {
        var p = ThemeService.CurrentPalette;
        return new Border
        {
            Background = ThemeService.Brush(p.BgInput),
            BorderBrush = ThemeService.Brush(p.BorderSubtle),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            Padding = new Thickness(12, 16, 12, 16),
            Child = new TextBlock
            {
                Text = text,
                FontSize = 11.5,
                Foreground = ThemeService.Brush(p.TextSecondary),
                TextAlignment = TextAlignment.Center
            }
        };
    }

    private void ManageGoalsButton_Click(object sender, RoutedEventArgs e)
    {
        ManageGoalsRequested?.Invoke();
    }

    private static string FormatDurationShort(int totalSeconds)
    {
        var totalMinutes = totalSeconds / 60;
        var hours = totalMinutes / 60;
        var minutes = totalMinutes % 60;
        if (hours == 0)
        {
            return $"{minutes}dk";
        }

        return $"{hours}s {minutes}dk";
    }
}
