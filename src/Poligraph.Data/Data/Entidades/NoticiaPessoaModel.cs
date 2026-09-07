namespace Poligraph.Data;

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

    public TipoMetodoDeCitacao Metodo { get; set; }
}
