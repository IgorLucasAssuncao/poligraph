using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// <c>Peso</c> é a CONCORDÂNCIA — a proporção de votos iguais —, e sozinho ele não
/// se lê: 82% sobre 24 votações e 82% sobre 540 são afirmações de força muito
/// diferente. <c>VotacoesComuns</c> é a base, e a tela nunca mostra um sem o outro.
///
/// <c>Cosseno</c> é a outra métrica da RF-18, calculada sobre os mesmos pares. Vai
/// junto para que a comparação entre as duas seja verificável na própria interface.
/// </summary>
public record ArestaDoGrafoDto(
    long IdPessoaDe, long IdPessoaPara, float Peso, int VotacoesComuns, float? Cosseno);
