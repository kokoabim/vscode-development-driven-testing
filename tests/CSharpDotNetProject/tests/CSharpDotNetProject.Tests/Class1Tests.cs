using CSharpDotNetProject;

namespace DevelopmentDrivenTesting.Tests;

public class Class1Tests
{
    [Fact]
    public void Foo()
    {
        // arrange
        string? expected = default;

        System.String? method_bar = default;

        Class1 target = new Class1();

        // act
        string? actual = target.Foo(method_bar);

        // assert
        Assert.Equal(expected, actual);
    }
}