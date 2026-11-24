using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using TimePlannerApp.Models;

namespace TimePlannerApp.Views;

public partial class StopwatchView : UserControl
{
    public event Action? SessionsChanged;
    public event Action? OpenDailyTimelineRequested;
    public event Action? NavigateToGoalsRequested;

    public StopwatchView()
    {
        InitializeComponent();
        FullStopwatchControl.NavigateToGoalsRequested += () => NavigateToGoalsRequested?.Invoke();
        Loaded += (_, _) => RefreshAll();
    }

    public void RefreshAll()
    {
        if (!IsLoaded)
        {
            return;
        }

        FullStopwatchControl.RefreshGoals();
        RefreshTodaySessions();
    }

    public void RefreshTodaySessions()
    {
        if (!IsLoaded)
        {
            return;
        }

        var sessions = App.Database.GetSessionDetailsForDate(DateTime.Today);
        var totalSeconds = sessions.Sum(s => s.DurationSeconds);

        TodaySummaryText.Text = $"Toplam {sessions.Count} oturum • {FormatDuration(totalSeconds)}";
        TodaySessionsStack.Children.Clear();

        if (sessions.Count == 0)
        {
            TodaySessionsStack.Children.Add(new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(0x0E, 0x14, 0x20)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(0x1E, 0x2A, 0x3D)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(20, 32, 20, 32),
                Child = new TextBlock
                {
                    Text = "Bugün henüz kaydedilmiş bir çalışma oturumu yok.\nSoldaki kronometreyi başlatıp kaydettiğinizde burada listelenir.",
                    FontSize = 12.5,
                    Foreground = new SolidColorBrush(Color.FromRgb(0x64, 0x74, 0x8B)),
                    TextAlignment = TextAlignment.Center,
                    TextWrapping = TextWrapping.Wrap
                }
            });
            return;
        }

        // En yeni oturumu üstte göster
        foreach (var session in sessions.AsEnumerable().Reverse())
        {
            TodaySessionsStack.Children.Add(CreateSessionRow(session));
        }
    }

    private Border CreateSessionRow(WorkSessionDetail session)
    {
        var isTask = session.GoalType == "Task";
        var card = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(0x14, 0x1D, 0x2D)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(0x23, 0x32, 0x4B)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(14, 11, 14, 11),
            Margin = new Thickness(0, 0, 0, 8)
        };

        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var left = new StackPanel { VerticalAlignment = VerticalAlignment.Center };

        var titleRow = new StackPanel { Orientation = Orientation.Horizontal };
        titleRow.Children.Add(new TextBlock
        {
            Text = session.GoalTitle,
            FontSize = 13.5,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(0xF1, 0xF5, 0xF9))
        });

        var typePill = new Border
        {
            Background = isTask
                ? new SolidColorBrush(Color.FromRgb(0x18, 0x3A, 0x28))
                : new SolidColorBrush(Color.FromRgb(0x16, 0x2B, 0x4A)),
            BorderBrush = isTask
                ? new SolidColorBrush(Color.FromRgb(0x2E, 0x7D, 0x4B))
                : new SolidColorBrush(Color.FromRgb(0x2B, 0x56, 0x94)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(6, 1, 6, 1),
            Margin = new Thickness(8, 0, 0, 0),
            VerticalAlignment = VerticalAlignment.Center,
            Child = new TextBlock
            {
                Text = isTask ? "Görev" : "Süreç",
                FontSize = 10,
                FontWeight = FontWeights.SemiBold,
                Foreground = isTask
                    ? new SolidColorBrush(Color.FromRgb(0x86, 0xEF, 0xAC))
                    : new SolidColorBrush(Color.FromRgb(0x93, 0xC5, 0xFD))
            }
        };
        titleRow.Children.Add(typePill);
        left.Children.Add(titleRow);

        var startShort = session.StartTime.Length >= 5 ? session.StartTime[..5] : session.StartTime;
        var endShort = session.EndTime.Length >= 5 ? session.EndTime[..5] : session.EndTime;
        left.Children.Add(new TextBlock
        {
            Text = $"{startShort} – {endShort}",
            FontSize = 11.5,
            Foreground = new SolidColorBrush(Color.FromRgb(0x94, 0xA3, 0xB8)),
            Margin = new Thickness(0, 3, 0, 0)
        });

        Grid.SetColumn(left, 0);
        grid.Children.Add(left);

        var right = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(10, 0, 0, 0)
        };

        var durPill = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(0x18, 0x22, 0x34)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(0x2B, 0x3C, 0x56)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10, 4, 10, 4),
            Margin = new Thickness(0, 0, 8, 0),
            Child = new TextBlock
            {
                Text = FormatDuration(session.DurationSeconds),
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(0xE2, 0xE8, 0xF0))
            }
        };
        right.Children.Add(durPill);

        var delBtn = new Button
        {
            Content = "Sil",
            Style = (Style)FindResource("DangerButtonStyle"),
            Padding = new Thickness(9, 4, 9, 4),
            FontSize = 11.5
        };
        delBtn.Click += (_, _) =>
        {
            var confirm = MessageBox.Show(
                $"\"{session.GoalTitle}\" ({startShort} – {endShort}) oturumunu silmek istiyor musunuz?",
                "Oturum Sil",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (confirm == MessageBoxResult.Yes)
            {
                App.Database.DeleteWorkSession(session.Id);
                RefreshTodaySessions();
                SessionsChanged?.Invoke();
            }
        };
        right.Children.Add(delBtn);

        Grid.SetColumn(right, 1);
        grid.Children.Add(right);

        card.Child = grid;
        return card;
    }

    private void OpenDailyTimelineButton_Click(object sender, RoutedEventArgs e)
    {
        OpenDailyTimelineRequested?.Invoke();
    }

    private static string FormatDuration(int totalSeconds)
    {
        var h = totalSeconds / 3600;
        var m = (totalSeconds % 3600) / 60;
        var s = totalSeconds % 60;

        if (h > 0)
        {
            return m > 0 ? $"{h}s {m}dk" : $"{h}s";
        }

        if (m > 0)
        {
            return s > 0 ? $"{m}dk {s}sn" : $"{m}dk";
        }

        return $"{s}sn";
    }
}
