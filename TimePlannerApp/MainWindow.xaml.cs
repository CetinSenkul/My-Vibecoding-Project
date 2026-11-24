using System.ComponentModel;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using TimePlannerApp.Services;

namespace TimePlannerApp;

public partial class MainWindow : Window
{
    private readonly DispatcherTimer _clockTimer;
    private readonly CultureInfo _trCulture = new("tr-TR");
    private DateTime _lastKnownDate = DateTime.Today;

    public MainWindow()
    {
        InitializeComponent();

        StateChanged += MainWindow_StateChanged;
        Closing += MainWindow_Closing;

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

        _clockTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(1)
        };
        _clockTimer.Tick += ClockTimer_Tick;
        _clockTimer.Start();
        Closed += (_, _) => _clockTimer.Stop();

        UpdateClockAndStatus();
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

        // Gece yarısı gün değiştiyse tüm görünümleri otomatik yenile
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
