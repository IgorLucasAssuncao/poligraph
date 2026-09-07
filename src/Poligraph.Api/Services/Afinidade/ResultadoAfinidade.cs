namespace Poligraph.Api.Services;

/// <summary>Afinidade de um parlamentar com o cidadão. ⛔ Sem percentual — RF-29.</summary>
public readonly record struct ResultadoAfinidade(long PessoaId, int Acordos, int Comparaveis)
{
    /// <summary>Uso interno para ordenar. ⛔ Não expor na API: a tela mostra "X de Y".</summary>
    public double Proporcao => Comparaveis == 0 ? 0 : (double)Acordos / Comparaveis;
}
