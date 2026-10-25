namespace Poligraph.Data;

/// <summary>Um político: parlamentar federal ou eleito estadual e municipal (Pendência 90). Identidade própria do projeto, mapeada para os IDs externos; os cargos ficam em <see cref="MandatoModel"/>.</summary>
public class PessoaModel
{
    public long Id { get; set; }
    public required string NomeCivil { get; set; }
    public required string NomeExibicao { get; set; }
    public DateOnly? DataNascimento { get; set; }
    public TipoSexo? Sexo { get; set; }

    /// <summary> NUNCA o CPF em claro — RNF-13.</summary>
    public string? CpfHash { get; set; }

    /// <summary>HMAC do título de eleitor, com a mesma chave do CPF (Pendência 90). Identifica o eleito entre eleições quando o TSE não publica o CPF, como em 2024. NUNCA o título em claro. Não é único, como o CPF: quem foi deputado e senador tem uma pessoa por casa (achado #18).</summary>
    public string? TituloHash { get; set; }

    /// <summary>
    /// URL da foto oficial, na própria Câmara.
    ///
    /// Guardamos a URL, NÃO a imagem. A diferença é jurídica, não de espaço:
    /// **linkar** e **rehospedar** são atos diferentes perante licença e LGPD, e
    /// rehospedar foto de pessoa é decisão que este trabalho ainda não tomou.
    ///
    /// Consequência aceita: se a Câmara mudar o padrão de URL, as fotos somem da
    /// tela. `Avatar.tsx` cai para as iniciais sozinho — por isso o `onError` existe.
    /// </summary>
    public string? UrlFoto { get; set; }

    /// <summary>
    /// Exclusão lógica. `null` = ativo.
    ///
    /// Parlamentar NUNCA é apagado de verdade. O voto dele é registro histórico e
    /// público: apagar a pessoa levaria junto — por `CASCADE` — o nó no grafo, as
    /// arestas e as similaridades de toda execução já feita, inclusive as que a banca
    /// pode querer reproduzir.
    ///
    /// Isto NÃO vale para `usuario` nem `segue`, e a diferença é jurídica, não de
    /// gosto — ver `EndpointsAutenticacao.ExcluirContaAsync`.
    /// </summary>
    public DateTimeOffset? ExcluidoEm { get; set; }

    public List<PessoaFonteIdModel> FontesId { get; set; } = [];
    public List<VotoModel> Votos { get; set; } = [];

    /// <summary>O arquivo que gravou a linha por último. Mais de uma fonte escreve aqui (Câmara, Senado, TSE), e os IDs de cada uma ficam em pessoa_fonte_ids.</summary>
    public long? CargaId { get; set; }

    /// <summary>De onde veio o CPF que gerou o <see cref="CpfHash"/>: a API da Câmara ou o arquivo de candidatos do TSE. RISCO: o arquivo traz o CPF em claro; o painel de auditoria não o lista.</summary>
    public long? CpfCargaId { get; set; }

    /// <summary>De onde veio o nome civil completo do senador: o arquivo de candidatos do TSE.</summary>
    public long? NomeCivilCargaId { get; set; }
}
