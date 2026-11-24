namespace TimePlannerApp.Models;

public class WorkSession
{
    public int Id { get; set; }
    public int GoalId { get; set; }

    /// <summary>
    /// YYYY-MM-DD
    /// </summary>
    public string SessionDate { get; set; } = string.Empty;

    /// <summary>
    /// HH:mm:ss
    /// </summary>
    public string StartTime { get; set; } = string.Empty;

    /// <summary>
    /// HH:mm:ss
    /// </summary>
    public string EndTime { get; set; } = string.Empty;

    public int DurationSeconds { get; set; }
}

public class WorkSessionDetail : WorkSession
{
    public string GoalTitle { get; set; } = string.Empty;
    public string GoalType { get; set; } = "Process";
}
