namespace CSharpDotNetProject.Tests;

public class Class1Tests
{
    private static readonly TestServiceProviderConfiguration _serviceProviderConfig = new("src/CSharpDotNetProject")
    {
        ConfigureServices = (services, configuration) => services.AddServices(configuration) // Example
        // Another example: ConfigureServices = (services, configuration) => IServiceCollectionExtensions.AddServices(services, configuration)
    };

    [Fact]
    public void Foo()
    {
        // arrange
        var serviceProvider = new TestServiceProvider(_serviceProviderConfig);

        var target = serviceProvider.GetRequiredService<IClass1>();

        // act
        var result = target.Foo("test");

        // assert
        Assert.Equal("Hello from test", result);
    }
}
