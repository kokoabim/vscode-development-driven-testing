using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Diagnostics.CodeAnalysis;

namespace CSharpDotNetProject.Tests;

public class TestServiceProvider
{
    public IConfigurationRoot Configuration { get; }
    public static string DefaultSolutionBasePath { get; set; } = Path.GetFullPath("../../../../..");

    [MemberNotNullWhen(true, nameof(_serviceProvider))]
    public bool IsServiceProviderBuilt { get; private set; }

    public IServiceCollection ServiceCollection => !IsServiceProviderBuilt ? _serviceCollection : throw new InvalidOperationException("Service provider already built.");
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

    #region methods

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

    public object GetRequiredService(Type serviceType) => ServiceProvider.GetRequiredService(serviceType);

    public object? GetService(Type serviceType) => ServiceProvider.GetService(serviceType);

    public IEnumerable<T> GetServices<T>() where T : notnull => ServiceProvider.GetServices<T>();

    public IEnumerable<object?> GetServices(Type serviceType) => ServiceProvider.GetServices(serviceType);

    public T GetRequiredService<T>() where T : notnull => ServiceProvider.GetRequiredService<T>();

    public T? GetService<T>() where T : notnull => ServiceProvider.GetService<T>();
    #endregion
}