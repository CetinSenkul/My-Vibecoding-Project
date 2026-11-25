using System.Globalization;
using System.Windows;
using TimePlannerApp.Data;
using TimePlannerApp.Services;

namespace TimePlannerApp;

public partial class App : Application
{
    public static DatabaseService Database { get; private set; } = null!;
    public static StopwatchService Stopwatch { get; private set; } = null!;

    protected override void OnStartup(StartupEventArgs e)
    {
        var trCulture = new CultureInfo("tr-TR");
        CultureInfo.DefaultThreadCurrentCulture = trCulture;
        CultureInfo.DefaultThreadCurrentUICulture = trCulture;

        Database = new DatabaseService();
        Database.Initialize();

        Stopwatch = new StopwatchService();
        ThemeService.LoadSavedTheme();

        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        Stopwatch?.Shutdown();
        base.OnExit(e);
    }
}
