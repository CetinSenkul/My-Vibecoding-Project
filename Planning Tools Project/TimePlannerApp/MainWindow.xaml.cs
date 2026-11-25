using System.ComponentModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;
using System.Windows.Threading;
using TimePlannerApp.Services;

namespace TimePlannerApp;

public partial class MainWindow : Window
{
    private readonly DispatcherTimer _clockTimer;
    private readonly CultureInfo _trCulture = new("tr-TR");
    private DateTime _lastKnownDate = DateTime.Today;
    private bool _suppressThemeCombo;
    private bool _starsBuilt;

    public MainWindow()
    {
        InitializeComponent();

        StateChanged += MainWindow_StateChanged;
        Closing += MainWindow_Closing;
        SizeChanged += (_, _) =>
        {
            if (ThemeService.CurrentPalette.IsSpace)
            {
                BuildSpaceBackdrop();
            }
        };

        CalendarViewControl.DayOffsChanged += OnDataChanged;
        GoalsViewControl.GoalsChanged += OnDataChanged;
        SettingsViewControl.TargetsChanged += OnDataChanged;
        GoalSummaryControl.ManageGoalsRequested += () => NavGoals.IsChecked = true;

        DashboardStopwatchControl.NavigateToGoalsRequested += () => NavGoals.IsChecked = true;
        StopwatchViewControl.NavigateToGoalsRequested += () => NavGoals.IsChecked = true;
        StopwatchViewControl.SessionsChanged += OnDataChanged;
        StopwatchViewControl.OpenDailyTimelineRequested += OpenTodayInDailyTimeline;

        if (App.Stopwatch != null)
        {
            App.Stopwatch.SessionSaved += _ => OnDataChanged();
        }

        ThemeService.ThemeChanged += OnThemeChanged;

        _clockTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(1)
        };
        _clockTimer.Tick += ClockTimer_Tick;
        _clockTimer.Start();
        Closed += (_, _) =>
        {
            _clockTimer.Stop();
            ThemeService.ThemeChanged -= OnThemeChanged;
        };

        Loaded += (_, _) => OnThemeChanged();
        UpdateClockAndStatus();
    }

    private void OnThemeChanged()
    {
        _suppressThemeCombo = true;
        var modeTag = ThemeService.CurrentMode.ToString();
        foreach (ComboBoxItem item in QuickThemeComboBox.Items)
        {
            if (item.Tag as string == modeTag)
            {
                QuickThemeComboBox.SelectedItem = item;
                break;
            }
        }
        _suppressThemeCombo = false;

        if (ThemeService.CurrentMode == AppThemeMode.Seasons)
        {
            ActiveSeasonChipText.Text = ThemeService.CurrentPalette.DisplaySubtitle;
            ActiveSeasonChip.Visibility = Visibility.Visible;
        }
        else
        {
            ActiveSeasonChip.Visibility = Visibility.Collapsed;
        }

        if (ThemeService.CurrentPalette.IsSpace)
        {
            SpaceBackdropCanvas.Visibility = Visibility.Visible;
            if (!_starsBuilt)
            {
                BuildSpaceBackdrop();
            }
        }
        else
        {
            SpaceBackdropCanvas.Visibility = Visibility.Collapsed;
        }

        // Dinamik kod-arkası görünümleri yeni tema paletiyle yenile
        CalendarViewControl.RefreshCalendar();
        GoalSummaryControl.RefreshSummary();
        GoalsViewControl.RefreshGoals();
        DashboardAnalyticsControl.RefreshAnalytics();
        FullAnalyticsViewControl.RefreshAnalytics();
        StopwatchViewControl.RefreshTodaySessions();
        SettingsViewControl.SyncSelectedThemeCard();
    }

    private void BuildSpaceBackdrop()
    {
        var w = Math.Max(1200, ActualWidth);
        var h = Math.Max(800, ActualHeight);

        SpaceBackdropCanvas.Children.Clear();

        // Yumuşak mor & mavi nebula parıltıları
        var nebula1 = new Ellipse
        {
            Width = 520,
            Height = 520,
            Fill = new RadialGradientBrush(
                Color.FromArgb(0x38, 0x7C, 0x3A, 0xED),
                Color.FromArgb(0x00, 0x7C, 0x3A, 0xED))
        };
        Canvas.SetLeft(nebula1, w * 0.12);
        Canvas.SetTop(nebula1, -80);
        SpaceBackdropCanvas.Children.Add(nebula1);

        var nebula2 = new Ellipse
        {
            Width = 580,
            Height = 580,
            Fill = new RadialGradientBrush(
                Color.FromArgb(0x32, 0x25, 0x63, 0xEB),
                Color.FromArgb(0x00, 0x25, 0x63, 0xEB))
        };
        Canvas.SetLeft(nebula2, w * 0.62);
        Canvas.SetTop(nebula2, h * 0.35);
        SpaceBackdropCanvas.Children.Add(nebula2);

        var nebula3 = new Ellipse
        {
            Width = 380,
            Height = 380,
            Fill = new RadialGradientBrush(
                Color.FromArgb(0x24, 0xA8, 0x55, 0xF7),
                Color.FromArgb(0x00, 0xA8, 0x55, 0xF7))
        };
        Canvas.SetLeft(nebula3, w * 0.35);
        Canvas.SetTop(nebula3, h * 0.62);
        SpaceBackdropCanvas.Children.Add(nebula3);

        // Sabit seed ile estetik yıldız dağılımı
        var rng = new Random(2026);
        for (var i = 0; i < 85; i++)
        {
            var size = rng.NextDouble() < 0.2 ? 2.6 : (rng.NextDouble() < 0.55 ? 1.8 : 1.2);
            var alpha = (byte)rng.Next(70, 210);
            var color = i % 5 == 0
                ? Color.FromArgb(alpha, 0xC4, 0xB5, 0xFD)
                : i % 7 == 0
                    ? Color.FromArgb(alpha, 0x93, 0xC5, 0xFD)
                    : Color.FromArgb(alpha, 0xFF, 0xFF, 0xFF);

            var star = new Ellipse
            {
                Width = size,
                Height = size,
                Fill = new SolidColorBrush(color)
            };
            Canvas.SetLeft(star, rng.NextDouble() * w);
            Canvas.SetTop(star, rng.NextDouble() * h);
            SpaceBackdropCanvas.Children.Add(star);
        }

        _starsBuilt = true;
    }

    private void QuickThemeComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_suppressThemeCombo || !IsLoaded)
        {
            return;
        }

        if (QuickThemeComboBox.SelectedItem is ComboBoxItem item &&
            item.Tag is string tag &&
            Enum.TryParse<AppThemeMode>(tag, out var mode))
        {
            ThemeService.ApplyTheme(mode, CalendarViewControl.DisplayedMonth, persist: true);
        }
    }

    private void OnDataChanged()
    {
        CalendarViewControl.RefreshCalendar();
        GoalSummaryControl.RefreshSummary();
        GoalsViewControl.RefreshGoals();
        DashboardStopwatchControl.RefreshGoals();
        DashboardAnalyticsControl.RefreshAnalytics();
        FullAnalyticsViewControl.RefreshAnalytics();
        StopwatchViewControl.RefreshAll();
        UpdateClockAndStatus();
    }

    private void OpenTodayInDailyTimeline()
    {
        NavCalendar.IsChecked = true;
        CalendarViewControl.OpenDateInDailyView(DateTime.Today);
    }

    private void ClockTimer_Tick(object? sender, EventArgs e)
    {
        UpdateClockAndStatus();

        if (DateTime.Today != _lastKnownDate)
        {
            _lastKnownDate = DateTime.Today;
            OnDataChanged();
        }
        else
        {
            CalendarViewControl.UpdateCurrentTimeIndicator();
        }
    }

    private void UpdateClockAndStatus()
    {
        var now = DateTime.Now;
        LiveDateTimeText.Text = now.ToString("d MMMM yyyy • HH:mm:ss", _trCulture);
        DbStatusText.Text = $"SQLite: planner.db ({App.Database.GetDatabaseFileSizeFormatted()})";
    }

    private void NavButton_Checked(object sender, RoutedEventArgs e)
    {
        if (CalendarDashboardContainer == null
            || GoalsViewControl == null
            || StopwatchViewControl == null
            || FullAnalyticsViewControl == null
            || SettingsViewControl == null)
        {
            return;
        }

        if (sender is not RadioButton rb || rb.Tag is not string tag)
        {
            return;
        }

        CalendarDashboardContainer.Visibility = Visibility.Collapsed;
        GoalsViewControl.Visibility = Visibility.Collapsed;
        StopwatchViewControl.Visibility = Visibility.Collapsed;
        FullAnalyticsViewControl.Visibility = Visibility.Collapsed;
        SettingsViewControl.Visibility = Visibility.Collapsed;

        switch (tag)
        {
            case "Calendar":
                CalendarDashboardContainer.Visibility = Visibility.Visible;
                CalendarViewControl.RefreshCalendar();
                GoalSummaryControl.RefreshSummary();
                DashboardStopwatchControl.RefreshGoals();
                DashboardAnalyticsControl.RefreshAnalytics();
                break;

            case "Goals":
                GoalsViewControl.Visibility = Visibility.Visible;
                GoalsViewControl.RefreshGoals();
                break;

            case "Stopwatch":
                StopwatchViewControl.Visibility = Visibility.Visible;
                StopwatchViewControl.RefreshAll();
                break;

            case "Analytics":
                FullAnalyticsViewControl.Visibility = Visibility.Visible;
                FullAnalyticsViewControl.RefreshAnalytics();
                break;

            case "Settings":
                SettingsViewControl.Visibility = Visibility.Visible;
                SettingsViewControl.LoadTargets();
                SettingsViewControl.SyncSelectedThemeCard();
                break;
        }
    }

    private void MainWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (App.Stopwatch != null && App.Stopwatch.State != StopwatchState.Idle)
        {
            var result = MessageBox.Show(
                "Aktif veya duraklatılmış bir kronometre oturumu var.\nKaydetmeden uygulamayı kapatmak istediğinize emin misiniz?",
                "Aktif Kronometre",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result != MessageBoxResult.Yes)
            {
                e.Cancel = true;
            }
        }
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void MainWindow_StateChanged(object? sender, EventArgs e)
    {
        RootBorder.Padding = WindowState == WindowState.Maximized
            ? new Thickness(7)
            : new Thickness(0);
    }
}
