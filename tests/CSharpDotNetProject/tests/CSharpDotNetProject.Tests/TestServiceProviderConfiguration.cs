using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DevelopmentDrivenTesting;

public class TestServiceProviderConfiguration
{
    /// <summary>
    /// An additional configuration provider added to the configuration builder.
    /// </summary>
    public Dictionary<string, string?>? AdditionalConfiguration { get; set; } = new()
    {
        ["Logging:LogLevel:Default"] = "Debug",
        ["Logging:LogLevel:System"] = "Information",
        ["Logging:LogLevel:Microsoft"] = "Information",
        ["Logging:LogLevel:Microsoft.AspNetCore"] = "Warning"
    };

    /// <summary>
    /// The path to an additional appsettings.json file. If SolutionBasePath and RelativePathToTargetProject are set properly, appsettings.json and appsettings.Development.json will be loaded.
    /// </summary>
    public string? AppSettingsFilePath { get; set; }

    /// <summary>
    /// Build the service provider on instantiation. Default is true. Set to false if you want to add services before building the service provider.
    /// </summary>
    public bool BuildServiceProviderOnInstantiation { get; set; } = true;

    /// <summary>
    /// The target project service collection configuration.
    /// </summary>
    public Action<IServiceCollection, IConfiguration>? ConfigureServices { get; set; }

    /// <summary>
    /// By default, debug and console loggers will be added to the service collection (at log-level debug). Set to true to not add these logging services.
    /// </summary>
    public bool DoNotAddLogging { get; set; }

    /// <summary>
    /// The relative path, from SolutionBasePath, to the target project. This is used to load the appsettings files (appsettings.json and appsettings.Development.json). If set to null, the appsettings files will not be loaded.
    /// </summary>
    public string? RelativePathToTargetProject { get; set; }

    /// <summary>
    /// The base path of the solution. Default is "../../../../.." (which should get to "./" from "./tests/TestProjectName.Tests/bin/Debug/frameworkVersion/" at runtime). If set to null, the appsettings files will not be loaded.
    /// </summary>
    public string? SolutionBasePath { get; set; } = TestServiceProvider.DefaultSolutionBasePath;

    public TestServiceProviderConfiguration(string? relativePathToTargetProject = null, string? solutionBasePath = null)
    {
        RelativePathToTargetProject = relativePathToTargetProject;

        if (solutionBasePath is not null) SolutionBasePath = solutionBasePath;
    }
}