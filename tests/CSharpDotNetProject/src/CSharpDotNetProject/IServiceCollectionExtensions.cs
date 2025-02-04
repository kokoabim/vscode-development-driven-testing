using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CSharpDotNetProject;

public static class IServiceCollectionExtensions
{
    public static IServiceCollection AddServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddLogging();

        services.AddTransient<IClass1, Class1>();

        return services;
    }
}