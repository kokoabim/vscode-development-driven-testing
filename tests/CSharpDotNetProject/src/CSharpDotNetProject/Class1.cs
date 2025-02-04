namespace CSharpDotNetProject;

public interface IClass1
{
    string Foo(string bar);
}

public class Class1 : IClass1
{
    public string Foo(string bar)
    {
        return $"Hello from {bar}";
    }
}