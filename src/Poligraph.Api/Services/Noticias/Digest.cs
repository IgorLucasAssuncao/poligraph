namespace Poligraph.Api.Services;

public record Digest(long UsuarioId, string Email, string? PrimeiroNome, string Assunto,
                     IReadOnlyList<ItemDoDigest> Itens, string TokenDescadastro);
