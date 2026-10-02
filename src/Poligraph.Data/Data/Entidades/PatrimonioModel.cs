namespace Poligraph.Data;

/// <summary>
/// O patrimônio que o parlamentar declarou ao TSE ao se candidatar, somado por tipo de bem.
/// </summary>
/// <remarks>
/// <para>
/// RISCO: Só o TIPO e o VALOR. A descrição de cada bem é texto livre e traz endereço ("prédio
/// comercial situado à rua…"): Não entra no banco. Minimização (LGPD): a pergunta da tela é
/// quanto, e em quê, não onde.
/// </para>
/// <para>
/// Uma linha por pessoa, eleição e tipo. Quem concorreu em 2018 e 2022 tem as duas, e a
/// tela compara. A ligação é código da candidatura → CPF → hash, a mesma de <c>cpf_hash</c>.
/// </para>
/// </remarks>
public class PatrimonioModel
{
    public long PessoaId { get; set; }

    public short AnoEleicao { get; set; }

    public required string TipoBem { get; set; }

    public decimal Valor { get; set; }

    public int Quantidade { get; set; }

    /// <summary>A carga de onde a linha saiu (PL72). Nula nas linhas gravadas antes dela.</summary>
    public long? CargaId { get; set; }
}
