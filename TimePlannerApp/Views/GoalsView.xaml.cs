using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using TimePlannerApp.Models;
using TimePlannerApp.Services;

namespace TimePlannerApp.Views;

public partial class GoalsView : UserControl
{
    private int? _editingGoalId;

    public event Action? GoalsChanged;

    public GoalsView()
    {
        InitializeComponent();
        DataObject.AddPastingHandler(WeeklyHoursTextBox, NumericOnly_Pasting);
        DataObject.AddPastingHandler(WeeklyMinutesTextBox, NumericOnly_Pasting);
        Loaded += (_, _) => RefreshGoals();
    }

    public void RefreshGoals()
    {
        if (!IsLoaded)
        {
            return;
        }

        var summaries = App.Database.GetActiveGoalSummaries(DateTime.Today);
        var processGoals = summaries.Where(s => s.Goal.Type == "Process").ToList();
        var taskGoals = summaries.Where(s => s.Goal.Type == "Task").ToList();

        ProcessCountText.Text = $"Sınır Yok • {processGoals.Count} hedef";
        TaskCountText.Text = $"Haftalık Min. Süre • {taskGoals.Count} hedef";

        ProcessGoalsStack.Children.Clear();
        if (processGoals.Count == 0)
        {
            ProcessGoalsStack.Children.Add(CreateEmptyState("Henüz süreç hedefi eklenmedi.\nÖrn: Ders Çalışma, Kitap Okuma"));
        }
        else
        {
            foreach (var item in processGoals)
            {
                ProcessGoalsStack.Children.Add(CreateProcessGoalCard(item));
            }
        }

        TaskGoalsStack.Children.Clear();
        if (taskGoals.Count == 0)
        {
            TaskGoalsStack.Children.Add(CreateEmptyState("Henüz görev hedefi eklenmedi.\nÖrn: Matematik Çalışma (Haftalık 5 sa)"));
        }
        else
        {
            foreach (var item in taskGoals)
            {
                TaskGoalsStack.Children.Add(CreateTaskGoalCard(item));
            }
        }
    }

    private Border CreateProcessGoalCard(GoalSummary summary)
    {
        var card = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(0x14, 0x1D, 0x2D)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(0x23, 0x32, 0x4B)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(14, 12, 14, 12),
            Margin = new Thickness(0, 0, 0, 10)
        };

        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        // Left: Title & Session Count
        var infoStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        infoStack.Children.Add(new TextBlock
        {
            Text = summary.Goal.Title,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(0xF1, 0xF5, 0xF9)),
            TextTrimming = TextTrimming.CharacterEllipsis
        });
        infoStack.Children.Add(new TextBlock
        {
            Text = $"Toplam {summary.TotalSessionCount} oturum",
            FontSize = 11.5,
            Foreground = new SolidColorBrush(Color.FromRgb(0x64, 0x74, 0x8B)),
            Margin = new Thickness(0, 3, 0, 0)
        });
        Grid.SetColumn(infoStack, 0);
        grid.Children.Add(infoStack);

        // Right: Duration pill + Edit/Delete
        var rightStack = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(10, 0, 0, 0)
        };

        var durationPill = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(0x16, 0x2B, 0x4A)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(0x2B, 0x56, 0x94)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(7),
            Padding = new Thickness(10, 5, 10, 5),
            Margin = new Thickness(0, 0, 10, 0)
        };
        durationPill.Child = new TextBlock
        {
            Text = FormatDurationShort(summary.TotalDurationSeconds),
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(0x93, 0xC5, 0xFD))
        };
        rightStack.Children.Add(durationPill);

        var editBtn = new Button
        {
            Content = "Düzenle",
            Style = (Style)FindResource("SubtleButtonStyle"),
            Padding = new Thickness(9, 4, 9, 4),
            FontSize = 11.5,
            Margin = new Thickness(0, 0, 6, 0)
        };
        editBtn.Click += (_, _) => StartEditGoal(summary.Goal);
        rightStack.Children.Add(editBtn);

        var deleteBtn = new Button
        {
            Content = "Sil",
            Style = (Style)FindResource("DangerButtonStyle"),
            Padding = new Thickness(9, 4, 9, 4),
            FontSize = 11.5
        };
        deleteBtn.Click += (_, _) => ConfirmAndDeleteGoal(summary.Goal);
        rightStack.Children.Add(deleteBtn);

        Grid.SetColumn(rightStack, 1);
        grid.Children.Add(rightStack);

        card.Child = grid;
        return card;
    }

    private Border CreateTaskGoalCard(GoalSummary summary)
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
        var ambientGlow = colorInfo.CreateGlowEffect(0.75);

        var card = new Border
        {
            Background = colorInfo.CreateSurfaceBrush(),
            BorderBrush = defaultBorderBrush,
            BorderThickness = new Thickness(1.2),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(14, 12, 14, 12),
            Margin = new Thickness(4, 2, 4, 10),
            Effect = ambientGlow,
            ToolTip = $"{summary.Goal.Title}\nBu Hafta: {actualHours:0.1}s / {targetHours:0.1}s (%{pctDisplay})\nDurum: {colorInfo.TierLabel}"
        };

        var rootStack = new StackPanel();

        // Top row: Title & Ratio + Actions
        var topGrid = new Grid { Margin = new Thickness(0, 0, 0, 10) };
        topGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        topGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

        var titleStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        titleStack.Children.Add(new TextBlock
        {
            Text = summary.Goal.Title,
            FontSize = 14,
            FontWeight = FontWeights.SemiBold,
            Foreground = new SolidColorBrush(Color.FromRgb(0xF8, 0xFA, 0xFC)),
            TextTrimming = TextTrimming.CharacterEllipsis
        });
        titleStack.Children.Add(new TextBlock
        {
            Text = $"{actualHours:0.1} / {targetHours:0.1}s • %{pctDisplay}",
            FontSize = 12,
            FontWeight = FontWeights.SemiBold,
            Foreground = hasWork
                ? colorInfo.CreateAccentTextBrush()
                : new SolidColorBrush(Color.FromRgb(0x94, 0xA3, 0xB8)),
            Margin = new Thickness(0, 2, 0, 0)
        });
        Grid.SetColumn(titleStack, 0);
        topGrid.Children.Add(titleStack);

        var actionsStack = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(10, 0, 0, 0)
        };

        var editBtn = new Button
        {
            Content = "Düzenle",
            Style = (Style)FindResource("SubtleButtonStyle"),
            Padding = new Thickness(9, 4, 9, 4),
            FontSize = 11.5,
            Margin = new Thickness(0, 0, 6, 0)
        };
        editBtn.Click += (_, _) => StartEditGoal(summary.Goal);
        actionsStack.Children.Add(editBtn);

        var deleteBtn = new Button
        {
            Content = "Sil",
            Style = (Style)FindResource("DangerButtonStyle"),
            Padding = new Thickness(9, 4, 9, 4),
            FontSize = 11.5
        };
        deleteBtn.Click += (_, _) => ConfirmAndDeleteGoal(summary.Goal);
        actionsStack.Children.Add(deleteBtn);

        Grid.SetColumn(actionsStack, 1);
        topGrid.Children.Add(actionsStack);
        rootStack.Children.Add(topGrid);

        // Progress Bar Track
        var track = new Border
        {
            Height = 7,
            CornerRadius = new CornerRadius(4),
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
                CornerRadius = new CornerRadius(4)
            };
            Grid.SetColumn(fillBar, 0);
            fillGrid.Children.Add(fillBar);

            track.Child = fillGrid;
        }
        rootStack.Children.Add(track);

        card.Child = rootStack;

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

    private static Border CreateEmptyState(string message)
    {
        return new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(0x0E, 0x14, 0x20)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(0x1E, 0x2A, 0x3D)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(10),
            Padding = new Thickness(20, 28, 20, 28),
            Child = new TextBlock
            {
                Text = message,
                FontSize = 12.5,
                Foreground = new SolidColorBrush(Color.FromRgb(0x64, 0x74, 0x8B)),
                TextAlignment = TextAlignment.Center,
                TextWrapping = TextWrapping.Wrap
            }
        };
    }

    private void StartEditGoal(Goal goal)
    {
        _editingGoalId = goal.Id;
        FormHeaderText.Text = "Hedefi Düzenle";
        SaveGoalButton.Content = "Güncelle";
        EditModeBadge.Visibility = Visibility.Visible;
        CancelEditButton.Visibility = Visibility.Visible;

        TitleTextBox.Text = goal.Title;
        if (goal.Type == "Task")
        {
            TypeTaskRadio.IsChecked = true;
            WeeklyHoursTextBox.Text = (goal.WeeklyMinMinutes / 60).ToString();
            WeeklyMinutesTextBox.Text = (goal.WeeklyMinMinutes % 60).ToString();
        }
        else
        {
            TypeProcessRadio.IsChecked = true;
        }

        TitleTextBox.Focus();
        TitleTextBox.SelectAll();
        HideFeedback();
    }

    private void ResetForm()
    {
        _editingGoalId = null;
        FormHeaderText.Text = "Yeni Hedef Oluştur";
        SaveGoalButton.Content = "Hedef Ekle";
        EditModeBadge.Visibility = Visibility.Collapsed;
        CancelEditButton.Visibility = Visibility.Collapsed;

        TitleTextBox.Text = string.Empty;
        TypeProcessRadio.IsChecked = true;
        WeeklyHoursTextBox.Text = "5";
        WeeklyMinutesTextBox.Text = "0";
    }

    private void ConfirmAndDeleteGoal(Goal goal)
    {
        var result = MessageBox.Show(
            $"\"{goal.Title}\" hedefini silmek istediğinize emin misiniz?\n(Geçmiş oturumu bulunan hedefler istatistiklerin korunması için arşivlenir.)",
            "Hedef Sil",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result != MessageBoxResult.Yes)
        {
            return;
        }

        var archived = App.Database.DeleteOrArchiveGoal(goal.Id);
        if (_editingGoalId == goal.Id)
        {
            ResetForm();
        }

        ShowFeedback(
            archived
                ? $"\"{goal.Title}\" geçmiş oturumları korunarak arşivlendi."
                : $"\"{goal.Title}\" hedefi silindi.",
            isError: false);

        RefreshGoals();
        GoalsChanged?.Invoke();
    }

    private void SaveGoalButton_Click(object sender, RoutedEventArgs e)
    {
        var title = TitleTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            ShowFeedback("Lütfen geçerli bir hedef başlığı girin.", isError: true);
            TitleTextBox.Focus();
            return;
        }

        var isTask = TypeTaskRadio.IsChecked == true;
        var weeklyMinutes = 0;

        if (isTask)
        {
            var hours = long.TryParse(WeeklyHoursTextBox.Text.Trim(), out var h) ? h : 0;
            var mins = long.TryParse(WeeklyMinutesTextBox.Text.Trim(), out var m) ? m : 0;
            var totalMinutesLong = hours * 60 + mins;

            if (totalMinutesLong <= 0)
            {
                ShowFeedback("Görev hedefleri için haftalık minimum süre 0'dan büyük olmalıdır.", isError: true);
                WeeklyHoursTextBox.Focus();
                return;
            }

            if (totalMinutesLong > 10080)
            {
                ShowFeedback("Haftalık minimum süre 168 saati (1 hafta) geçemez.", isError: true);
                return;
            }

            weeklyMinutes = (int)totalMinutesLong;
        }

        var goalType = isTask ? "Task" : "Process";

        if (_editingGoalId.HasValue)
        {
            App.Database.UpdateGoal(_editingGoalId.Value, title, goalType, weeklyMinutes);
            ShowFeedback($"\"{title}\" hedefi güncellendi.", isError: false);
        }
        else
        {
            App.Database.AddGoal(title, goalType, weeklyMinutes);
            ShowFeedback($"\"{title}\" hedefi veritabanına eklendi.", isError: false);
        }

        ResetForm();
        RefreshGoals();
        GoalsChanged?.Invoke();
    }

    private void CancelEditButton_Click(object sender, RoutedEventArgs e)
    {
        ResetForm();
        HideFeedback();
    }

    private void GoalType_Checked(object sender, RoutedEventArgs e)
    {
        if (ProcessNoLimitHint == null || TaskDurationPanel == null)
        {
            return;
        }

        var isTask = TypeTaskRadio.IsChecked == true;
        ProcessNoLimitHint.Visibility = isTask ? Visibility.Collapsed : Visibility.Visible;
        TaskDurationPanel.Visibility = isTask ? Visibility.Visible : Visibility.Collapsed;
    }

    private void TitleTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (TitlePlaceholderText != null)
        {
            TitlePlaceholderText.Visibility = string.IsNullOrEmpty(TitleTextBox.Text)
                ? Visibility.Visible
                : Visibility.Collapsed;
        }
    }

    private void NumericOnly_PreviewTextInput(object sender, TextCompositionEventArgs e)
    {
        e.Handled = !e.Text.All(char.IsDigit);
    }

    private void NumericBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Space)
        {
            e.Handled = true;
        }
        else if (e.Key == Key.Enter)
        {
            SaveGoalButton_Click(sender, e);
            e.Handled = true;
        }
        else if (e.Key == Key.Escape && _editingGoalId.HasValue)
        {
            CancelEditButton_Click(sender, e);
            e.Handled = true;
        }
    }

    private void FormInput_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            SaveGoalButton_Click(sender, e);
            e.Handled = true;
        }
        else if (e.Key == Key.Escape && _editingGoalId.HasValue)
        {
            CancelEditButton_Click(sender, e);
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

    private void ShowFeedback(string message, bool isError)
    {
        FormFeedbackText.Text = message;
        FormFeedbackText.Foreground = isError
            ? new SolidColorBrush(Color.FromRgb(0xF8, 0x71, 0x71))
            : new SolidColorBrush(Color.FromRgb(0x6E, 0xE7, 0xB7));
        FormFeedbackText.Visibility = Visibility.Visible;
    }

    private void HideFeedback()
    {
        FormFeedbackText.Visibility = Visibility.Collapsed;
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
