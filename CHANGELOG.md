## β Beta

#### 2025-02-03 — 0.3.0

- Added feature to add `TestServiceProvider` support to projects. This provides the target project's dependency injection (DI) functionality in unit tests. If your target project has an `IServiceCollection` extension method (which is a common practice), you'd use the `ConfigureServices` property of the `TestServiceProviderConfiguration` class which is passed to the constructor of `TestServiceProvider` to add the target project's DI functionality in unit tests. See the `TestServiceProviderExample.cs` file after adding this support. This can be enabled to always be add to test projects when generating unit tests. Disabled by default. Though a stand-alone command exists to add this support to a project.
    - Stand-alone Command: "Add TestServiceProvider Support To Project..." (`kokoabim.ddt.add-testserviceprovider-support`)
    - Settings: `ddt.addTestServiceProviderSupport` and `ddt.packagesForTestServiceProviderSupport`

#### 2025-01-27 — 0.2.4

-   Added `methodNamesToIgnore` setting to specify method names to ignore when generating unit tests. For example, `Dispose`, `ToString`, etc. This settings has default values.
-   Fixed improperly attempting to generate unit test for the destructor/finalizer method.

#### 2025-01-19 — 0.2.3

-   Extension following common UI conventions. Vague, I know. Basically wording and location of context menu items.

#### 2025-01-19 — 0.2.2

-   Fixed issues relating to namespaces and usings.
-   Fixed a few minor issues testing with different coding styles to provide better support.

#### 2025-01-18 — 0.2.1

-   Fixed issue with primary constructors.

#### 2025-01-18 — 0.2.0

-   Reintroducing extension. I pulled it because the VSCode API broke it and I didn't have time to address it.
-   Fixed issue with VSCode API which broke the extension.
-   Fixed a lot of minor issues.
-   Note, there are known styles of codeblocks that this extension may not generate unit tests for, which I hope to address. So for they seem to be edge cases.

#### 2023-09-09 — 0.1.0

-   A _lot_ of changes. Basically a rewrite.

## ⍺ Alpha

#### 2023-07-26 — 0.0.1

-   Something functional.
