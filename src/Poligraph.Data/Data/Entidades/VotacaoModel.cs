namespace Poligraph.Data;

/// <summary>Uma votação nominal. O Id é texto: "2456731-84" (achado #3).</summary>
public class VotacaoModel
{
    public required string Id { get; set; }
    public TipoCasa Casa { get; set; }
    public short Legislatura { get; set; }
    public DateOnly Data { get; set; }
    public string? Orgao { get; set; }
    public string? Descricao { get; set; }

    public long? ProposicaoId { get; set; }
    public ProposicaoModel? Proposicao { get; set; }

    public TipoCategoriaDeVotacao Categoria { get; set; }

    /// <summary> Senado: 56% das votações são secretas — registram "Votou", não posição.</summary>
    public bool Secreta { get; set; }

    public bool Plenario { get; set; }
    public int? VotosSim { get; set; }
    public int? VotosNao { get; set; }

    public List<VotoModel> Votos { get; set; } = [];
}
