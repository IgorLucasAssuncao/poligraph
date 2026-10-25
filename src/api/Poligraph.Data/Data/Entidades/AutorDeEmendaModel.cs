namespace Poligraph.Data;

/// <summary>
/// Liga o código de autor do Portal a uma pessoa nossa.
///
/// **É a tabela que o autor pediu ao dispensar o casamento por nome:** ingere-se tudo
/// primeiro, resolve-se depois. Um código sem `pessoa_id` fica visível como pendência de
/// reconciliação, em vez de virar registro perdido.
///
/// Serve para Senado também — o Portal usa o mesmo esquema de código para as duas
/// casas.
/// </summary>
public class AutorDeEmendaModel
{
    /// <summary>O código extraído do `codigoEmenda`.</summary>
    public required string Codigo { get; set; }

    /// <summary> Última grafia vista — muda; o código, não.</summary>
    public required string NomeAutor { get; set; }

    /// <summary>`null` = ainda não reconciliado.</summary>
    public long? PessoaId { get; set; }

    public TipoMetodoDeAutor Metodo { get; set; }

    public DateTimeOffset AtualizadoEm { get; set; }

    public PessoaModel? Pessoa { get; set; }

    /// <summary>O arquivo de emendas do Portal que gravou o código e o nome por último. A ligação à pessoa é nossa, e o método diz como foi feita.</summary>
    public long? CargaId { get; set; }
}
