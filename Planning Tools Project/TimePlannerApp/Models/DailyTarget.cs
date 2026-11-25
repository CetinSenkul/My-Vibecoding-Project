namespace TimePlannerApp.Models;

public class DailyTarget
{
    /// <summary>
    /// 0: Pazar, 1: Pazartesi, ..., 6: Cumartesi (System.DayOfWeek ile uyumlu)
    /// </summary>
    public int DayOfWeek { get; set; }

    public int TargetMinutes { get; set; } = 120;
}
