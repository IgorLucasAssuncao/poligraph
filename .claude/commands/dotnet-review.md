# Code Review Command

Perform a comprehensive code review of C# files following senior-level best practices.

## Usage

```
/dotnet-review <file_or_folder_path>
```

## Instructions

When the user invokes this command:

1. **Read the code** - Analyze the specified file(s)

2. **Apply the code review skill** - Use the `dotnet-code-review` skill checklist

3. **Categorize findings**:
   - 🔴 **Critical**: Must fix (security, correctness, major design flaws)
   - 🟡 **Important**: Should fix (SOLID violations, performance, maintainability)
   - 🟢 **Suggestions**: Nice to have (minor improvements, style)
   - ✅ **Positive**: What's done well

4. **Generate report** in this format:

```markdown
## Code Review: [File/Component Name]

### Summary
Brief overview of code quality and main findings.

### 🔴 Critical Issues
1. **[Issue Title]**
   - Location: `FileName.cs:LineNumber`
   - Problem: Description
   - Impact: Why this matters
   - Fix:
   ```csharp
   // Suggested fix
   ```

### 🟡 Important Issues
1. **[Issue Title]**
   - Description and suggested fix

### 🟢 Suggestions
1. Brief suggestion

### ✅ Positive Aspects
- What's done well

### Recommended Actions
1. Priority-ordered list of actions
```

## Review Checklist

- [ ] Correctness & Logic
- [ ] SOLID Principles
- [ ] Code Quality & Maintainability
- [ ] Modern C# Features
- [ ] Performance Considerations
- [ ] Error Handling & Logging
- [ ] Security
- [ ] Architecture & Design

## Examples

```bash
# Review a single file
/dotnet-review src/Services/OrderService.cs

# Review a folder
/dotnet-review src/Services/

# Review with specific focus
/dotnet-review src/Controllers/OrderController.cs --focus security
```
