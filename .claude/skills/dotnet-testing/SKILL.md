---
name: dotnet-testing
description: Testing patterns and best practices for .NET projects. Covers unit testing with xUnit, integration testing with Testcontainers, mocking with Moq, and TDD workflows. Use when writing tests, setting up test infrastructure, or implementing TDD.
---

# .NET Testing Skill

This skill provides comprehensive testing patterns and best practices for .NET projects using xUnit, FluentAssertions, Moq, and Testcontainers.

## Testing Philosophy

> Write tests that give you confidence to deploy on Friday afternoon.

**Test Pyramid:**
```
        /\
       /  \
      / E2E \      <- Few (5%)
     /--------\
    /Integration\   <- Some (15%)
   /--------------\
  /   Unit Tests   \ <- Many (80%)
 /------------------\
```

---

## Test Project Setup

### Required Packages

```xml
<ItemGroup>
    <!-- Core Testing -->
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
    <PackageReference Include="xunit" Version="2.*" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.*" />
    <PackageReference Include="coverlet.collector" Version="6.*" />
    
    <!-- Assertions -->
    <PackageReference Include="FluentAssertions" Version="7.*" />
    
    <!-- Mocking -->
    <PackageReference Include="Moq" Version="4.*" />
    
    <!-- Integration Testing -->
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="9.*" />
    <PackageReference Include="Testcontainers" Version="4.*" />
    <PackageReference Include="Testcontainers.PostgreSql" Version="4.*" />
    <PackageReference Include="Testcontainers.Redis" Version="4.*" />
    
    <!-- Snapshot Testing (optional) -->
    <PackageReference Include="Verify.Xunit" Version="26.*" />
</ItemGroup>
```

### Project Structure

```
tests/
├── Domain.Tests/
│   └── Entities/
│       └── OrderTests.cs
├── Application.Tests/
│   ├── Commands/
│   │   └── CreateOrderCommandHandlerTests.cs
│   └── Queries/
│       └── GetOrderQueryHandlerTests.cs
└── Integration.Tests/
    ├── Fixtures/
    │   └── DatabaseFixture.cs
    ├── Api/
    │   └── OrderEndpointsTests.cs
    └── GlobalUsings.cs
```

---

## Unit Testing

### Test Naming Convention

```
MethodName_Scenario_ExpectedResult
```

Examples:
- `GetOrder_WhenOrderExists_ReturnsOrder`
- `CreateOrder_WithInvalidCustomerId_ThrowsValidationException`
- `CalculateTotal_WithDiscountApplied_ReturnsDiscountedAmount`

### Arrange-Act-Assert Pattern

```csharp
public sealed class OrderServiceTests
{
    private readonly Mock<IOrderRepository> _repositoryMock = new();
    private readonly Mock<ILogger<OrderService>> _loggerMock = new();
    private readonly OrderService _sut;

    public OrderServiceTests()
    {
        _sut = new OrderService(
            _repositoryMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task GetOrderAsync_WhenOrderExists_ReturnsOrder()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        var expectedOrder = new Order 
        { 
            Id = orderId, 
            Status = OrderStatus.Pending 
        };
        
        _repositoryMock
            .Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedOrder);

        // Act
        var result = await _sut.GetOrderAsync(orderId);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(orderId);
        result.Status.Should().Be(OrderStatus.Pending);
    }

    [Fact]
    public async Task GetOrderAsync_WhenOrderNotFound_ReturnsNull()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        _repositoryMock
            .Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Order?)null);

        // Act
        var result = await _sut.GetOrderAsync(orderId);

        // Assert
        result.Should().BeNull();
    }
}
```

### Testing Domain Entities

```csharp
public sealed class OrderTests
{
    [Fact]
    public void Create_WithValidData_CreatesOrder()
    {
        // Arrange
        var customerId = Guid.NewGuid();
        var items = new List<OrderItem>
        {
            new("SKU-001", 2, 10.00m)
        };

        // Act
        var order = Order.Create(customerId, items);

        // Assert
        order.Should().NotBeNull();
        order.Id.Should().NotBeEmpty();
        order.CustomerId.Should().Be(customerId);
        order.Items.Should().HaveCount(1);
        order.Total.Should().Be(20.00m);
        order.Status.Should().Be(OrderStatus.Pending);
        order.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<OrderCreatedEvent>();
    }

    [Fact]
    public void Create_WithEmptyItems_ThrowsArgumentException()
    {
        // Arrange
        var customerId = Guid.NewGuid();
        var items = new List<OrderItem>();

        // Act
        var act = () => Order.Create(customerId, items);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*at least one item*");
    }

    [Theory]
    [InlineData(1, 10.00, 10.00)]
    [InlineData(2, 10.00, 20.00)]
    [InlineData(5, 3.50, 17.50)]
    public void CalculateTotal_WithVariousQuantities_ReturnsCorrectTotal(
        int quantity, 
        decimal price, 
        decimal expectedTotal)
    {
        // Arrange
        var items = new List<OrderItem>
        {
            new("SKU-001", quantity, price)
        };
        var order = Order.Create(Guid.NewGuid(), items);

        // Act
        var total = order.Total;

        // Assert
        total.Should().Be(expectedTotal);
    }
}
```

### Testing Value Objects

```csharp
public sealed class MoneyTests
{
    [Fact]
    public void Create_WithValidAmount_CreatesMoney()
    {
        // Arrange & Act
        var money = Money.Create(100.00m, "USD");

        // Assert
        money.Amount.Should().Be(100.00m);
        money.Currency.Should().Be("USD");
    }

    [Fact]
    public void Create_WithNegativeAmount_ThrowsArgumentException()
    {
        // Act
        var act = () => Money.Create(-10.00m, "USD");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*cannot be negative*");
    }

    [Fact]
    public void Add_WithSameCurrency_ReturnsSum()
    {
        // Arrange
        var money1 = Money.Create(100.00m, "USD");
        var money2 = Money.Create(50.00m, "USD");

        // Act
        var result = money1.Add(money2);

        // Assert
        result.Amount.Should().Be(150.00m);
        result.Currency.Should().Be("USD");
    }

    [Fact]
    public void Equals_WithSameValues_ReturnsTrue()
    {
        // Arrange
        var money1 = Money.Create(100.00m, "USD");
        var money2 = Money.Create(100.00m, "USD");

        // Act & Assert
        money1.Should().Be(money2);
        (money1 == money2).Should().BeTrue();
    }
}
```

---

## Mocking Patterns

### Basic Mocking with Moq

```csharp
// Setup returns
_repositoryMock
    .Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Order());

// Setup with specific argument
_repositoryMock
    .Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
    .ReturnsAsync(expectedOrder);

// Setup throws
_repositoryMock
    .Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
    .ThrowsAsync(new InvalidOperationException("Database error"));

// Verify calls
_repositoryMock.Verify(
    r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()),
    Times.Once);

_repositoryMock.Verify(
    r => r.DeleteAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()),
    Times.Never);
```

### Mock Factory Pattern

```csharp
public static class MockFactory
{
    public static Order CreateOrder(
        Guid? id = null,
        Guid? customerId = null,
        OrderStatus? status = null)
    {
        return new Order
        {
            Id = id ?? Guid.NewGuid(),
            CustomerId = customerId ?? Guid.NewGuid(),
            Status = status ?? OrderStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }

    public static List<Order> CreateOrders(int count)
    {
        return Enumerable.Range(1, count)
            .Select(_ => CreateOrder())
            .ToList();
    }
}

// Usage
[Fact]
public async Task GetOrders_ReturnsAllOrders()
{
    // Arrange
    var orders = MockFactory.CreateOrders(5);
    _repositoryMock
        .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
        .ReturnsAsync(orders);

    // Act
    var result = await _sut.GetOrdersAsync();

    // Assert
    result.Should().HaveCount(5);
}
```

---

## Integration Testing

### WebApplicationFactory Setup

```csharp
public sealed class ApiFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    private readonly RedisContainer _redis = new RedisBuilder()
        .WithImage("redis:7-alpine")
        .Build();

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public HttpClient Client { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await _redis.StartAsync();

        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Replace database
                    services.RemoveAll<DbContextOptions<AppDbContext>>();
                    services.AddDbContext<AppDbContext>(options =>
                        options.UseNpgsql(_postgres.GetConnectionString()));

                    // Replace Redis
                    services.RemoveAll<IConnectionMultiplexer>();
                    services.AddSingleton<IConnectionMultiplexer>(
                        ConnectionMultiplexer.Connect(_redis.GetConnectionString()));
                });

                builder.ConfigureTestServices(services =>
                {
                    // Mock external services
                    services.RemoveAll<IPaymentGateway>();
                    services.AddSingleton<IPaymentGateway, FakePaymentGateway>();
                });
            });

        Client = Factory.CreateClient();

        // Apply migrations
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        Client.Dispose();
        await Factory.DisposeAsync();
        await _postgres.DisposeAsync();
        await _redis.DisposeAsync();
    }
}
```

### Integration Test Examples

```csharp
public sealed class OrderEndpointsTests(ApiFixture fixture) 
    : IClassFixture<ApiFixture>
{
    private readonly HttpClient _client = fixture.Client;

    [Fact]
    public async Task CreateOrder_WithValidData_ReturnsCreated()
    {
        // Arrange
        var command = new CreateOrderRequest(
            Guid.NewGuid(),
            [new OrderItemDto("SKU-001", 2, 10.00m)]);

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        
        var order = await response.Content.ReadFromJsonAsync<OrderDto>();
        order.Should().NotBeNull();
        order!.Id.Should().NotBeEmpty();
        order.Total.Should().Be(20.00m);
    }

    [Fact]
    public async Task CreateOrder_WithEmptyItems_ReturnsBadRequest()
    {
        // Arrange
        var command = new CreateOrderRequest(Guid.NewGuid(), []);

        // Act
        var response = await _client.PostAsJsonAsync("/api/orders", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        
        var problemDetails = await response.Content
            .ReadFromJsonAsync<ValidationProblemDetails>();
        problemDetails!.Errors.Should().ContainKey("Items");
    }

    [Fact]
    public async Task GetOrder_WhenOrderExists_ReturnsOrder()
    {
        // Arrange - Create order first
        var createCommand = new CreateOrderRequest(
            Guid.NewGuid(),
            [new OrderItemDto("SKU-001", 1, 25.00m)]);
        
        var createResponse = await _client.PostAsJsonAsync("/api/orders", createCommand);
        var createdOrder = await createResponse.Content.ReadFromJsonAsync<OrderDto>();

        // Act
        var response = await _client.GetAsync($"/api/orders/{createdOrder!.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var order = await response.Content.ReadFromJsonAsync<OrderDto>();
        order.Should().NotBeNull();
        order!.Id.Should().Be(createdOrder.Id);
    }

    [Fact]
    public async Task GetOrder_WhenOrderNotFound_ReturnsNotFound()
    {
        // Act
        var response = await _client.GetAsync($"/api/orders/{Guid.NewGuid()}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
```

### Shared Context with IClassFixture

```csharp
// Shared fixture for test class
[Collection("Database")]
public sealed class OrderRepositoryTests(DatabaseFixture fixture) 
    : IClassFixture<DatabaseFixture>
{
    private readonly AppDbContext _db = fixture.CreateContext();

    [Fact]
    public async Task AddAsync_PersistsOrder()
    {
        // Arrange
        var repository = new OrderRepository(_db);
        var order = Order.Create(Guid.NewGuid(), [new("SKU-001", 1, 10.00m)]);

        // Act
        await repository.AddAsync(order);
        await _db.SaveChangesAsync();

        // Assert
        var savedOrder = await _db.Orders.FindAsync(order.Id);
        savedOrder.Should().NotBeNull();
    }
}
```

---

## Test Commands

```bash
# Run all tests
dotnet test

# Run with verbose output
dotnet test --verbosity normal

# Run specific test project
dotnet test tests/Application.Tests

# Run specific test class
dotnet test --filter "FullyQualifiedName~OrderServiceTests"

# Run specific test method
dotnet test --filter "DisplayName~WhenOrderExists"

# Run with code coverage
dotnet test --collect:"XPlat Code Coverage"

# Generate coverage report
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator \
    -reports:./tests/**/coverage.cobertura.xml \
    -targetdir:./coverage-report \
    -reporttypes:Html

# Run tests in parallel
dotnet test --parallel
```

---

## Testing Best Practices

### Do's ✅
- Test one thing per test
- Use meaningful test names
- Keep tests independent
- Use test fixtures for shared setup
- Mock external dependencies
- Test edge cases
- Run tests in CI/CD

### Don'ts ❌
- Don't test implementation details
- Don't write tests that depend on order
- Don't share state between tests
- Don't mock everything (test integration points)
- Don't ignore flaky tests
- Don't test private methods directly

---

## Quick Reference

### FluentAssertions Common Methods

```csharp
// Basic
result.Should().Be(expected);
result.Should().NotBe(notExpected);
result.Should().BeNull();
result.Should().NotBeNull();

// Collections
list.Should().HaveCount(5);
list.Should().Contain(item);
list.Should().BeEmpty();
list.Should().ContainSingle();
list.Should().BeInAscendingOrder();

// Strings
str.Should().StartWith("Hello");
str.Should().Contain("world");
str.Should().MatchRegex(@"\d+");

// Exceptions
act.Should().Throw<InvalidOperationException>()
    .WithMessage("*error*");

// Types
obj.Should().BeOfType<Order>();
obj.Should().BeAssignableTo<IEntity>();

// Execution time
action.ExecutionTime().Should().BeLessThan(TimeSpan.FromSeconds(1));
```
