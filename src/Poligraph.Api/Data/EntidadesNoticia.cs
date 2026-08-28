namespace Poligraph.Api.Data;

/// <summary>
/// Notícia coletada de feed RSS.
///
/// 🔴 RF-38 — guardamos APENAS url, título, veículo, data e um trecho curto.
/// ⛔ Nunca o texto integral: isso é reprodução de obra de terceiro, e o projeto não
/// tem licença para isso. ⛔ Nunca conteúdo atrás de paywall.
/// </summary>
public class NoticiaModel
{
    public long Id { get; set; }

    /// <summary>⭐ Chave natural da deduplicação — a mesma matéria replicada tem a mesma URL.</summary>
    public required string Url { get; set; }

    public required string Titulo { get; set; }
    public required string Veiculo { get; set; }
    public DateTimeOffset PublicadaEm { get; set; }

    /// <summary>⚠️ Trecho CURTO, como veio no `description` do RSS. Não é o corpo da matéria.</summary>
    public string? Trecho { get; set; }

    /// <summary>Hash do título normalizado — pega a mesma matéria republicada com outra URL.</summary>
    public required string HashTitulo { get; set; }

    public DateTimeOffset ColetadaEm { get; set; }

    public List<NoticiaPessoaModel> Pessoas { get; set; } = [];
}

/// <summary>
/// Liga a notícia ao parlamentar mencionado.
///
/// 🔴 RF-40 — `Confianca` existe porque notícia errada na página de quem a pessoa segue
/// é falha visível. Abaixo do limiar, a associação NÃO é exibida.
/// </summary>
public class NoticiaPessoaModel
{
    public long NoticiaId { get; set; }
    public NoticiaModel? Noticia { get; set; }

    public long PessoaId { get; set; }
    public PessoaModel? Pessoa { get; set; }

    /// <summary>0 a 1. Nome completo casado vale mais que sobrenome solto.</summary>
    public float Confianca { get; set; }

    public MetodoDeCitacao Metodo { get; set; }
}

/// <summary>RF-48 — tema da notícia, para o feed misto.</summary>
public class NoticiaTemaModel
{
    public long NoticiaId { get; set; }
    public NoticiaModel? Noticia { get; set; }

    public required string Tema { get; set; }
}
