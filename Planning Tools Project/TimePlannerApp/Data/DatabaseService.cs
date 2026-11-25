using System.Globalization;
using System.IO;
using Microsoft.Data.Sqlite;
using TimePlannerApp.Models;

namespace TimePlannerApp.Data;

public class DatabaseService
{
    public string DatabasePath { get; }
    private string ConnectionString => $"Data Source={DatabasePath};Foreign Keys=True;";

    public DatabaseService(string? customDbPath = null)
    {
        DatabasePath = customDbPath ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "planner.db");
    }

    public SqliteConnection CreateConnection()
    {
        var connection = new SqliteConnection(ConnectionString);
        connection.Open();
        using var pragmaCmd = connection.CreateCommand();
        pragmaCmd.CommandText = "PRAGMA foreign_keys = ON;";
        pragmaCmd.ExecuteNonQuery();
        return connection;
    }

    public void Initialize()
    {
        var directory = Path.GetDirectoryName(DatabasePath);
        if (!string.IsNullOrWhiteSpace(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS DailyTargets (
                DayOfWeek INTEGER PRIMARY KEY,
                TargetMinutes INTEGER NOT NULL DEFAULT 120
            );

            CREATE TABLE IF NOT EXISTS Goals (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Title TEXT NOT NULL,
                Type TEXT NOT NULL CHECK (Type IN ('Process', 'Task')),
                WeeklyMinMinutes INTEGER DEFAULT 0,
                CreatedAt TEXT NOT NULL,
                IsArchived INTEGER NOT NULL DEFAULT 0,
                IsCompleted INTEGER NOT NULL DEFAULT 0,
                CompletedAt TEXT
            );

            CREATE TABLE IF NOT EXISTS WorkSessions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                GoalId INTEGER NOT NULL,
                SessionDate TEXT NOT NULL,
                StartTime TEXT NOT NULL,
                EndTime TEXT NOT NULL,
                DurationSeconds INTEGER NOT NULL,
                FOREIGN KEY (GoalId) REFERENCES Goals(Id)
            );

            CREATE TABLE IF NOT EXISTS DayOffs (
                Date TEXT PRIMARY KEY,
                Reason TEXT NOT NULL,
                CreatedAt TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS AppSettings (
                Key TEXT PRIMARY KEY,
                Value TEXT NOT NULL
            );
            """;
        cmd.ExecuteNonQuery();

        // Varsayılan günlük hedefleri (0: Pazar ... 6: Cumartesi) 120 dk olarak başlat
        using var seedCmd = connection.CreateCommand();
        seedCmd.CommandText = """
            INSERT OR IGNORE INTO DailyTargets (DayOfWeek, TargetMinutes) VALUES
                (0, 120),
                (1, 120),
                (2, 120),
                (3, 120),
                (4, 120),
                (5, 120),
                (6, 120);
            """;
        seedCmd.ExecuteNonQuery();

        EnsureGoalCompletionColumns(connection);
    }

    private static void EnsureGoalCompletionColumns(SqliteConnection connection)
    {
        var existingCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var infoCmd = connection.CreateCommand())
        {
            infoCmd.CommandText = "PRAGMA table_info(Goals);";
            using var reader = infoCmd.ExecuteReader();
            while (reader.Read())
            {
                existingCols.Add(reader.GetString(1));
            }
        }

        if (!existingCols.Contains("IsCompleted"))
        {
            using var alter1 = connection.CreateCommand();
            alter1.CommandText = "ALTER TABLE Goals ADD COLUMN IsCompleted INTEGER NOT NULL DEFAULT 0;";
            alter1.ExecuteNonQuery();
        }

        if (!existingCols.Contains("CompletedAt"))
        {
            using var alter2 = connection.CreateCommand();
            alter2.CommandText = "ALTER TABLE Goals ADD COLUMN CompletedAt TEXT;";
            alter2.ExecuteNonQuery();
        }
    }

    #region DailyTargets

    public Dictionary<int, int> GetDailyTargets()
    {
        var result = new Dictionary<int, int>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT DayOfWeek, TargetMinutes FROM DailyTargets ORDER BY DayOfWeek;";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            result[reader.GetInt32(0)] = reader.GetInt32(1);
        }

        for (var i = 0; i < 7; i++)
        {
            result.TryAdd(i, 120);
        }

        return result;
    }

    public int GetDailyTargetMinutes(DayOfWeek dayOfWeek)
    {
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT TargetMinutes FROM DailyTargets WHERE DayOfWeek = @day;";
        cmd.Parameters.AddWithValue("@day", (int)dayOfWeek);
        var val = cmd.ExecuteScalar();
        return val is long l ? (int)l : 120;
    }

    public void SaveDailyTargets(Dictionary<int, int> targetsByDayOfWeek)
    {
        using var connection = CreateConnection();
        using var transaction = connection.BeginTransaction();

        foreach (var kvp in targetsByDayOfWeek)
        {
            if (kvp.Key < 0 || kvp.Key > 6)
            {
                continue;
            }

            var safeMinutes = Math.Clamp(kvp.Value, 0, 1440);
            using var cmd = connection.CreateCommand();
            cmd.Transaction = transaction;
            cmd.CommandText = """
                INSERT INTO DailyTargets (DayOfWeek, TargetMinutes)
                VALUES (@day, @minutes)
                ON CONFLICT(DayOfWeek) DO UPDATE SET TargetMinutes = excluded.TargetMinutes;
                """;
            cmd.Parameters.AddWithValue("@day", kvp.Key);
            cmd.Parameters.AddWithValue("@minutes", safeMinutes);
            cmd.ExecuteNonQuery();
        }

        transaction.Commit();
    }

    #endregion

    #region Goals CRUD

    public List<Goal> GetActiveGoals()
    {
        var list = new List<Goal>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT Id, Title, Type, WeeklyMinMinutes, CreatedAt, IsArchived, IsCompleted, CompletedAt
            FROM Goals
            WHERE IsArchived = 0 AND IsCompleted = 0
            ORDER BY Type ASC, Id DESC;
            """;

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(ReadGoal(reader));
        }

        return list;
    }

    public List<GoalSummary> GetActiveGoalSummaries(DateTime? referenceDate = null)
    {
        return GetGoalSummariesByCompletion(isCompleted: false, referenceDate);
    }

    public List<GoalSummary> GetCompletedGoalSummaries(DateTime? referenceDate = null)
    {
        return GetGoalSummariesByCompletion(isCompleted: true, referenceDate);
    }

    private List<GoalSummary> GetGoalSummariesByCompletion(bool isCompleted, DateTime? referenceDate = null)
    {
        var refDate = (referenceDate ?? DateTime.Today).Date;
        var diffFromMonday = ((int)refDate.DayOfWeek + 6) % 7;
        var weekStart = refDate.AddDays(-diffFromMonday);
        var weekEnd = weekStart.AddDays(6);

        var list = new List<GoalSummary>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = isCompleted
            ? """
                SELECT
                    g.Id, g.Title, g.Type, g.WeeklyMinMinutes, g.CreatedAt, g.IsArchived, g.IsCompleted, g.CompletedAt,
                    COUNT(ws.Id) AS TotalSessions,
                    COALESCE(SUM(ws.DurationSeconds), 0) AS TotalSeconds,
                    COALESCE(SUM(CASE
                        WHEN ws.SessionDate >= @weekStart AND ws.SessionDate <= @weekEnd
                        THEN ws.DurationSeconds ELSE 0 END), 0) AS WeeklySeconds
                FROM Goals g
                LEFT JOIN WorkSessions ws ON ws.GoalId = g.Id
                WHERE g.IsArchived = 0 AND g.IsCompleted = 1
                GROUP BY g.Id, g.Title, g.Type, g.WeeklyMinMinutes, g.CreatedAt, g.IsArchived, g.IsCompleted, g.CompletedAt
                ORDER BY g.CompletedAt DESC, g.Id DESC;
                """
            : """
                SELECT
                    g.Id, g.Title, g.Type, g.WeeklyMinMinutes, g.CreatedAt, g.IsArchived, g.IsCompleted, g.CompletedAt,
                    COUNT(ws.Id) AS TotalSessions,
                    COALESCE(SUM(ws.DurationSeconds), 0) AS TotalSeconds,
                    COALESCE(SUM(CASE
                        WHEN ws.SessionDate >= @weekStart AND ws.SessionDate <= @weekEnd
                        THEN ws.DurationSeconds ELSE 0 END), 0) AS WeeklySeconds
                FROM Goals g
                LEFT JOIN WorkSessions ws ON ws.GoalId = g.Id
                WHERE g.IsArchived = 0 AND g.IsCompleted = 0
                GROUP BY g.Id, g.Title, g.Type, g.WeeklyMinMinutes, g.CreatedAt, g.IsArchived, g.IsCompleted, g.CompletedAt
                ORDER BY g.Id DESC;
                """;
        cmd.Parameters.AddWithValue("@weekStart", weekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@weekEnd", weekEnd.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new GoalSummary
            {
                Goal = ReadGoal(reader),
                TotalSessionCount = reader.GetInt32(8),
                TotalDurationSeconds = reader.GetInt32(9),
                WeeklyDurationSeconds = reader.GetInt32(10)
            });
        }

        return list;
    }

    public void SetGoalCompleted(int id, bool isCompleted)
    {
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            UPDATE Goals
            SET IsCompleted = @completed,
                CompletedAt = @completedAt
            WHERE Id = @id;
            """;
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@completed", isCompleted ? 1 : 0);
        cmd.Parameters.AddWithValue("@completedAt", isCompleted
            ? DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)
            : (object)DBNull.Value);
        cmd.ExecuteNonQuery();
    }

    private static Goal ReadGoal(SqliteDataReader reader) => new()
    {
        Id = reader.GetInt32(0),
        Title = reader.GetString(1),
        Type = reader.GetString(2),
        WeeklyMinMinutes = reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
        CreatedAt = reader.GetString(4),
        IsArchived = reader.GetInt32(5) == 1,
        IsCompleted = reader.GetInt32(6) == 1,
        CompletedAt = reader.IsDBNull(7) ? null : reader.GetString(7)
    };

    public int AddGoal(string title, string type, int weeklyMinMinutes)
    {
        var normalizedType = type == "Task" ? "Task" : "Process";
        var safeWeeklyMinutes = normalizedType == "Task" ? Math.Max(1, weeklyMinMinutes) : 0;

        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            INSERT INTO Goals (Title, Type, WeeklyMinMinutes, CreatedAt, IsArchived)
            VALUES (@title, @type, @weeklyMin, @createdAt, 0);
            SELECT last_insert_rowid();
            """;
        cmd.Parameters.AddWithValue("@title", title.Trim());
        cmd.Parameters.AddWithValue("@type", normalizedType);
        cmd.Parameters.AddWithValue("@weeklyMin", safeWeeklyMinutes);
        cmd.Parameters.AddWithValue("@createdAt", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture));

        var result = cmd.ExecuteScalar();
        return result is long id ? (int)id : 0;
    }

    public void UpdateGoal(int id, string title, string type, int weeklyMinMinutes)
    {
        var normalizedType = type == "Task" ? "Task" : "Process";
        var safeWeeklyMinutes = normalizedType == "Task" ? Math.Max(1, weeklyMinMinutes) : 0;

        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            UPDATE Goals
            SET Title = @title,
                Type = @type,
                WeeklyMinMinutes = @weeklyMin
            WHERE Id = @id;
            """;
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@title", title.Trim());
        cmd.Parameters.AddWithValue("@type", normalizedType);
        cmd.Parameters.AddWithValue("@weeklyMin", safeWeeklyMinutes);
        cmd.ExecuteNonQuery();
    }

    /// <summary>
    /// Hedefe bağlı oturum yoksa kalıcı siler; geçmiş oturumu varsa veri bütünlüğü için arşivler.
    /// </summary>
    /// <returns>True ise arşivlendi, False ise tamamen silindi.</returns>
    public bool DeleteOrArchiveGoal(int id)
    {
        using var connection = CreateConnection();

        using var countCmd = connection.CreateCommand();
        countCmd.CommandText = "SELECT COUNT(*) FROM WorkSessions WHERE GoalId = @id;";
        countCmd.Parameters.AddWithValue("@id", id);
        var sessionCount = countCmd.ExecuteScalar() is long c ? c : 0;

        if (sessionCount > 0)
        {
            using var archiveCmd = connection.CreateCommand();
            archiveCmd.CommandText = "UPDATE Goals SET IsArchived = 1 WHERE Id = @id;";
            archiveCmd.Parameters.AddWithValue("@id", id);
            archiveCmd.ExecuteNonQuery();
            return true;
        }

        using var deleteCmd = connection.CreateCommand();
        deleteCmd.CommandText = "DELETE FROM Goals WHERE Id = @id;";
        deleteCmd.Parameters.AddWithValue("@id", id);
        deleteCmd.ExecuteNonQuery();
        return false;
    }

    #endregion

    #region WorkSessions Queries

    public int AddWorkSession(int goalId, DateTime startLocal, DateTime endLocal, int durationSeconds)
    {
        var safeDuration = Math.Max(1, durationSeconds);
        if (endLocal < startLocal)
        {
            endLocal = startLocal.AddSeconds(safeDuration);
        }

        using var connection = CreateConnection();
        using var transaction = connection.BeginTransaction();

        var lastId = 0;

        // Oturum gece yarısını aştıysa gün bazlı iki temiz kayda böl
        if (startLocal.Date < endLocal.Date)
        {
            var endOfStartDay = startLocal.Date.AddHours(23).AddMinutes(59).AddSeconds(59);
            var firstSpan = Math.Max(1, (int)Math.Round((endOfStartDay - startLocal).TotalSeconds));
            var firstDur = Math.Min(safeDuration, firstSpan);
            var remainingDur = Math.Max(0, safeDuration - firstDur);

            lastId = InsertSingleSession(
                connection,
                transaction,
                goalId,
                startLocal.Date,
                startLocal.TimeOfDay,
                endOfStartDay.TimeOfDay,
                firstDur);

            if (remainingDur > 0)
            {
                lastId = InsertSingleSession(
                    connection,
                    transaction,
                    goalId,
                    endLocal.Date,
                    TimeSpan.Zero,
                    endLocal.TimeOfDay,
                    remainingDur);
            }
        }
        else
        {
            lastId = InsertSingleSession(
                connection,
                transaction,
                goalId,
                startLocal.Date,
                startLocal.TimeOfDay,
                endLocal.TimeOfDay,
                safeDuration);
        }

        transaction.Commit();
        return lastId;
    }

    private static int InsertSingleSession(
        SqliteConnection connection,
        SqliteTransaction transaction,
        int goalId,
        DateTime sessionDate,
        TimeSpan startTime,
        TimeSpan endTime,
        int durationSeconds)
    {
        using var cmd = connection.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = """
            INSERT INTO WorkSessions (GoalId, SessionDate, StartTime, EndTime, DurationSeconds)
            VALUES (@goalId, @sessionDate, @startTime, @endTime, @durationSeconds);
            SELECT last_insert_rowid();
            """;
        cmd.Parameters.AddWithValue("@goalId", goalId);
        cmd.Parameters.AddWithValue("@sessionDate", sessionDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@startTime", startTime.ToString(@"hh\:mm\:ss", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@endTime", endTime.ToString(@"hh\:mm\:ss", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@durationSeconds", durationSeconds);

        var result = cmd.ExecuteScalar();
        return result is long id ? (int)id : 0;
    }

    public void DeleteWorkSession(int sessionId)
    {
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "DELETE FROM WorkSessions WHERE Id = @id;";
        cmd.Parameters.AddWithValue("@id", sessionId);
        cmd.ExecuteNonQuery();
    }

    public Dictionary<string, int> GetDailyTotalSecondsByRange(DateTime startDate, DateTime endDate)
    {
        var result = new Dictionary<string, int>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT SessionDate, SUM(DurationSeconds)
            FROM WorkSessions
            WHERE SessionDate >= @start AND SessionDate <= @end
            GROUP BY SessionDate;
            """;
        cmd.Parameters.AddWithValue("@start", startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@end", endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var dateKey = reader.GetString(0);
            var totalSec = reader.IsDBNull(1) ? 0 : reader.GetInt32(1);
            result[dateKey] = totalSec;
        }

        return result;
    }

    public List<WorkSession> GetSessionsForDate(DateTime date)
    {
        var list = new List<WorkSession>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT Id, GoalId, SessionDate, StartTime, EndTime, DurationSeconds
            FROM WorkSessions
            WHERE SessionDate = @date
            ORDER BY StartTime ASC;
            """;
        cmd.Parameters.AddWithValue("@date", date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new WorkSession
            {
                Id = reader.GetInt32(0),
                GoalId = reader.GetInt32(1),
                SessionDate = reader.GetString(2),
                StartTime = reader.GetString(3),
                EndTime = reader.GetString(4),
                DurationSeconds = reader.GetInt32(5)
            });
        }

        return list;
    }

    public List<WorkSessionDetail> GetSessionDetailsForDate(DateTime date)
    {
        return GetSessionDetailsForDateRange(date.Date, date.Date);
    }

    public List<WorkSessionDetail> GetSessionDetailsForDateRange(DateTime startDate, DateTime endDate)
    {
        var list = new List<WorkSessionDetail>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT ws.Id, ws.GoalId, ws.SessionDate, ws.StartTime, ws.EndTime, ws.DurationSeconds,
                   g.Title, g.Type
            FROM WorkSessions ws
            INNER JOIN Goals g ON g.Id = ws.GoalId
            WHERE ws.SessionDate >= @start AND ws.SessionDate <= @end
            ORDER BY ws.SessionDate ASC, ws.StartTime ASC, ws.Id ASC;
            """;
        cmd.Parameters.AddWithValue("@start", startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@end", endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new WorkSessionDetail
            {
                Id = reader.GetInt32(0),
                GoalId = reader.GetInt32(1),
                SessionDate = reader.GetString(2),
                StartTime = reader.GetString(3),
                EndTime = reader.GetString(4),
                DurationSeconds = reader.GetInt32(5),
                GoalTitle = reader.GetString(6),
                GoalType = reader.GetString(7)
            });
        }

        return list;
    }

    public List<WorkSessionDetail> GetAllSessionDetails()
    {
        var list = new List<WorkSessionDetail>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT ws.Id, ws.GoalId, ws.SessionDate, ws.StartTime, ws.EndTime, ws.DurationSeconds,
                   g.Title, g.Type
            FROM WorkSessions ws
            INNER JOIN Goals g ON g.Id = ws.GoalId
            ORDER BY ws.SessionDate ASC, ws.StartTime ASC, ws.Id ASC;
            """;

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new WorkSessionDetail
            {
                Id = reader.GetInt32(0),
                GoalId = reader.GetInt32(1),
                SessionDate = reader.GetString(2),
                StartTime = reader.GetString(3),
                EndTime = reader.GetString(4),
                DurationSeconds = reader.GetInt32(5),
                GoalTitle = reader.GetString(6),
                GoalType = reader.GetString(7)
            });
        }

        return list;
    }

    public List<Goal> GetAllGoalsIncludingArchived()
    {
        var list = new List<Goal>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT Id, Title, Type, WeeklyMinMinutes, CreatedAt, IsArchived, IsCompleted, CompletedAt
            FROM Goals
            ORDER BY Id ASC;
            """;

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(ReadGoal(reader));
        }

        return list;
    }

    #endregion

    #region DayOffs

    public DayOff? GetDayOff(DateTime date)
    {
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT Date, Reason, CreatedAt FROM DayOffs WHERE Date = @date;";
        cmd.Parameters.AddWithValue("@date", date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        using var reader = cmd.ExecuteReader();
        if (reader.Read())
        {
            return new DayOff
            {
                Date = reader.GetString(0),
                Reason = reader.GetString(1),
                CreatedAt = reader.GetString(2)
            };
        }

        return null;
    }

    public Dictionary<string, DayOff> GetDayOffsByRange(DateTime startDate, DateTime endDate)
    {
        var result = new Dictionary<string, DayOff>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            SELECT Date, Reason, CreatedAt
            FROM DayOffs
            WHERE Date >= @start AND Date <= @end
            ORDER BY Date ASC;
            """;
        cmd.Parameters.AddWithValue("@start", startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@end", endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var d = new DayOff
            {
                Date = reader.GetString(0),
                Reason = reader.GetString(1),
                CreatedAt = reader.GetString(2)
            };
            result[d.Date] = d;
        }

        return result;
    }

    public HashSet<string> GetAllDayOffDates()
    {
        var set = new HashSet<string>();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT Date FROM DayOffs;";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            set.Add(reader.GetString(0));
        }

        return set;
    }

    public void SetDayOff(DateTime date, string reason)
    {
        var trimmedReason = string.IsNullOrWhiteSpace(reason) ? "İzinli" : reason.Trim();
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            INSERT INTO DayOffs (Date, Reason, CreatedAt)
            VALUES (@date, @reason, @createdAt)
            ON CONFLICT(Date) DO UPDATE SET Reason = excluded.Reason;
            """;
        cmd.Parameters.AddWithValue("@date", date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("@reason", trimmedReason);
        cmd.Parameters.AddWithValue("@createdAt", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture));
        cmd.ExecuteNonQuery();
    }

    public void RemoveDayOff(DateTime date)
    {
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "DELETE FROM DayOffs WHERE Date = @date;";
        cmd.Parameters.AddWithValue("@date", date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        cmd.ExecuteNonQuery();
    }

    #endregion

    #region AppSettings

    public string GetSetting(string key, string defaultValue)
    {
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT Value FROM AppSettings WHERE Key = @key;";
        cmd.Parameters.AddWithValue("@key", key);
        var val = cmd.ExecuteScalar();
        return val is string s && !string.IsNullOrWhiteSpace(s) ? s : defaultValue;
    }

    public void SetSetting(string key, string value)
    {
        using var connection = CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            INSERT INTO AppSettings (Key, Value)
            VALUES (@key, @value)
            ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value;
            """;
        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@value", value);
        cmd.ExecuteNonQuery();
    }

    #endregion

    public string GetDatabaseFileSizeFormatted()
    {
        if (!File.Exists(DatabasePath))
        {
            return "0 KB";
        }

        var bytes = new FileInfo(DatabasePath).Length;
        if (bytes < 1024)
        {
            return $"{bytes} B";
        }

        var kb = bytes / 1024.0;
        if (kb < 1024)
        {
            return $"{kb:0.0} KB";
        }

        var mb = kb / 1024.0;
        return $"{mb:0.00} MB";
    }
}
