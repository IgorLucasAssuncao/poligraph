---
name: dotnet-architecture
description: Architecture decision guidance for .NET projects. Helps choose between Clean Architecture, CQRS, microservices, and other patterns based on project requirements. Use when designing system architecture, choosing patterns, or structuring new projects.
---

# .NET Architecture Decision Skill

This skill helps make informed architecture decisions for .NET projects based on requirements, team size, and complexity.

## Core Philosophy

> **The mark of a senior architect is knowing when NOT to over-engineer.**
> 
> Simple features need simple structures. Complex systems need complex architecture. Never apply Clean Architecture to a 50-line utility.

---

## Architecture Decision Framework

### Step 1: Assess Requirements

Ask these questions:
1. What is the business domain complexity?
2. What are the scalability requirements?
3. What is the team size and expertise?
4. What is the expected lifetime of the project?
5. Are there specific non-functional requirements (performance, security)?

### Step 2: Choose Architecture Tier

| Complexity | Structure | Use When |
|------------|-----------|----------|
| **Tier 1: Simple** | Single project | Utilities, MCP servers, simple APIs, demos |
| **Tier 2: Medium** | 2-3 projects | Feature-complete apps, RAG systems, real-time apps |
| **Tier 3: Complex** | Full Clean Architecture | Enterprise systems, microservices, DDD |

### Step 3: Select Patterns

Match patterns to problems:

| Problem | Pattern | When to Use |
|---------|---------|-------------|
| Data access abstraction | Repository | Always (unless very simple CRUD) |
| Expected failure handling | Result Pattern | Complex business logic |
| Complex queries | Specification | Many query variations |
| Separate read/write needs | CQRS | Different read/write models |
| Audit trail needed | Event Sourcing | Financial, compliance systems |
| Multiple bounded contexts | Microservices | Large teams, independent deployment |

---

## Architecture Patterns

### Tier 1: Simple Structure

**Use for**: MCP servers, utilities, single-feature demos, CLI tools

```
ProjectName/
├── README.md
├── src/
│   └── ProjectName/
│       ├── Program.cs
│       ├── Services/
│       ├── Models/
│       └── appsettings.json
├── tests/
│   └── ProjectName.Tests/
├── Dockerfile
└── .github/workflows/ci.yml
```

**Characteristics**:
- Single project, no layers
- Direct service classes
- Simple DI registration
- Inline configuration
- Basic error handling

**Example**: MCP Server
```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped<IDatabaseService, DatabaseService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.MapToolEndpoints();
app.Run();

// Services/DatabaseService.cs
public sealed class DatabaseService(IDbConnection db) : IDatabaseService
{
    public async Task<IEnumerable<dynamic>> QueryAsync(string sql)
        => await db.QueryAsync(sql);
}
```

---

### Tier 2: Medium Structure

**Use for**: Feature-complete applications, bounded contexts, vertical slices

```
ProjectName/
├── README.md
├── src/
│   ├── ProjectName.Api/           # Endpoints + DI setup
│   ├── ProjectName.Core/          # Business logic + Interfaces
│   └── ProjectName.Infrastructure/ # Data access + External services
├── tests/
│   ├── ProjectName.Core.Tests/
│   └── ProjectName.Integration.Tests/
├── docker-compose.yml
└── .github/workflows/ci.yml
```

**Dependency Flow**:
```
Api → Core ← Infrastructure
         ↑
    (depends on)
```

**Characteristics**:
- 2-3 projects with clear responsibilities
- Repository pattern
- MediatR for command/query separation (optional)
- Proper configuration management
- Integration tests with Testcontainers

**Example Structure**:
```csharp
// Core/Interfaces/IOrderRepository.cs
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid id, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}

// Core/Services/OrderService.cs
public sealed class OrderService(IOrderRepository repository)
{
    public async Task<Order?> GetOrderAsync(Guid id, CancellationToken ct)
        => await repository.GetByIdAsync(id, ct);
}

// Infrastructure/Repositories/OrderRepository.cs
public sealed class OrderRepository(AppDbContext db) : IOrderRepository
{
    public async Task<Order?> GetByIdAsync(Guid id, CancellationToken ct)
        => await db.Orders.FindAsync([id], ct);
}

// Api/Endpoints/OrderEndpoints.cs
public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/orders/{id}", GetOrder);
    }
}
```

---

### Tier 3: Complex Structure (Clean Architecture)

**Use for**: Enterprise systems, microservices, DDD implementations

```
ProjectName/
├── README.md
├── docs/
│   ├── architecture.md
│   └── adr/
├── src/
│   ├── Domain/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   └── Interfaces/
│   ├── Application/
│   │   ├── Commands/
│   │   ├── Queries/
│   │   ├── DTOs/
│   │   └── Validators/
│   ├── Infrastructure/
│   │   ├── Persistence/
│   │   ├── Messaging/
│   │   └── ExternalServices/
│   └── WebApi/
│       ├── Endpoints/
│       └── Middleware/
├── tests/
│   ├── Domain.Tests/
│   ├── Application.Tests/
│   └── Integration.Tests/
├── docker-compose.yml
└── .github/workflows/ci.yml
```

**Dependency Flow**:
```
     WebApi
        ↓
   Application
        ↓
     Domain (no dependencies)
        ↑
  Infrastructure (implements Domain interfaces)
```

**Key Principles**:
1. **Domain** has zero external dependencies
2. **Application** depends only on Domain
3. **Infrastructure** implements Domain interfaces
4. **WebApi** orchestrates everything

---

## Pattern Implementations

### Repository Pattern

```csharp
// Domain/Interfaces/IRepository.cs
public interface IRepository<T> where T : Entity
{
    Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(T entity, CancellationToken ct = default);
    Task UpdateAsync(T entity, CancellationToken ct = default);
    Task DeleteAsync(T entity, CancellationToken ct = default);
}

// Domain/Interfaces/IOrderRepository.cs
public interface IOrderRepository : IRepository<Order>
{
    Task<IReadOnlyList<Order>> GetByCustomerIdAsync(
        Guid customerId, 
        CancellationToken ct = default);
}
```

### Result Pattern

```csharp
// Domain/Common/Result.cs
public sealed class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public Error? Error { get; }
    
    private Result(bool isSuccess, T? value, Error? error)
        => (IsSuccess, Value, Error) = (isSuccess, value, error);
    
    public static Result<T> Success(T value) => new(true, value, null);
    public static Result<T> Failure(Error error) => new(false, default, error);
    
    public TResult Match<TResult>(
        Func<T, TResult> onSuccess,
        Func<Error, TResult> onFailure)
        => IsSuccess ? onSuccess(Value!) : onFailure(Error!);
}

public sealed record Error(string Code, string Message)
{
    public static Error NotFound(string entity, Guid id) 
        => new("NotFound", $"{entity} with ID {id} was not found");
    
    public static Error Validation(string message)
        => new("Validation", message);
}
```

### CQRS with MediatR

```csharp
// Application/Commands/CreateOrderCommand.cs
public sealed record CreateOrderCommand(
    Guid CustomerId,
    List<OrderItemDto> Items) : IRequest<Result<OrderDto>>;

public sealed class CreateOrderCommandValidator 
    : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty();
    }
}

public sealed class CreateOrderCommandHandler(
    IOrderRepository repository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CreateOrderCommand, Result<OrderDto>>
{
    public async Task<Result<OrderDto>> Handle(
        CreateOrderCommand request,
        CancellationToken ct)
    {
        var order = Order.Create(request.CustomerId, request.Items);
        
        await repository.AddAsync(order, ct);
        await unitOfWork.SaveChangesAsync(ct);
        
        return Result<OrderDto>.Success(order.ToDto());
    }
}

// Application/Queries/GetOrderQuery.cs
public sealed record GetOrderQuery(Guid OrderId) : IRequest<OrderDto?>;

public sealed class GetOrderQueryHandler(IAppDbContext db)
    : IRequestHandler<GetOrderQuery, OrderDto?>
{
    public async Task<OrderDto?> Handle(
        GetOrderQuery request,
        CancellationToken ct)
    {
        return await db.Orders
            .AsNoTracking()
            .Where(o => o.Id == request.OrderId)
            .Select(o => new OrderDto(o.Id, o.Total, o.Status))
            .FirstOrDefaultAsync(ct);
    }
}
```

### Domain Events

```csharp
// Domain/Events/IDomainEvent.cs
public interface IDomainEvent
{
    DateTime OccurredAt { get; }
}

// Domain/Events/OrderCreatedEvent.cs
public sealed record OrderCreatedEvent(
    Guid OrderId,
    Guid CustomerId,
    decimal Total) : IDomainEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}

// Domain/Common/Entity.cs
public abstract class Entity
{
    private readonly List<IDomainEvent> _domainEvents = [];
    
    public IReadOnlyCollection<IDomainEvent> DomainEvents 
        => _domainEvents.AsReadOnly();
    
    protected void RaiseDomainEvent(IDomainEvent domainEvent)
        => _domainEvents.Add(domainEvent);
    
    public void ClearDomainEvents() => _domainEvents.Clear();
}

// Domain/Entities/Order.cs
public sealed class Order : Entity
{
    public static Order Create(Guid customerId, List<OrderItem> items)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            Items = items,
            CreatedAt = DateTime.UtcNow
        };
        
        order.RaiseDomainEvent(new OrderCreatedEvent(
            order.Id, 
            order.CustomerId, 
            order.Total));
        
        return order;
    }
}
```

---

## Decision Matrix

| Factor | Tier 1 (Simple) | Tier 2 (Medium) | Tier 3 (Complex) |
|--------|-----------------|-----------------|------------------|
| Business logic | Minimal | Moderate | Complex |
| Database needs | None/SQLite | Single DB | Multiple DBs |
| External integrations | 1-2 | 3-5 | Many |
| Team size | 1 | 2-4 | 5+ |
| Lines of code | <1,000 | 1,000-10,000 | 10,000+ |
| Time to build | 1-2 days | 3-5 days | 5+ days |
| Maintenance expected | Minimal | Moderate | Long-term |

---

## Anti-Patterns to Avoid

### Over-Engineering
```csharp
// ❌ Factory for simple object
public interface IOrderFactory
{
    Order Create(CreateOrderRequest request);
}

public class OrderFactory : IOrderFactory
{
    public Order Create(CreateOrderRequest request)
        => new Order { /* simple mapping */ };
}

// ✅ Direct creation for simple cases
var order = new Order
{
    Id = Guid.NewGuid(),
    CustomerId = request.CustomerId
};
```

### Premature Abstraction
```csharp
// ❌ Interface for one implementation
public interface IOrderHelper { }
public class OrderHelper : IOrderHelper { }

// ✅ Make it concrete until you need abstraction
public class OrderHelper { }
```

### Wrong Pattern for the Job
```csharp
// ❌ CQRS for simple CRUD
public record GetUserByIdQuery(int Id) : IRequest<User>;
public class GetUserByIdQueryHandler : IRequestHandler<...> { }

// ✅ Direct repository for simple CRUD
var user = await _userRepository.GetByIdAsync(id);
```

---

## Quick Reference

### When to Use Each Pattern

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| Repository | Need to abstract data access | Simple scripts, utilities |
| Result | Expected failures in business logic | Infrastructure code |
| CQRS | Different read/write models | Simple CRUD |
| Event Sourcing | Audit trail required | Simple state storage |
| Domain Events | Cross-aggregate communication | Within same aggregate |
| Specification | Complex, reusable queries | Simple queries |

### NuGet Packages by Tier

**Tier 1:**
- Dapper, Serilog, Swashbuckle

**Tier 2 (add):**
- MediatR, FluentValidation, EF Core, Testcontainers

**Tier 3 (add):**
- MassTransit, Marten, OpenTelemetry
