namespace Poligraph.Data;

/// <summary>Como o nome do parlamentar foi reconhecido no texto da notícia.</summary>
public enum TipoMetodoDeCitacao
{
    NOME_COMPLETO,
    NOME_PARLAMENTAR,

    /// <summary>⚠️ O mais frágil — carrega a menor <c>confianca</c>.</summary>
    SOBRENOME,
}
