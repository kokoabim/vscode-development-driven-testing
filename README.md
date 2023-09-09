## Features

Generate C#/.NET Xunit test classes with test methods for a single C# file or entire C# project.

If test-driven development (TDD) wasn't followed initially, use Development-Driven Testing (DDT) to generate test classes and test methods to increase code coverage and decrease technical debt. Or, use DDT while practicing TDD to generate boilerplate test classes and test methods.

<p style="vertical-align:center;"><img src="media/DDT.gif" alt="GIF"/></p>

## Requirements

- C#/.NET project with Xunit test project.
    - Test projects must have property `IsTestProject` set to `true` to be recognized as a test project.
    - Multiple test projects are supported.
- Tech debt; missing unit tests. 🤷🏼‍♂️

## Extension Settings

- `ddt.defaultNamespace`
    - For C# files with classes without namespaces, namespace to use for generated test classes.
- `ddt.doNothingRegardingNullability`
    - Do nothing regarding nullability. Settings `ddt.indicateTypeNullability` and `ddt.typesNotToBeIndicatedAsNullable` will be ignored. Original nullability on types will be used.
- `ddt.indicateTypeNullability`
    - If `true`, nullability is indicated by appending `?` to types that can be assigned `null`. If `false`, nullability is removed. (This is mostly used to limit IDE warnings after tests are generated and before actual test logic is added.)
- `ddt.objectTypeForGenericParameters`
    - Replace generic parameters (e.g. `T`, `T1`, `TKey`, etc) with `object`.
- `ddt.reservedMethodNames`
    - If a class has a method with one of these names, its test method will include the `new` modifier.
- `ddt.testClassNamePrefixIfFileAlreadyExists`
    - If a test class file already exists, this prefix will be added to the test class name and appended to the file.
- `ddt.typesNotToBeIndicatedAsNullable`
    - If `ddt.indicateTypeNullability` is `true`, these types will not be indicated as nullable.
- `ddt.useOnlyNewOperatorForInstanceInstantiation`
    - Beginning with C# 9.0, constructor invocation expressions are target-typed. That is, if a target type of an expression is known, you can omit a type name. This setting will use only the `new` operator for instance instantiation.
- `ddt.warningsToDisable`
    - Warnings to disable in generated test classes. (This is mostly used to limit IDE warnings.)

## Known Issues/Limitations

Most, if not all, of the following you can append "... (for now)". As in, these will be addressed.

- Does not account for (as in include) public methods on base classes.
- Does not take advantage of interfaces used on classes.
- Uses constructor with most parameters.
- Not using mocks where applicable.

## Release Notes / Changelog

### 2023-09-09 — 0.1.0
- A _lot_ of changes. Basically a rewrite.

### 2023-07-26 — 0.0.1
- Initial release of something functional.
