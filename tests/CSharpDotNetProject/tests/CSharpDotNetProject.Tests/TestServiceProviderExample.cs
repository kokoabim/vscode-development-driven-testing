using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DevelopmentDrivenTesting;

public class TestServiceProviderExample
{
    private static readonly TestServiceProviderConfiguration _serviceProviderConfig = new("src/TargetProjectName") // Example: to load appsettings files
    {
        ConfigureServices = (services, configuration) => services.AddExampleServices(configuration) // Example: to add services
        // Another example to add services: ConfigureServices = (services, configuration) => IServiceCollectionExtensions.AddServices(services, configuration)
    };

    [Fact]
    public void Foo_Bar_ShouldAdd()
    {
        // arrange
        var serviceProvider = new TestServiceProvider(_serviceProviderConfig);
        var target = serviceProvider.GetRequiredService<IFoo>();

        // act
        var result = target.Bar(1, 2);

        // assert
        Assert.Equal(3, result);
    }
}

/// <summary>
/// An interface in the target project.
/// </summary>
public interface IFoo
{
    int Bar(int a, int b);
}

/// <summary>
/// A class in the target project.
/// </summary>
public class Foo : IFoo
{
    public int Bar(int a, int b) => a + b;
}

/// <summary>
/// IServiceCollection extension methods in the target project.
/// </summary>
public static class IServiceCollectionExtensions
{
    public static IServiceCollection AddExampleServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddTransient<IFoo, Foo>();
        return services;
    }
}