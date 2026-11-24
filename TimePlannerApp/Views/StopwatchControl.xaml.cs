using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using TimePlannerApp.Models;
using TimePlannerApp.Services;

namespace TimePlannerApp.Views;

public partial class StopwatchControl : UserControl
{
    private sealed class GoalChoiceItem
    {
        public Goal Goal { get; init; } = null!;
        public string DisplayText => $"{Goal.Title} ({(Goal.Type == "Task" ? "Görev" : "Süreç")})";
    }

    private const double RingCenter = 84.0;
    private const double RingRadius = 78.0;

    private List<GoalChoiceItem> _goalItems = [];
    private bool _isSubscribed;
    private bool _secondaryActionIsAddGoal;

    public event Action? NavigateToGoalsRequested;

    public StopwatchControl()
    {
        InitializeComponent();
        Loaded += StopwatchControl_Loaded;
        Unloaded += StopwatchControl_Unloaded;
    }

    private void StopwatchControl_Loaded(object sender, RoutedEventArgs e)
    {
        if (!_isSubscribed && App.Stopwatch != null)
        {
            App.Stopwatch.Tick += Stopwatch_Tick;
            App.Stopwatch.StateChanged += Stopwatch_StateChanged;
            _isSubscribed = true;
        }

        RefreshGoals();
        SyncUiFromService();
    }

    private void StopwatchControl_Unloaded(object sender, RoutedEventArgs e)
    {
        if (_isSubscribed && App.Stopwatch != null)
        {
            App.Stopwatch.Tick -= Stopwatch_Tick;
            App.Stopwatch.StateChanged -= Stopwatch_StateChanged;
            _isSubscribed = false;
        }
    }

    public void RefreshGoals()
    {
        if (!IsLoaded)
        {
            return;
        }

        var previouslySelectedId = (GoalComboBox.SelectedItem as GoalChoiceItem)?.Goal.Id
            ?? App.Stopwatch?.ActiveGoal?.Id;

        var goals = App.Database.GetActiveGoals();
        _goalItems = goals.Select(g => new GoalChoiceItem { Goal = g }).ToList();
        GoalComboBox.ItemsSource = _goalItems;

        if (_goalItems.Count == 0)
        {
            GoalComboBox.SelectedIndex = -1;
            GoalComboBox.IsEnabled = false;
            if (App.Stopwatch?.State == StopwatchState.Idle)
            {
                ShowFeedback("Önce bir hedef oluşturun.", isError: false, isSuccess: false);
                _secondaryActionIsAddGoal = true;
                SecondaryActionButton.Content = "Hedef Ekle";
                SecondaryActionButton.Visibility = Visibility.Visible;
            }
            return;
        }

        var match = previouslySelectedId.HasValue
            ? _goalItems.FirstOrDefault(x => x.Goal.Id == previouslySelectedId.Value)
            : null;
        GoalComboBox.SelectedItem = match ?? _goalItems[0];

        if (_secondaryActionIsAddGoal)
        {
            _secondaryActionIsAddGoal = false;
            SecondaryActionButton.Visibility = Visibility.Collapsed;
        }

        SyncUiFromService();
    }

    private void Stopwatch_Tick()
    {
        UpdateTimeAndArc();
    }

    private void Stopwatch_StateChanged()
    {
        SyncUiFromService();
    }

    private void SyncUiFromService()
    {
        if (!IsLoaded || App.Stopwatch == null)
        {
            return;
        }

        var state = App.Stopwatch.State;
        var hasGoals = _goalItems.Count > 0;

        // Aktif bir oturum varsa hedefi kilitle ve seçili göster
        if (App.Stopwatch.ActiveGoal != null)
        {
            var match = _goalItems.FirstOrDefault(x => x.Goal.Id == App.Stopwatch.ActiveGoal.Id);
            if (match != null)
            {
                GoalComboBox.SelectedItem = match;
            }
        }

        GoalComboBox.IsEnabled = state == StopwatchState.Idle && hasGoals;

        StartButton.IsEnabled = state != StopwatchState.Running && hasGoals;
        StartButton.Content = state == StopwatchState.Paused ? "Devam Et" : "Başlat";

        PauseButton.IsEnabled = state == StopwatchState.Running;
        SaveButton.IsEnabled = state != StopwatchState.Idle;

        if (state == StopwatchState.Idle)
        {
            StatusSubtitleText.Text = "Hazır";
            StatusSubtitleText.Foreground = new SolidColorBrush(Color.FromRgb(0x64, 0x74, 0x8B));
            SaveButton.Background = new SolidColorBrush(Color.FromRgb(0x18, 0x22, 0x34));
            SaveButton.BorderBrush = new SolidColorBrush(Color.FromRgb(0x27, 0x35, 0x4C));
            ArcGlowEffect.Opacity = 0.0;

            if (!hasGoals)
            {
                _secondaryActionIsAddGoal = true;
                SecondaryActionButton.Content = "Hedef Ekle";
                SecondaryActionButton.Visibility = Visibility.Visible;
            }
            else
            {
                _secondaryActionIsAddGoal = false;
                SecondaryActionButton.Visibility = Visibility.Collapsed;
            }
        }
        else if (state == StopwatchState.Running)
        {
            var startStr = App.Stopwatch.SessionStartLocal?.ToString("HH:mm") ?? "--:--";
            StatusSubtitleText.Text = $"{startStr} - Devam";
            StatusSubtitleText.Foreground = new SolidColorBrush(Color.FromRgb(0x93, 0xC5, 0xFD));
            SaveButton.Background = new SolidColorBrush(Color.FromRgb(0x13, 0x38, 0x24));
            SaveButton.BorderBrush = new SolidColorBrush(Color.FromRgb(0x43, 0xA0, 0x47));
            ArcGlowEffect.Opacity = 0.55;

            _secondaryActionIsAddGoal = false;
            SecondaryActionButton.Visibility = Visibility.Collapsed;
            ShowFeedback($"Aktif: {App.Stopwatch.ActiveGoal?.Title}", isError: false, isSuccess: false);
        }
        else // Paused
        {
            var startStr = App.Stopwatch.SessionStartLocal?.ToString("HH:mm") ?? "--:--";
            StatusSubtitleText.Text = $"{startStr} - Duraklatıldı";
            StatusSubtitleText.Foreground = new SolidColorBrush(Color.FromRgb(0xFD, 0xE0, 0x47));
            SaveButton.Background = new SolidColorBrush(Color.FromRgb(0x13, 0x38, 0x24));
            SaveButton.BorderBrush = new SolidColorBrush(Color.FromRgb(0x43, 0xA0, 0x47));
            ArcGlowEffect.Opacity = 0.25;

            _secondaryActionIsAddGoal = false;
            SecondaryActionButton.Content = "Sıfırla";
            SecondaryActionButton.Visibility = Visibility.Visible;
        }

        UpdateTimeAndArc();
    }

    private void UpdateTimeAndArc()
    {
        if (App.Stopwatch == null)
        {
            return;
        }

        var elapsed = App.Stopwatch.Elapsed;
        var totalHours = (int)elapsed.TotalHours;
        ElapsedTimeText.Text = $"{totalHours:00}:{elapsed.Minutes:00}:{elapsed.Seconds:00}";

        if (App.Stopwatch.State == StopwatchState.Idle)
        {
            ProgressArcPath.Data = null;
            return;
        }

        // 60 saniyelik akıcı döngü ile canlı ilerleme halkası
        var fraction = (elapsed.TotalSeconds % 60.0) / 60.0;
        if (fraction < 0.025)
        {
            fraction = 0.025;
        }

        DrawArc(fraction);
    }

    private void DrawArc(double fraction)
    {
        var clamped = Math.Clamp(fraction, 0.001, 0.9999);
        var angleDeg = clamped * 360.0;
        var angleRad = (angleDeg - 90.0) * Math.PI / 180.0;

        var startPoint = new Point(RingCenter, RingCenter - RingRadius);
        var endX = RingCenter + RingRadius * Math.Cos(angleRad);
        var endY = RingCenter + RingRadius * Math.Sin(angleRad);
        var endPoint = new Point(endX, endY);

        var isLargeArc = angleDeg > 180.0;

        var figure = new PathFigure
        {
            StartPoint = startPoint,
            IsClosed = false
        };
        figure.Segments.Add(new ArcSegment
        {
            Point = endPoint,
            Size = new Size(RingRadius, RingRadius),
            IsLargeArc = isLargeArc,
            SweepDirection = SweepDirection.Clockwise
        });

        var geometry = new PathGeometry();
        geometry.Figures.Add(figure);
        ProgressArcPath.Data = geometry;
    }

    private void StartButton_Click(object sender, RoutedEventArgs e)
    {
        if (App.Stopwatch.State == StopwatchState.Idle)
        {
            if (GoalComboBox.SelectedItem is not GoalChoiceItem selected)
            {
                ShowFeedback("Başlatmak için önce bir hedef seçin.", isError: true, isSuccess: false);
                return;
            }

            App.Stopwatch.StartOrResume(selected.Goal);
        }
        else
        {
            App.Stopwatch.StartOrResume(null);
        }
    }

    private void PauseButton_Click(object sender, RoutedEventArgs e)
    {
        App.Stopwatch.Pause();
    }

    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        var saved = App.Stopwatch.StopAndSave(out var durationSeconds);
        if (!saved)
        {
            ShowFeedback("Kaydetmek için en az 1 saniye geçmelidir.", isError: true, isSuccess: false);
            return;
        }

        ShowFeedback($"Oturum kaydedildi ({FormatDurationVerbose(durationSeconds)}).", isError: false, isSuccess: true);
    }

    private void SecondaryActionButton_Click(object sender, RoutedEventArgs e)
    {
        if (_secondaryActionIsAddGoal)
        {
            NavigateToGoalsRequested?.Invoke();
            return;
        }

        var confirm = MessageBox.Show(
            "Mevcut kronometre süresi kaydedilmeden sıfırlansın mı?",
            "Kronometreyi Sıfırla",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (confirm == MessageBoxResult.Yes)
        {
            App.Stopwatch.Reset();
            ShowFeedback("Kronometre sıfırlandı.", isError: false, isSuccess: false);
        }
    }

    private void GoalComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (App.Stopwatch?.State == StopwatchState.Idle && GoalComboBox.SelectedItem is GoalChoiceItem item)
        {
            ShowFeedback($"Seçili hedef: {item.Goal.Title}", isError: false, isSuccess: false);
        }
    }

    private void ShowFeedback(string text, bool isError, bool isSuccess)
    {
        FeedbackText.Text = text;
        FeedbackText.Foreground = isError
            ? new SolidColorBrush(Color.FromRgb(0xF8, 0x71, 0x71))
            : isSuccess
                ? new SolidColorBrush(Color.FromRgb(0x6E, 0xE7, 0xB7))
                : new SolidColorBrush(Color.FromRgb(0x94, 0xA3, 0xB8));
    }

    private static string FormatDurationVerbose(int totalSeconds)
    {
        var h = totalSeconds / 3600;
        var m = (totalSeconds % 3600) / 60;
        var s = totalSeconds % 60;

        if (h > 0)
        {
            return $"{h}s {m}dk {s}sn";
        }

        if (m > 0)
        {
            return $"{m}dk {s}sn";
        }

        return $"{s}sn";
    }
}
