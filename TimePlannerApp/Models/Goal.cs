namespace TimePlannerApp.Models;

public class Goal
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// "Process" (Süreç) veya "Task" (Görev)
    /// </summary>
    public string Type { get; set; } = "Process";

    /// <summary>
    /// Sadece 'Task' türü için haftalık minimum hedef süre (dakika)
    /// </summary>
    public int WeeklyMinMinutes { get; set; }

    public string CreatedAt { get; set; } = string.Empty;
    public bool IsArchived { get; set; }
    public bool IsCompleted { get; set; }
    public string? CompletedAt { get; set; }
}

public class GoalSummary
{
    public Goal Goal { get; set; } = new();
    public int TotalSessionCount { get; set; }
    public int TotalDurationSeconds { get; set; }
    public int WeeklyDurationSeconds { get; set; }

    public double WeeklyCompletionPercent
    {
        get
        {
            if (Goal.Type != "Task" || Goal.WeeklyMinMinutes <= 0)
            {
                return 0;
            }

            return (WeeklyDurationSeconds / 60.0) / Goal.WeeklyMinMinutes * 100.0;
        }
    }
}
