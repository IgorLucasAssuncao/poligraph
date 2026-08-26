---
name: dotnet-code-review
description: Senior-level C# code review with SOLID principles, performance analysis, security checks, and modern C# suggestions. Use when reviewing C# code, performing code audits, or checking for best practices violations.
---

# .NET Code Review Skill

This skill provides a systematic approach to reviewing C# code with senior-level insights covering correctness, SOLID principles, performance, security, and modern C# practices.

## Review Process

### Step 1: Initial Assessment
1. Understand what the code is supposed to do
2. Identify the overall structure and patterns used
3. Note the project type (API, library, service, etc.)

### Step 2: Systematic Review
Go through the checklist below systematically.

### Step 3: Categorize Findings
- **🔴 Critical**: Security, correctness, major design flaws (must fix)
- **🟡 Important**: SOLID violations, performance, maintainability (should fix)
- **🟢 Suggestions**: Minor improvements, style preferences (nice to have)
- **✅ Positive**: What's done well (acknowledge good practices)

### Step 4: Provide Actionable Feedback
For each issue:
1. Clear explanation of the problem
2. Why it matters
3. Concrete code example showing improvement
4. Reference to relevant patterns or best practices

---

## Review Checklist

### 1. Correctness & Logic

- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled?
- [ ] Is null handling correct?
- [ ] Are async/await patterns used correctly?
- [ ] No `async void` except for event handlers?
- [ ] No blocking on async code (`.Result`, `.Wait()`)?
- [ ] Are cancellation tokens passed through?

**Common Issues:**
```csharp
// ❌ Blocking on async
var result = GetDataAsync().Result;

// ✅ Proper async
var result = await GetDataAsync();

// ❌ async void
public async void ProcessData() { }

// ✅ async Task
public async Task ProcessDataAsync() { }

// ❌ Missing cancellation token
public async Task<Data> GetDataAsync()
{
    return await _db.Data.FirstOrDefaultAsync();
}

// ✅ With cancellation token
public async Task<Data> GetDataAsync(CancellationToken ct = default)
{
    return await _db.Data.FirstOrDefaultAsync(ct);
}
```

---

### 2. SOLID Principles

#### Single Responsibility
- [ ] Does each class have one reason to change?
- [ ] Are methods focused on one task?
- [ ] Is the class doing too much?

**Signs of SRP Violation:**
- Class has many public methods doing different things
- Class name uses "And" or "Manager" or "Service" for multiple concerns
- Class has many dependencies (>5)

```csharp
// ❌ Multiple responsibilities
public class OrderService
{
    public void CreateOrder() { }
    public void SendEmail() { }
    public void GeneratePdf() { }
    public void UpdateInventory() { }
}

// ✅ Single responsibility
public class OrderService
{
    private readonly IEmailService _emailService;
    private readonly IInventoryService _inventoryService;
    
    public void CreateOrder()
    {
        // Only order creation logic
    }
}
```

#### Open/Closed
- [ ] Can behavior be extended without modifying existing code?
- [ ] Are there switch statements on types that could be polymorphism?

```csharp
// ❌ Requires modification for new types
public decimal CalculateDiscount(Customer customer)
{
    return customer.Type switch
    {
        "Gold" => 0.2m,
        "Silver" => 0.1m,
        _ => 0m
    };
}

// ✅ Open for extension
public interface IDiscountStrategy
{
    decimal Calculate(Customer customer);
}

public class GoldDiscount : IDiscountStrategy { }
public class SilverDiscount : IDiscountStrategy { }
```

#### Liskov Substitution
- [ ] Can derived classes be substituted for base classes?
- [ ] Do overridden methods maintain the contract?

#### Interface Segregation
- [ ] Are interfaces focused and specific?
- [ ] Do implementing classes use all interface members?

```csharp
// ❌ Fat interface
public interface IRepository<T>
{
    T GetById(int id);
    IEnumerable<T> GetAll();
    void Add(T entity);
    void Update(T entity);
    void Delete(T entity);
    void BulkInsert(IEnumerable<T> entities);
    T GetWithIncludes(int id, params string[] includes);
    IEnumerable<T> Query(Expression<Func<T, bool>> predicate);
}

// ✅ Segregated interfaces
public interface IReadRepository<T>
{
    T? GetById(int id);
    IEnumerable<T> GetAll();
}

public interface IWriteRepository<T>
{
    void Add(T entity);
    void Update(T entity);
    void Delete(T entity);
}
```

#### Dependency Inversion
- [ ] Do high-level modules depend on abstractions?
- [ ] Are dependencies injected?

```csharp
// ❌ Direct dependency
public class OrderService
{
    private readonly SqlOrderRepository _repository = new();
}

// ✅ Dependency injection
public class OrderService(IOrderRepository repository)
{
    // repository injected
}
```

---

### 3. Code Quality & Maintainability

- [ ] Are names meaningful and intention-revealing?
- [ ] Is there any duplicated code?
- [ ] Are methods small and focused?
- [ ] Is nesting depth reasonable (<3 levels)?
- [ ] Are magic numbers/strings extracted to constants?
- [ ] Is the code self-documenting?

**Naming Patterns:**
```csharp
// ❌ Poor naming
var d = GetData();
var mgr = new Mgr();
public void Process(int x, string s) { }

// ✅ Meaningful names
var customerOrders = GetCustomerOrders();
var orderManager = new OrderManager();
public void ProcessOrder(int orderId, string status) { }
```

**Method Length:**
```csharp
// ❌ Method doing too much (>30 lines)
public void ProcessOrder()
{
    // Validate
    // Calculate totals
    // Apply discounts
    // Check inventory
    // Reserve items
    // Send notification
    // Update database
    // Generate invoice
}

// ✅ Extracted methods
public void ProcessOrder()
{
    ValidateOrder();
    var total = CalculateTotal();
    ApplyDiscounts(total);
    ReserveInventory();
    NotifyCustomer();
    PersistOrder();
}
```

---

### 4. Modern C# Features

- [ ] Using file-scoped namespaces?
- [ ] Using primary constructors where appropriate?
- [ ] Using records for DTOs/value objects?
- [ ] Using pattern matching effectively?
- [ ] Using collection expressions?
- [ ] Using nullable reference types?

```csharp
// ❌ Old style
namespace MyApp.Services
{
    public class OrderService
    {
        private readonly IRepository _repo;
        
        public OrderService(IRepository repo)
        {
            _repo = repo;
        }
    }
}

// ✅ Modern C#
namespace MyApp.Services;

public sealed class OrderService(IRepository repo)
{
    // Primary constructor
}

// ❌ Class for DTO
public class OrderDto
{
    public int Id { get; set; }
    public decimal Total { get; set; }
}

// ✅ Record for DTO
public sealed record OrderDto(int Id, decimal Total);

// ❌ Multiple if statements
if (obj != null)
{
    if (obj.Value > 0)
    {
        if (obj.Status == "Active")
        {
            // Do work
        }
    }
}

// ✅ Pattern matching
if (obj is { Value: > 0, Status: "Active" })
{
    // Do work
}
```

---

### 5. Performance Considerations

- [ ] Any obvious performance issues?
- [ ] Are collections used appropriately?
- [ ] Any N+1 query problems?
- [ ] Unnecessary allocations?
- [ ] Using `AsNoTracking()` for read-only queries?

**Common Performance Issues:**

```csharp
// ❌ N+1 query problem
var orders = await _db.Orders.ToListAsync();
foreach (var order in orders)
{
    var items = await _db.OrderItems
        .Where(i => i.OrderId == order.Id)
        .ToListAsync();  // Query per order!
}

// ✅ Eager loading
var orders = await _db.Orders
    .Include(o => o.Items)
    .ToListAsync();

// ❌ Loading unnecessary data
var allOrders = await _db.Orders.ToListAsync();
var activeCount = allOrders.Count(o => o.IsActive);

// ✅ Filter in database
var activeCount = await _db.Orders
    .CountAsync(o => o.IsActive);

// ❌ String concatenation in loop
var result = "";
foreach (var item in items)
{
    result += item.Name + ", ";
}

// ✅ StringBuilder or LINQ
var result = string.Join(", ", items.Select(i => i.Name));

// ❌ Missing AsNoTracking
var orders = await _db.Orders.ToListAsync();

// ✅ Read-only query
var orders = await _db.Orders.AsNoTracking().ToListAsync();
```

---

### 6. Error Handling & Logging

- [ ] Are exceptions handled appropriately?
- [ ] Is logging present at appropriate levels?
- [ ] Are error messages helpful?
- [ ] Using structured logging?

```csharp
// ❌ Swallowing exceptions
try
{
    await ProcessAsync();
}
catch (Exception)
{
    // Silent failure
}

// ✅ Proper exception handling
try
{
    await ProcessAsync();
}
catch (OrderNotFoundException ex)
{
    _logger.LogWarning("Order {OrderId} not found", ex.OrderId);
    throw;
}

// ❌ String interpolation in logging
_logger.LogInformation($"Processing order {orderId}");

// ✅ Structured logging
_logger.LogInformation("Processing order {OrderId}", orderId);
```

---

### 7. Security

- [ ] Input validation present?
- [ ] SQL injection prevention?
- [ ] Sensitive data not logged?
- [ ] Authentication/authorization checks?

```csharp
// ❌ SQL injection vulnerability
var query = $"SELECT * FROM Orders WHERE Id = {id}";

// ✅ Parameterized query
var order = await _db.Orders.FindAsync(id);

// ❌ Logging sensitive data
_logger.LogInformation("User {User} with password {Password}", user, password);

// ✅ No sensitive data in logs
_logger.LogInformation("User {UserId} authenticated", user.Id);
```

---

### 8. Architecture & Design

- [ ] Proper separation of concerns?
- [ ] Dependencies flow in the right direction?
- [ ] Using appropriate design patterns?
- [ ] Not over-engineering?

---

## Review Output Format

```markdown
## Code Review: [Component/Feature Name]

### Summary
Brief overview of the code quality and main findings.

### 🔴 Critical Issues
1. **[Issue Title]**
   - Location: `FileName.cs:LineNumber`
   - Problem: Description
   - Impact: Why this matters
   - Fix: Code example

### 🟡 Important Issues
1. **[Issue Title]**
   - Description and fix

### 🟢 Suggestions
1. **[Suggestion Title]**
   - Description

### ✅ Positive Aspects
- What's done well
- Good practices observed

### Recommended Next Steps
1. Fix critical issues first
2. Address important issues
3. Consider suggestions
```

---

## Quick Commands

```bash
# Review a specific file
/project:code-review src/Services/OrderService.cs

# Review recent changes
/project:code-review --changes

# Review for security
/project:code-review --focus security
```
