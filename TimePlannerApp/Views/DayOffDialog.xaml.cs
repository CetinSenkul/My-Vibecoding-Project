using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace TimePlannerApp.Views;

public enum DayOffDialogAction
{
    Cancel,
    Save,
    Remove
}

public partial class DayOffDialog : Window
{
    public DayOffDialogAction ResultAction { get; private set; } = DayOffDialogAction.Cancel;
    public string ReasonText => ReasonTextBox.Text.Trim();

    public DayOffDialog(DateTime date, string? existingReason = null)
    {
        InitializeComponent();

        var tr = new CultureInfo("tr-TR");
        DateSubtitleText.Text = date.ToString("d MMMM yyyy, dddd", tr);

        if (!string.IsNullOrWhiteSpace(existingReason))
        {
            DialogTitleText.Text = "İzin Gününü Düzenle";
            ReasonTextBox.Text = existingReason;
            RemoveButton.Visibility = Visibility.Visible;
            SaveButton.Content = "Güncelle";
        }
        else
        {
            ReasonTextBox.Text = "Dinlenme";
        }

        Loaded += (_, _) =>
        {
            ReasonTextBox.Focus();
            ReasonTextBox.SelectAll();
        };
    }

    private void QuickReason_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Content is string reason)
        {
            ReasonTextBox.Text = reason;
            ReasonTextBox.Focus();
            ReasonTextBox.CaretIndex = ReasonTextBox.Text.Length;
        }
    }

    private void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(ReasonTextBox.Text))
        {
            ReasonTextBox.Text = "İzinli";
        }

        ResultAction = DayOffDialogAction.Save;
        DialogResult = true;
        Close();
    }

    private void RemoveButton_Click(object sender, RoutedEventArgs e)
    {
        ResultAction = DayOffDialogAction.Remove;
        DialogResult = true;
        Close();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        ResultAction = DayOffDialogAction.Cancel;
        DialogResult = false;
        Close();
    }

    private void ReasonTextBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            SaveButton_Click(sender, e);
            e.Handled = true;
        }
        else if (e.Key == Key.Escape)
        {
            CancelButton_Click(sender, e);
            e.Handled = true;
        }
    }
}
