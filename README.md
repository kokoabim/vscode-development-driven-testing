## Features

Generate C#/.NET Xunit test class with test methods. If test-driven development (TDD) wasn't followed initially, try Development-Driven Testing (DDT) to increase code coverage and decrease technical debt.

Currently this VS Code extension only copies to the clipboard. In a future release it will add to existing or create new test files.

## Requirements

Tech debt; missing unit tests. 🤷🏼‍♂️

## Extension Settings

- ddt.indicateTypeNullability
    - Appends `?` to types that can be assigned null.
- ddt.objectTypeForGenericParameters
    - Replace generic symbols (e.g. `T`, etc) with `object`.
- ddt.typesNotToBeIndicatedAsNullable
    - When appending `?` to types, skip these types.

## Known Issues

Most, if not all, of the following you can append "... (for now)". As in, these will be addressed.

- A _lot_ is assumed.
- Copies to clipboard. Does not create, nor write to, files.
- Does not account for public methods on base classes.
- Does not take advantage of interfaces used on classes.
- Not automatically using mocks where applicable.
- If multiple namespaces exist in a file, only the last with a public class is captured to the clipboard.
- Only C#/.NET with Xunit is supported.

## Release Notes

First release.

### 2023-07-26 — 0.0.1
- Initial release of something functional.
