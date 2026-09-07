namespace Poligraph.Data;

/// <summary>
/// Notícia coletada de feed RSS.
///
/// RF-38 — guardamos APENAS url, título, veículo, data e um trecho curto.
/// Nunca o texto integral: isso é reprodução de obra de terceiro, e o projeto não
/// tem licença para isso. Nunca conteúdo atrás de paywall.
/// </summary>
public class NoticiaModel
{
    public long Id { get; set; }

    /// <summary> Chave natural da deduplicação — a mesma matéria replicada tem a mesma URL.</summary>
    public required string Url { get; set; }

    public required string Titulo { get; set; }
    public required string Veiculo { get; set; }
    public DateTimeOffset PublicadaEm { get; set; }

    /// <summary> Trecho CURTO, como veio no `description` do RSS. Não é o corpo da matéria.</summary>
    public string? Trecho { get; set; }

    /// <summary>Hash do título normalizado — pega a mesma matéria republicada com outra URL.</summary>
    public required string HashTitulo { get; set; }

    public DateTimeOffset ColetadaEm { get; set; }

    public List<NoticiaPessoaModel> Pessoas { get; set; } = [];
}
