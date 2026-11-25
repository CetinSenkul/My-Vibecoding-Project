using System.Windows.Threading;
using TimePlannerApp.Models;

namespace TimePlannerApp.Services;

public enum StopwatchState
{
    Idle,
    Running,
    Paused
}

public class StopwatchService
{
    private readonly DispatcherTimer _timer;
    private TimeSpan _accumulated = TimeSpan.Zero;
    private DateTime? _segmentStart;

    public StopwatchState State { get; private set; } = StopwatchState.Idle;
    public Goal? ActiveGoal { get; private set; }
    public DateTime? SessionStartLocal { get; private set; }

    public TimeSpan Elapsed => State == StopwatchState.Running && _segmentStart.HasValue
        ? _accumulated + (DateTime.Now - _segmentStart.Value)
        : _accumulated;

    public event Action? Tick;
    public event Action? StateChanged;
    public event Action<int>? SessionSaved;

    public StopwatchService()
    {
        _timer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(200)
        };
        _timer.Tick += (_, _) => Tick?.Invoke();
    }

    public bool StartOrResume(Goal? goal)
    {
        if (State == StopwatchState.Running)
        {
            return true;
        }

        if (State == StopwatchState.Idle)
        {
            if (goal == null)
            {
                return false;
            }

            ActiveGoal = goal;
            _accumulated = TimeSpan.Zero;
            SessionStartLocal = DateTime.Now;
            _segmentStart = SessionStartLocal;
            State = StopwatchState.Running;
            _timer.Start();
            StateChanged?.Invoke();
            Tick?.Invoke();
            return true;
        }

        // Paused -> Resume
        _segmentStart = DateTime.Now;
        State = StopwatchState.Running;
        _timer.Start();
        StateChanged?.Invoke();
        Tick?.Invoke();
        return true;
    }

    public void Pause()
    {
        if (State != StopwatchState.Running)
        {
            return;
        }

        if (_segmentStart.HasValue)
        {
            _accumulated += DateTime.Now - _segmentStart.Value;
            _segmentStart = null;
        }

        _timer.Stop();
        State = StopwatchState.Paused;
        StateChanged?.Invoke();
        Tick?.Invoke();
    }

    /// <summary>
    /// Geçen süreyi WorkSessions tablosuna kaydeder ve kronometreyi sıfırlar.
    /// </summary>
    public bool StopAndSave(out int savedDurationSeconds)
    {
        savedDurationSeconds = 0;

        if (State == StopwatchState.Idle || ActiveGoal == null || !SessionStartLocal.HasValue)
        {
            return false;
        }

        var now = DateTime.Now;
        if (State == StopwatchState.Running && _segmentStart.HasValue)
        {
            _accumulated += now - _segmentStart.Value;
            _segmentStart = null;
        }

        _timer.Stop();

        var totalSeconds = (int)Math.Floor(_accumulated.TotalSeconds);
        if (totalSeconds < 1)
        {
            // En az 1 saniye geçmeden kaydetme
            State = StopwatchState.Paused;
            StateChanged?.Invoke();
            Tick?.Invoke();
            return false;
        }

        var goalId = ActiveGoal.Id;
        var startLocal = SessionStartLocal.Value;

        App.Database.AddWorkSession(goalId, startLocal, now, totalSeconds);
        savedDurationSeconds = totalSeconds;

        ResetInternal();
        SessionSaved?.Invoke(goalId);
        return true;
    }

    public void Reset()
    {
        ResetInternal();
    }

    public void Shutdown()
    {
        _timer.Stop();
    }

    private void ResetInternal()
    {
        _timer.Stop();
        _accumulated = TimeSpan.Zero;
        _segmentStart = null;
        SessionStartLocal = null;
        ActiveGoal = null;
        State = StopwatchState.Idle;
        StateChanged?.Invoke();
        Tick?.Invoke();
    }
}
