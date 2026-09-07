using Google.Apis.Auth;
using Poligraph.Api.Dtos;

namespace Poligraph.Api.Services;

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
