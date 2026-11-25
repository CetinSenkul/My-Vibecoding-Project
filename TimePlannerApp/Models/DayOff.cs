namespace TimePlannerApp.Models;

public class DayOff
{
    /// <summary>
    /// YYYY-MM-DD
    /// </summary>
    public string Date { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}
