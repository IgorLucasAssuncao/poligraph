using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>O que o `id_token` do Google carrega, depois de validado.</summary>
public record PerfilGoogleDto(
    string Sub,
    string Email,
    bool EmailVerificado,
    string? Nome,
    string? PrimeiroNome,
    string? Sobrenome,
    string? FotoUrl,
    string? Locale);
