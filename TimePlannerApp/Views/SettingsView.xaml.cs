using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace TimePlannerApp.Views;

public partial class SettingsView : UserControl
{
    private sealed class DayEditorRow
    {
        public int DayOfWeek { get; init; }
        public string DayName { get; init; } = string.Empty;
        public TextBox HoursBox { get; init; } = null!;
        public TextBox MinutesBox { get; init; } = null!;
        public TextBlock SummaryText { get; init; } = null!;
    }

    // Arayüzde Pazartesi (1) -> Pazar (0) sıralaması
    private static readonly (int DayOfWeek, string Name)[] OrderedDays =
    [
        (1, "Pazartesi"),
        (2, "Salı"),
        (3, "Çarşamba"),
        (4, "Perşembe"),
        (5, "Cuma"),
        (6, "Cumartesi"),
        (0, "Pazar")
    ];

    private readonly List<DayEditorRow> _rows = [];
    private bool _isLoading;

    public event Action? TargetsChanged;

    public SettingsView()
    {
        InitializeComponent();
        Loaded += (_, _) => LoadTargets();
    }

    public void LoadTargets()
    {
        if (!IsLoaded)
        {
            return;
        }

        _isLoading = true;
        var targets = App.Database.GetDailyTargets();
        var todayDow = (int)DateTime.Today.DayOfWeek;

        DaysListPanel.Children.Clear();
        _rows.Clear();

        foreach (var (dow, name) in OrderedDays)
        {
            var minutesTotal = targets.TryGetValue(dow, out var m) ? m : 120;
            var isToday = dow == todayDow;

            var rowCard = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(0x14, 0x1D, 0x2D)),
                BorderBrush = isToday
                    ? new SolidColorBrush(Color.FromRgb(0x3B, 0x6C, 0xB7))
                    : new SolidColorBrush(Color.FromRgb(0x21, 0x2E, 0x45)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(16, 11, 16, 11),
                Margin = new Thickness(0, 0, 0, 9)
            };

            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(170) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            // Day Name + Today badge
            var dayStack = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            dayStack.Children.Add(new TextBlock
            {
                Text = name,
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(0xF1, 0xF5, 0xF9)),
                VerticalAlignment = VerticalAlignment.Center
            });

            if (isToday)
            {
                var badge = new Border
                {
                    Background = new SolidColorBrush(Color.FromRgb(0x1E, 0x3A, 0x5F)),
                    BorderBrush = new SolidColorBrush(Color.FromRgb(0x5B, 0x9B, 0xF8)),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(4),
                    Padding = new Thickness(6, 1, 6, 1),
                    Margin = new Thickness(8, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center
                };
                badge.Child = new TextBlock
                {
                    Text = "Bugün",
                    FontSize = 10,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = new SolidColorBrush(Color.FromRgb(0xBF, 0xDB, 0xFE))
                };
                dayStack.Children.Add(badge);
            }
            Grid.SetColumn(dayStack, 0);
            grid.Children.Add(dayStack);

            // Stepper + Hours/Minutes Inputs
            var controlsStack = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                VerticalAlignment = VerticalAlignment.Center
            };

            var minusBtn = new Button
            {
                Content = "-30dk",
                Style = (Style)FindResource("SubtleButtonStyle"),
                Padding = new Thickness(8, 4, 8, 4),
                FontSize = 11.5,
                Margin = new Thickness(0, 0, 10, 0)
            };

            var hoursBox = new TextBox
            {
                Style = (Style)FindResource("DarkTextBoxStyle"),
                Width = 54,
                Height = 32,
                MaxLength = 2,
                Text = (minutesTotal / 60).ToString(),
                HorizontalContentAlignment = HorizontalAlignment.Center
            };
            hoursBox.PreviewTextInput += NumericOnly_PreviewTextInput;
            hoursBox.PreviewKeyDown += NumericBox_PreviewKeyDown;
            DataObject.AddPastingHandler(hoursBox, NumericOnly_Pasting);

            var minutesBox = new TextBox
            {
                Style = (Style)FindResource("DarkTextBoxStyle"),
                Width = 54,
                Height = 32,
                MaxLength = 2,
                Text = (minutesTotal % 60).ToString(),
                HorizontalContentAlignment = HorizontalAlignment.Center
            };
            minutesBox.PreviewTextInput += NumericOnly_PreviewTextInput;
            minutesBox.PreviewKeyDown += NumericBox_PreviewKeyDown;
            DataObject.AddPastingHandler(minutesBox, NumericOnly_Pasting);

            var plusBtn = new Button
            {
                Content = "+30dk",
                Style = (Style)FindResource("SubtleButtonStyle"),
                Padding = new Thickness(8, 4, 8, 4),
                FontSize = 11.5,
                Margin = new Thickness(10, 0, 0, 0)
            };

            controlsStack.Children.Add(minusBtn);
            controlsStack.Children.Add(hoursBox);
            controlsStack.Children.Add(new TextBlock { Text = "sa", FontSize = 12, Foreground = new SolidColorBrush(Color.FromRgb(0x94, 0xA3, 0xB8)), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(6, 0, 10, 0) });
            controlsStack.Children.Add(minutesBox);
            controlsStack.Children.Add(new TextBlock { Text = "dk", FontSize = 12, Foreground = new SolidColorBrush(Color.FromRgb(0x94, 0xA3, 0xB8)), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(6, 0, 0, 0) });
            controlsStack.Children.Add(plusBtn);

            Grid.SetColumn(controlsStack, 1);
            grid.Children.Add(controlsStack);

            // Right formatted summary
            var summaryText = new TextBlock
            {
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(0x93, 0xC5, 0xFD)),
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(summaryText, 2);
            grid.Children.Add(summaryText);

            var editorRow = new DayEditorRow
            {
                DayOfWeek = dow,
                DayName = name,
                HoursBox = hoursBox,
                MinutesBox = minutesBox,
                SummaryText = summaryText
            };
            _rows.Add(editorRow);

            minusBtn.Click += (_, _) => AdjustRowMinutes(editorRow, -30);
            plusBtn.Click += (_, _) => AdjustRowMinutes(editorRow, 30);
            hoursBox.TextChanged += (_, _) => UpdateSummaries();
            minutesBox.TextChanged += (_, _) => UpdateSummaries();

            rowCard.Child = grid;
            DaysListPanel.Children.Add(rowCard);
        }

        _isLoading = false;
        UpdateSummaries();
        SettingsFeedbackText.Visibility = Visibility.Collapsed;
    }

    private void AdjustRowMinutes(DayEditorRow row, int deltaMinutes)
    {
        var current = ReadRowMinutes(row);
        var updated = Math.Clamp(current + deltaMinutes, 0, 1440);
        row.HoursBox.Text = (updated / 60).ToString();
        row.MinutesBox.Text = (updated % 60).ToString();
    }

    private static int ReadRowMinutes(DayEditorRow row)
    {
        var h = int.TryParse(row.HoursBox.Text.Trim(), out var parsedH) ? parsedH : 0;
        var m = int.TryParse(row.MinutesBox.Text.Trim(), out var parsedM) ? parsedM : 0;
        return Math.Clamp(h * 60 + m, 0, 1440);
    }

    private void UpdateSummaries()
    {
        if (_isLoading)
        {
            return;
        }

        var weeklyTotal = 0;
        foreach (var row in _rows)
        {
            var mins = ReadRowMinutes(row);
            weeklyTotal += mins;
            row.SummaryText.Text = FormatMinutes(mins);
        }

        WeeklyTotalText.Text = $"Haftalık Toplam Hedef: {FormatMinutes(weeklyTotal)}";
    }

    private void SaveTargetsButton_Click(object sender, RoutedEventArgs e)
    {
        var dict = new Dictionary<int, int>();
        foreach (var row in _rows)
        {
            var mins = ReadRowMinutes(row);
            // normalize display if user typed e.g. 90 mins
            row.HoursBox.Text = (mins / 60).ToString();
            row.MinutesBox.Text = (mins % 60).ToString();
            dict[row.DayOfWeek] = mins;
        }

        App.Database.SaveDailyTargets(dict);

        SettingsFeedbackText.Text = "Günlük saat hedefleri SQLite veritabanına kaydedildi.";
        SettingsFeedbackText.Foreground = new SolidColorBrush(Color.FromRgb(0x6E, 0xE7, 0xB7));
        SettingsFeedbackText.Visibility = Visibility.Visible;

        TargetsChanged?.Invoke();
    }

    private void ResetDefaultsButton_Click(object sender, RoutedEventArgs e)
    {
        foreach (var row in _rows)
        {
            row.HoursBox.Text = "2";
            row.MinutesBox.Text = "0";
        }

        SettingsFeedbackText.Text = "Tüm günler 2 saat olarak ayarlandı. Kalıcı olması için 'Ayarları Kaydet' butonuna basın.";
        SettingsFeedbackText.Foreground = new SolidColorBrush(Color.FromRgb(0xFD, 0xE0, 0x47));
        SettingsFeedbackText.Visibility = Visibility.Visible;
    }

    private void NumericOnly_PreviewTextInput(object sender, TextCompositionEventArgs e)
    {
        e.Handled = !e.Text.All(char.IsDigit);
    }

    private static void NumericBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Space)
        {
            e.Handled = true;
        }
    }

    private static void NumericOnly_Pasting(object sender, DataObjectPastingEventArgs e)
    {
        if (!e.DataObject.GetDataPresent(typeof(string)) ||
            e.DataObject.GetData(typeof(string)) is not string text ||
            !text.All(char.IsDigit))
        {
            e.CancelCommand();
        }
    }

    private static string FormatMinutes(int totalMinutes)
    {
        var h = totalMinutes / 60;
        var m = totalMinutes % 60;
        if (h == 0)
        {
            return $"{m}dk";
        }

        return m == 0 ? $"{h}s 0dk" : $"{h}s {m}dk";
    }
}
