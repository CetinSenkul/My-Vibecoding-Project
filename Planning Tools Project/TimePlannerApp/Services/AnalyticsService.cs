using System.Globalization;
using System.Windows.Media;
using TimePlannerApp.Data;
using TimePlannerApp.Models;

namespace TimePlannerApp.Services;

public enum AnalyticsTimeFilter
{
    Daily,
    Weekly,
    Monthly,
    Overall
}

public enum TaskScatterPeriod
{
    Daily,
    Weekly,
    Monthly
}

public sealed class GoalAnalyticsItem
{
    public int GoalId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string ShortLabel { get; init; } = string.Empty;
    public string GoalType { get; init; } = "Process";
    public int DurationSeconds { get; init; }
    public int SessionCount { get; init; }
    public double SharePercent { get; init; }
    public int WeeklyMinMinutes { get; init; }
    public double PeriodTargetMinutes { get; init; }
    public double TaskCompletionPercent { get; init; }
    public Color AccentColor { get; init; }

    public double DurationHours => DurationSeconds / 3600.0;
}

public sealed class AnalyticsSnapshot
{
    public AnalyticsTimeFilter Filter { get; init; }
    public string FilterLabel { get; init; } = string.Empty;
    public int TotalSeconds { get; init; }
    public int TotalSessions { get; init; }
    public int ActiveDaysCount { get; init; }
    public int DayOffCount { get; init; }
    public int PeriodTargetMinutesExcludingDayOffs { get; init; }
    public double OverallTargetCompletionPercent { get; init; }
    public string TopGoalTitle { get; init; } = "—";
    public List<GoalAnalyticsItem> Items { get; init; } = [];
}

public sealed class TaskScatterPointInfo
{
    public int TaskRowIndex { get; init; }
    public int BucketIndex { get; init; }
    public string GoalTitle { get; init; } = string.Empty;
    public string BucketLabel { get; init; } = string.Empty;
    public int DurationSeconds { get; init; }
    public double TargetBucketMinutes { get; init; }
    public double CompletionPercent { get; init; }
    public PerformanceTier Tier { get; init; }
    public bool IsDayOff { get; init; }
    public string? DayOffReason { get; init; }

    public double DurationHours => DurationSeconds / 3600.0;
}

public sealed class TaskScatterSnapshot
{
    public TaskScatterPeriod Period { get; init; }
    public string PeriodLabel { get; init; } = string.Empty;
    public List<string> TaskLabels { get; init; } = [];
    public List<string> BucketLabels { get; init; } = [];
    public List<TaskScatterPointInfo> Points { get; init; } = [];
}

public class AnalyticsService
{
    private readonly DatabaseService _db;

    private static readonly Color[] ProcessPalette =
    [
        Color.FromRgb(0x3B, 0x82, 0xF6),
        Color.FromRgb(0x8B, 0x5C, 0xF6),
        Color.FromRgb(0x06, 0xB6, 0xD4),
        Color.FromRgb(0xEC, 0x48, 0x99),
        Color.FromRgb(0x14, 0xB8, 0xA6),
        Color.FromRgb(0x63, 0x66, 0xF1)
    ];

    public AnalyticsService(DatabaseService db)
    {
        _db = db;
    }

    public AnalyticsSnapshot GetOverview(AnalyticsTimeFilter filter, DateTime? referenceDate = null)
    {
        var today = (referenceDate ?? DateTime.Today).Date;
        var dailyTargets = _db.GetDailyTargets();
        List<WorkSessionDetail> sessions;
        string filterLabel;
        double weekMultiplier;
        int dayOffCount;
        int periodTargetMinutes = 0;

        switch (filter)
        {
            case AnalyticsTimeFilter.Daily:
                sessions = _db.GetSessionDetailsForDate(today);
                filterLabel = "Günlük";
                var todayOff = _db.GetDayOff(today);
                dayOffCount = todayOff != null ? 1 : 0;
                weekMultiplier = todayOff != null ? 0.0 : 1.0 / 7.0;
                periodTargetMinutes = todayOff != null ? 0 : GetTargetMin(dailyTargets, today.DayOfWeek);
                break;

            case AnalyticsTimeFilter.Weekly:
                var weekStart = GetMondayOfWeek(today);
                var weekEnd = weekStart.AddDays(6);
                sessions = _db.GetSessionDetailsForDateRange(weekStart, weekEnd);
                filterLabel = "Haftalık";
                var weekOffs = _db.GetDayOffsByRange(weekStart, weekEnd);
                dayOffCount = weekOffs.Count;
                var nonExemptWeekDays = Math.Max(0, 7 - dayOffCount);
                weekMultiplier = nonExemptWeekDays / 7.0;
                for (var i = 0; i < 7; i++)
                {
                    var d = weekStart.AddDays(i);
                    if (!weekOffs.ContainsKey(d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))
                    {
                        periodTargetMinutes += GetTargetMin(dailyTargets, d.DayOfWeek);
                    }
                }
                break;

            case AnalyticsTimeFilter.Monthly:
                var monthStart = new DateTime(today.Year, today.Month, 1);
                var daysInMonth = DateTime.DaysInMonth(today.Year, today.Month);
                var monthEnd = new DateTime(today.Year, today.Month, daysInMonth);
                sessions = _db.GetSessionDetailsForDateRange(monthStart, monthEnd);
                filterLabel = "Aylık";
                var monthOffs = _db.GetDayOffsByRange(monthStart, monthEnd);
                dayOffCount = monthOffs.Count;
                var nonExemptMonthDays = Math.Max(0, daysInMonth - dayOffCount);
                weekMultiplier = nonExemptMonthDays / 7.0;
                for (var i = 0; i < daysInMonth; i++)
                {
                    var d = monthStart.AddDays(i);
                    if (!monthOffs.ContainsKey(d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))
                    {
                        periodTargetMinutes += GetTargetMin(dailyTargets, d.DayOfWeek);
                    }
                }
                break;

            default:
                sessions = _db.GetAllSessionDetails();
                filterLabel = "Genel";
                var allOffDates = _db.GetAllDayOffDates();
                dayOffCount = allOffDates.Count;
                weekMultiplier = 1.0;

                // Genel aralıkta aktif çalışma günlerinin (izinli olmayanların) hedef toplamı
                foreach (var dateStr in sessions.Select(s => s.SessionDate).Distinct())
                {
                    if (!allOffDates.Contains(dateStr) &&
                        DateTime.TryParseExact(dateStr, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                    {
                        periodTargetMinutes += GetTargetMin(dailyTargets, d.DayOfWeek);
                    }
                }
                break;
        }

        var goalLookup = _db.GetAllGoalsIncludingArchived().ToDictionary(g => g.Id);
        var totalSeconds = sessions.Sum(s => s.DurationSeconds);
        var activeDays = sessions.Select(s => s.SessionDate).Distinct().Count();
        var overallCompletionPct = periodTargetMinutes > 0
            ? (totalSeconds / 60.0) / periodTargetMinutes * 100.0
            : (totalSeconds > 0 ? 100.0 : 0.0);

        var grouped = sessions
            .GroupBy(s => s.GoalId)
            .Select(g => new
            {
                GoalId = g.Key,
                Title = g.First().GoalTitle,
                Type = g.First().GoalType,
                DurationSeconds = g.Sum(x => x.DurationSeconds),
                SessionCount = g.Count()
            })
            .OrderByDescending(x => x.DurationSeconds)
            .ToList();

        var items = new List<GoalAnalyticsItem>();
        var processColorIdx = 0;

        foreach (var entry in grouped)
        {
            var weeklyMin = goalLookup.TryGetValue(entry.GoalId, out var goalObj)
                ? goalObj.WeeklyMinMinutes
                : 0;

            var periodTargetMin = entry.Type == "Task" && weeklyMin > 0
                ? weeklyMin * weekMultiplier
                : 0.0;

            var taskCompletionPct = entry.Type == "Task" && periodTargetMin > 0
                ? (entry.DurationSeconds / 60.0) / periodTargetMin * 100.0
                : 0.0;

            Color accent;
            if (entry.Type == "Task" && weeklyMin > 0 && periodTargetMin > 0)
            {
                accent = ColorScaleService.GetColorInfo(taskCompletionPct).PrimaryColor;
            }
            else
            {
                accent = ProcessPalette[processColorIdx % ProcessPalette.Length];
                processColorIdx++;
            }

            var sharePct = totalSeconds > 0
                ? entry.DurationSeconds * 100.0 / totalSeconds
                : 0.0;

            items.Add(new GoalAnalyticsItem
            {
                GoalId = entry.GoalId,
                Title = entry.Title,
                ShortLabel = BuildShortLabel(entry.Title),
                GoalType = entry.Type,
                DurationSeconds = entry.DurationSeconds,
                SessionCount = entry.SessionCount,
                SharePercent = sharePct,
                WeeklyMinMinutes = weeklyMin,
                PeriodTargetMinutes = periodTargetMin,
                TaskCompletionPercent = taskCompletionPct,
                AccentColor = accent
            });
        }

        return new AnalyticsSnapshot
        {
            Filter = filter,
            FilterLabel = filterLabel,
            TotalSeconds = totalSeconds,
            TotalSessions = sessions.Count,
            ActiveDaysCount = activeDays,
            DayOffCount = dayOffCount,
            PeriodTargetMinutesExcludingDayOffs = periodTargetMinutes,
            OverallTargetCompletionPercent = overallCompletionPct,
            TopGoalTitle = items.Count > 0 ? items[0].Title : "—",
            Items = items
        };
    }

    public TaskScatterSnapshot GetTaskScatter(TaskScatterPeriod period, DateTime? referenceDate = null)
    {
        var today = (referenceDate ?? DateTime.Today).Date;
        var allTaskGoals = _db.GetAllGoalsIncludingArchived()
            .Where(g => g.Type == "Task" && !g.IsArchived)
            .OrderBy(g => g.Id)
            .ToList();

        if (allTaskGoals.Count == 0)
        {
            return new TaskScatterSnapshot
            {
                Period = period,
                PeriodLabel = GetScatterPeriodLabel(period)
            };
        }

        List<string> bucketLabels;
        List<WorkSessionDetail> sessions;
        Func<WorkSessionDetail, int> bucketResolver;
        Func<Goal, int, (double TargetMin, bool IsOff, string? OffReason)> bucketTargetResolver;

        switch (period)
        {
            case TaskScatterPeriod.Daily:
                bucketLabels = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];
                sessions = _db.GetSessionDetailsForDate(today);
                var todayOff = _db.GetDayOff(today);
                bucketResolver = s =>
                {
                    if (TimeSpan.TryParseExact(s.StartTime, @"hh\:mm\:ss", CultureInfo.InvariantCulture, out var ts))
                    {
                        return Math.Clamp(ts.Hours / 4, 0, 5);
                    }
                    return 0;
                };
                bucketTargetResolver = (g, _) =>
                    todayOff != null
                        ? (0.0, true, todayOff.Reason)
                        : (Math.Max(1.0, g.WeeklyMinMinutes / 7.0), false, null);
                break;

            case TaskScatterPeriod.Monthly:
                var monthStart = new DateTime(today.Year, today.Month, 1);
                var daysInMonth = DateTime.DaysInMonth(today.Year, today.Month);
                var monthEnd = new DateTime(today.Year, today.Month, daysInMonth);
                var weekCount = (int)Math.Ceiling(daysInMonth / 7.0);
                bucketLabels = Enumerable.Range(1, weekCount).Select(w => $"{w}. Hf").ToList();
                sessions = _db.GetSessionDetailsForDateRange(monthStart, monthEnd);
                var monthOffs = _db.GetDayOffsByRange(monthStart, monthEnd);
                bucketResolver = s =>
                {
                    if (DateTime.TryParseExact(s.SessionDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                    {
                        return Math.Clamp((d.Day - 1) / 7, 0, weekCount - 1);
                    }
                    return 0;
                };
                bucketTargetResolver = (g, bucketIdx) =>
                {
                    var startDay = bucketIdx * 7 + 1;
                    var endDay = Math.Min(daysInMonth, startDay + 6);
                    var totalBucketDays = endDay - startDay + 1;
                    var offDaysInBucket = 0;
                    string? firstReason = null;
                    for (var d = startDay; d <= endDay; d++)
                    {
                        var key = new DateTime(today.Year, today.Month, d).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                        if (monthOffs.TryGetValue(key, out var off))
                        {
                            offDaysInBucket++;
                            firstReason ??= off.Reason;
                        }
                    }

                    var nonExempt = totalBucketDays - offDaysInBucket;
                    if (nonExempt <= 0)
                    {
                        return (0.0, true, firstReason ?? "İzinli");
                    }

                    return (Math.Max(1.0, g.WeeklyMinMinutes * (nonExempt / 7.0)), false, null);
                };
                break;

            default: // Weekly (Pzt..Paz)
                var weekStart = GetMondayOfWeek(today);
                var weekEnd = weekStart.AddDays(6);
                bucketLabels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
                sessions = _db.GetSessionDetailsForDateRange(weekStart, weekEnd);
                var weekOffs = _db.GetDayOffsByRange(weekStart, weekEnd);
                bucketResolver = s =>
                {
                    if (DateTime.TryParseExact(s.SessionDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
                    {
                        return Math.Clamp(((int)d.DayOfWeek + 6) % 7, 0, 6);
                    }
                    return 0;
                };
                bucketTargetResolver = (g, bucketIdx) =>
                {
                    var dayKey = weekStart.AddDays(bucketIdx).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                    if (weekOffs.TryGetValue(dayKey, out var off))
                    {
                        return (0.0, true, off.Reason);
                    }

                    return (Math.Max(1.0, g.WeeklyMinMinutes / 7.0), false, null);
                };
                break;
        }

        // Aktif görevler + ilgili dönemde kaydı olan tamamlanmış görevler grafikte görünür
        var sessionGoalIds = sessions.Select(s => s.GoalId).ToHashSet();
        var visibleTasks = allTaskGoals
            .Where(t => !t.IsCompleted || sessionGoalIds.Contains(t.Id))
            .ToList();

        if (visibleTasks.Count == 0)
        {
            return new TaskScatterSnapshot
            {
                Period = period,
                PeriodLabel = GetScatterPeriodLabel(period)
            };
        }

        var taskIdSet = visibleTasks.Select(t => t.Id).ToHashSet();
        var taskSessions = sessions.Where(s => taskIdSet.Contains(s.GoalId)).ToList();

        var sumMap = new Dictionary<(int GoalId, int Bucket), int>();
        foreach (var s in taskSessions)
        {
            var bucket = bucketResolver(s);
            var key = (s.GoalId, bucket);
            sumMap[key] = sumMap.TryGetValue(key, out var existing)
                ? existing + s.DurationSeconds
                : s.DurationSeconds;
        }

        var taskLabels = visibleTasks
            .Select(t => TruncateLabel(t.IsCompleted ? $"✓ {t.Title}" : t.Title, 14))
            .ToList();
        var points = new List<TaskScatterPointInfo>();

        for (var rowIdx = 0; rowIdx < visibleTasks.Count; rowIdx++)
        {
            var task = visibleTasks[rowIdx];

            for (var bucketIdx = 0; bucketIdx < bucketLabels.Count; bucketIdx++)
            {
                var durSec = sumMap.TryGetValue((task.Id, bucketIdx), out var sec) ? sec : 0;
                var (targetBucketMin, isOff, offReason) = bucketTargetResolver(task, bucketIdx);

                var pct = (!isOff && durSec > 0 && targetBucketMin > 0)
                    ? (durSec / 60.0) / targetBucketMin * 100.0
                    : 0.0;
                var tier = isOff ? PerformanceTier.Zero : ColorScaleService.GetTier(pct);

                points.Add(new TaskScatterPointInfo
                {
                    TaskRowIndex = rowIdx,
                    BucketIndex = bucketIdx,
                    GoalTitle = task.Title,
                    BucketLabel = bucketLabels[bucketIdx],
                    DurationSeconds = durSec,
                    TargetBucketMinutes = targetBucketMin,
                    CompletionPercent = pct,
                    Tier = tier,
                    IsDayOff = isOff,
                    DayOffReason = offReason
                });
            }
        }

        return new TaskScatterSnapshot
        {
            Period = period,
            PeriodLabel = GetScatterPeriodLabel(period),
            TaskLabels = taskLabels,
            BucketLabels = bucketLabels,
            Points = points
        };
    }

    private static int GetTargetMin(Dictionary<int, int> targets, DayOfWeek dow)
        => targets.TryGetValue((int)dow, out var m) ? m : 120;

    private static string GetScatterPeriodLabel(TaskScatterPeriod period) => period switch
    {
        TaskScatterPeriod.Daily => "Günlük",
        TaskScatterPeriod.Monthly => "Aylık",
        _ => "Haftalık"
    };

    private static DateTime GetMondayOfWeek(DateTime date)
    {
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.Date.AddDays(-diff);
    }

    private static string BuildShortLabel(string title)
    {
        var trimmed = title.Trim();
        if (trimmed.Length <= 5)
        {
            return trimmed;
        }

        var firstWord = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
        if (firstWord.Length <= 5)
        {
            return firstWord;
        }

        return firstWord[..4] + ".";
    }

    private static string TruncateLabel(string title, int maxLen)
    {
        var trimmed = title.Trim();
        return trimmed.Length <= maxLen ? trimmed : trimmed[..(maxLen - 1)] + "…";
    }
}
