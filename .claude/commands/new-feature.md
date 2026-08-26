# New Feature Command

Create a new feature with command/query handlers, validators, endpoint, and tests.

## Usage

```
/new-feature <FeatureName> [--type command|query|both]
```

## Instructions

When the user invokes this command, create the following files for the feature:

### For Commands (Create, Update, Delete operations)

1. **Command** - `src/Application/Commands/<Feature>/<Feature>Command.cs`
```csharp
namespace Application.Commands.<Feature>;

public sealed record <Feature>Command(
    // Add relevant properties
) : IRequest<Result<<Feature>Response>>;

public sealed record <Feature>Response(Guid Id);
```

2. **Validator** - `src/Application/Commands/<Feature>/<Feature>CommandValidator.cs`
```csharp
namespace Application.Commands.<Feature>;

public sealed class <Feature>CommandValidator : AbstractValidator<<Feature>Command>
{
    public <Feature>CommandValidator()
    {
        // Add validation rules
    }
}
```

3. **Handler** - `src/Application/Commands/<Feature>/<Feature>CommandHandler.cs`
```csharp
namespace Application.Commands.<Feature>;

public sealed class <Feature>CommandHandler(
    // Add dependencies
) : IRequestHandler<<Feature>Command, Result<<Feature>Response>>
{
    public async Task<Result<<Feature>Response>> Handle(
        <Feature>Command request,
        CancellationToken ct)
    {
        // Implement handler logic
    }
}
```

### For Queries (Read operations)

1. **Query** - `src/Application/Queries/<Feature>/<Feature>Query.cs`
```csharp
namespace Application.Queries.<Feature>;

public sealed record <Feature>Query(
    // Add relevant properties
) : IRequest<<Feature>Response?>;

public sealed record <Feature>Response(
    // Add response properties
);
```

2. **Handler** - `src/Application/Queries/<Feature>/<Feature>QueryHandler.cs`
```csharp
namespace Application.Queries.<Feature>;

public sealed class <Feature>QueryHandler(
    IAppDbContext db
) : IRequestHandler<<Feature>Query, <Feature>Response?>
{
    public async Task<<Feature>Response?> Handle(
        <Feature>Query request,
        CancellationToken ct)
    {
        // Implement query logic with projection
    }
}
```

### Endpoint

Create `src/WebApi/Endpoints/<Feature>Endpoints.cs`:
```csharp
namespace WebApi.Endpoints;

public static class <Feature>Endpoints
{
    public static void Map<Feature>Endpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/<feature>")
            .WithTags("<Feature>")
            .WithOpenApi();

        // Add endpoint mappings
    }
}
```

### Tests

1. **Unit Tests** - `tests/Application.Tests/Commands/<Feature>/<Feature>CommandHandlerTests.cs`
```csharp
namespace Application.Tests.Commands.<Feature>;

public sealed class <Feature>CommandHandlerTests
{
    [Fact]
    public async Task Handle_WithValidRequest_Succeeds()
    {
        // Arrange
        // Act
        // Assert
    }
}
```

2. **Integration Tests** - `tests/Integration.Tests/<Feature>EndpointsTests.cs`
```csharp
namespace Integration.Tests;

public sealed class <Feature>EndpointsTests(ApiFixture fixture) 
    : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task <Feature>_WithValidData_Succeeds()
    {
        // Arrange
        // Act
        // Assert
    }
}
```

## Example

```
/new-feature CreateOrder --type command
```

Creates:
- `src/Application/Commands/CreateOrder/CreateOrderCommand.cs`
- `src/Application/Commands/CreateOrder/CreateOrderCommandValidator.cs`
- `src/Application/Commands/CreateOrder/CreateOrderCommandHandler.cs`
- `src/WebApi/Endpoints/OrderEndpoints.cs`
- `tests/Application.Tests/Commands/CreateOrder/CreateOrderCommandHandlerTests.cs`
- `tests/Integration.Tests/OrderEndpointsTests.cs`
