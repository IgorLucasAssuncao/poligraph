namespace Poligraph.Data;

/// <summary>PerguntaModel do questionário. Curadoria manual — Pendência 11.</summary>
public class PerguntaModel
{
    /// <summary>"q1" — nunca expor o idVotacao ao cidadão.</summary>
    public required string Id { get; set; }

    public required string VotacaoId { get; set; }
    public VotacaoModel? Votacao { get; set; }

    /// <summary>Afirmação em linguagem leiga. Formato: "X deve ser Y."</summary>
    public required string Texto { get; set; }

    /// <summary>
    /// O campo mais perigoso do sistema. +1 = "Sim" aprova a afirmação;
    /// -1 = "Sim" a rejeita (destaque). Hoje sempre +1 — só texto principal.
    /// </summary>
    public short Polaridade { get; set; }

    public short Ordem { get; set; }
    public bool Ativa { get; set; } = true;
}
