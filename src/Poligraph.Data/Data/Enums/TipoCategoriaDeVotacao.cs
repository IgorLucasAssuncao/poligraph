namespace Poligraph.Data;

/// <summary>
/// O que a votação decidia — o que dita o peso dela na matriz.
///
/// 🔴 <c>DESTAQUE</c> é a categoria perigosa: em 14% das votações nominais votar "Sim"
/// significa <b>rejeitar</b>. Ver o teste de regressão de polaridade.
/// </summary>
public enum TipoCategoriaDeVotacao
{
    /// <summary>Rito. Peso 0 — mede obstrução, não posição.</summary>
    PROCEDIMENTAL,

    /// <summary>Mérito de um trecho. Peso 0,7.</summary>
    DESTAQUE,

    /// <summary>Mérito da matéria. Peso 1,0 — o sinal mais forte.</summary>
    SUBSTANTIVA,

    /// <summary>VotoModel em pessoa, não em política. Peso 0,3.</summary>
    AUTORIDADE,
}
