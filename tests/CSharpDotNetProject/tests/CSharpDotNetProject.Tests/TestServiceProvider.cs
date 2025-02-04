using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Diagnostics.CodeAnalysis;

namespace DevelopmentDrivenTesting;

/// <summary>
/// A class that provides a way to build a service provider for testing purposes.
/// </summary>
public class TestServiceProvider
{
    /// <summary>
    /// The configuration of the service provider.
    /// </summary>
    public IConfigurationRoot Configuration { get; }

    /// <summary>
    /// The default solution base path. Default is "../../../../.." (which should get to "./" from "./tests/TestProjectName.Tests/bin/Debug/frameworkVersion/" at runtime).
    /// </summary>
    public static string DefaultSolutionBasePath { get; set; } = Path.GetFullPath("../../../../..");

    /// <summary>
    /// Indicates whether the service provider has been built.
    /// </summary>
    [MemberNotNullWhen(true, nameof(_serviceProvider))]
    public bool IsServiceProviderBuilt { get; private set; }

    /// <summary>
    /// The service collection.
    /// </summary>
    public IServiceCollection ServiceCollection => !IsServiceProviderBuilt ? _serviceCollection : throw new InvalidOperationException("Service provider already built.");

    /// <summary>
    /// The service provider.
    /// </summary>
    public IServiceProvider ServiceProvider => _serviceProvider ?? throw new InvalidOperationException("Service provider not built.");

    private readonly TestServiceProviderConfiguration _config;
    private readonly IServiceCollection _serviceCollection = new ServiceCollection();
    private IServiceProvider? _serviceProvider;

    public TestServiceProvider(string relativePathToProjectWithAppSettingsFiles, bool buildOnInstantiation = true, Action<IServiceCollection, IConfiguration>? configureServices = null)
        : this(new TestServiceProviderConfiguration(relativePathToProjectWithAppSettingsFiles) { BuildServiceProviderOnInstantiation = buildOnInstantiation, ConfigureServices = configureServices })
    {
    }

    public TestServiceProvider(TestServiceProviderConfiguration config)
    {
        _config = config;

        var configurationBuilder = new ConfigurationBuilder();

        if (config.SolutionBasePath is not null)
        {
            configurationBuilder
                .AddJsonFile(Path.GetFullPath($"{config.SolutionBasePath}/{config.RelativePathToTargetProject}/appsettings.json"), optional: true, reloadOnChange: true)
                .AddJsonFile(Path.GetFullPath($"{config.SolutionBasePath}/{config.RelativePathToTargetProject}/appsettings.Development.json"), optional: true, reloadOnChange: true);
        }

        if (config.AppSettingsFilePath is not null) configurationBuilder.AddJsonFile(Path.GetFullPath(config.AppSettingsFilePath), optional: true, reloadOnChange: true);

        if (config.AdditionalConfiguration?.Count > 0) configurationBuilder.AddInMemoryCollection(config.AdditionalConfiguration);

        Configuration = configurationBuilder.Build();

        if (!config.DoNotAddLogging)
        {
            _serviceCollection.AddLogging(builder =>
            {
                builder.AddDebug().SetMinimumLevel(LogLevel.Debug);
                builder.AddConsole().SetMinimumLevel(LogLevel.Debug);
            });
        }

        if (config.BuildServiceProviderOnInstantiation) BuildServiceProvider(config.ConfigureServices);
    }

    public TestServiceProvider AddScoped<TService, [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)] TImplementation>()
        where TService : class
        where TImplementation : class, TService
    {
        ServiceCollection.AddScoped<TService, TImplementation>();
        return this;
    }

    public TestServiceProvider AddServices(Action<IServiceCollection, IConfiguration> configureServices)
    {
        configureServices.Invoke(ServiceCollection, Configuration);
        return this;
    }

    public TestServiceProvider AddSingleton<TService, [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)] TImplementation>()
        where TService : class
        where TImplementation : class, TService
    {
        ServiceCollection.AddSingleton<TService, TImplementation>();
        return this;
    }

    public TestServiceProvider AddTransient<TService, [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)] TImplementation>()
        where TService : class
        where TImplementation : class, TService
    {
        ServiceCollection.AddTransient<TService, TImplementation>();
        return this;
    }

    /// <summary>
    /// Builds the service provider. Must be called before using the service provider. By default, the service provider is built on instantiation but can be set to not build on instantiation with constructor parameters to allow adding other services before building the service provider.
    /// </summary>
    public TestServiceProvider BuildServiceProvider(Action<IServiceCollection, IConfiguration>? configureServices = null)
    {
        if (IsServiceProviderBuilt) throw new InvalidOperationException("Service provider already built.");

        configureServices ??= _config.ConfigureServices;
        configureServices?.Invoke(ServiceCollection, Configuration);

        _serviceProvider = ServiceCollection.BuildServiceProvider();
        IsServiceProviderBuilt = true;

        return this;
    }

    public IServiceScope CreateScope() => ServiceProvider.GetRequiredService<IServiceScopeFactory>().CreateScope();

    public T GetRequiredService<T>() where T : notnull => ServiceProvider.GetRequiredService<T>();
    public object GetRequiredService(Type serviceType) => ServiceProvider.GetRequiredService(serviceType);
    public T? GetService<T>() where T : notnull => ServiceProvider.GetService<T>();
    public object? GetService(Type serviceType) => ServiceProvider.GetService(serviceType);
    public IEnumerable<object?> GetServices(Type serviceType) => ServiceProvider.GetServices(serviceType);
    public IEnumerable<T> GetServices<T>() where T : notnull => ServiceProvider.GetServices<T>();
}