using Google.Apis.Auth;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Services;

public class ValidadorGoogle(IConfiguration configuracao) : IValidadorGoogle
{
    private readonly IConfiguration _configuracao = configuracao;

    /// <remarks>
    /// <para>São TRÊS conferências, e a do `Audience` é a que costuma faltar. Sem ela, um token legítimo emitido para OUTRO aplicativo é aceito aqui como se fosse nosso. A biblioteca só a faz se receber o valor.</para>
    /// </remarks>
    public async Task<PerfilGoogleDto?> ValidarAsync(string idToken, CancellationToken ct = default)
    {
        var clientId = _configuracao["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId)) return null;

        try
        {
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
