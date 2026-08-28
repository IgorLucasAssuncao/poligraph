using Google.Apis.Auth;

namespace Poligraph.Api.Services;

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

/// <summary>
/// ⚠️ Esta interface é a exceção à regra "sem interface para uma implementação só".
///
/// Aqui existem DUAS de verdade: a real, que fala com o Google, e a de teste. Sem ela
/// não haveria como testar o login — não dá para gerar `id_token` válido do Google
/// dentro de um teste automatizado.
/// </summary>
public interface IValidadorGoogle
{
    Task<PerfilGoogleDto?> ValidarAsync(string idToken, CancellationToken ct = default);
}

public class ValidadorGoogle(IConfiguration configuracao) : IValidadorGoogle
{
    private readonly IConfiguration _configuracao = configuracao;

    public async Task<PerfilGoogleDto?> ValidarAsync(string idToken, CancellationToken ct = default)
    {
        var clientId = _configuracao["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId)) return null;

        try
        {
            // 🔴 São TRÊS conferências, e a do `Audience` é a que costuma faltar.
            //    Sem ela, um token legítimo emitido para OUTRO aplicativo é aceito
            //    aqui como se fosse nosso. A biblioteca só a faz se receber o valor.
            var payload = await GoogleJsonWebSignature.ValidateAsync(
                idToken,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });

            return new PerfilGoogleDto(
                payload.Subject,
                payload.Email,
                payload.EmailVerified,
                payload.Name,
                payload.GivenName,
                payload.FamilyName,
                payload.Picture,
                payload.Locale);
        }
        catch (InvalidJwtException)
        {
            return null;   // token forjado, vencido, ou de outro app
        }
    }
}
