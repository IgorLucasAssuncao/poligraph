using Poligraph.Data;

namespace Poligraph.Api.Textos;

/// <summary>O texto da prévia do link de compartilhar (<c>/p/{id}</c>).</summary>
public static class TextosDoCompartilhamento
{
    public const string NomeDoSite = "Registro Aberto";
    public const string Deputado = "Deputado federal";
    public const string Senador = "Senador";

    public static string Titulo(string nome) => $"{nome} | {NomeDoSite}";

    public static string AltDaFoto(string nome) => $"Foto oficial de {nome}";

    public static string DescricaoDoParlamentar(string casa, string partido, string uf) =>
        $"{casa} ({Partido(partido, uf)}). Como vota, quem vota parecido, emendas, cota e campanha, pelos dados oficiais.";

    public static string DescricaoDoPolitico(TipoCargo cargo, string partido, string? uf, string? municipio) =>
        $"{NomeDoCargo(cargo)}{(municipio is null ? "" : $" de {municipio}")} ({Partido(partido, uf)}). Mandatos, bens declarados e campanha, pelos dados do TSE.";

    public static string DescricaoDaCidade(string recebido, int? desde, string? prefeito) =>
        (desde is null ? "Sem pagamento de emenda na base." : $"{recebido} em emendas chegaram a quem tem sede aqui, de {desde} até hoje.")
        + (prefeito is null ? "" : $" Prefeito eleito: {prefeito}.")
        + " Quem foi eleito em cada gestão, quem mandou o dinheiro e quem recebeu.";

    public static string DescricaoDaEntidade(string recebido, int emendas, string? sede) =>
        $"Recebeu {recebido} de {emendas} {(emendas == 1 ? "emenda" : "emendas")} parlamentares"
        + (sede is null ? "." : $". Sede em {sede}.")
        + " Quem mandou o dinheiro, os convênios e o que mais a base tem sobre ela.";

    private static string Partido(string partido, string? uf) => uf is { Length: > 0 } ? $"{partido}-{uf}" : partido;

    private static string NomeDoCargo(TipoCargo cargo) => cargo switch
    {
        TipoCargo.PRESIDENTE => "Presidente",
        TipoCargo.VICE_PRESIDENTE => "Vice-presidente",
        TipoCargo.SENADOR => "Senador",
        TipoCargo.DEPUTADO_FEDERAL => "Deputado federal",
        TipoCargo.GOVERNADOR => "Governador",
        TipoCargo.VICE_GOVERNADOR => "Vice-governador",
        TipoCargo.DEPUTADO_ESTADUAL => "Deputado estadual",
        TipoCargo.DEPUTADO_DISTRITAL => "Deputado distrital",
        TipoCargo.PREFEITO => "Prefeito",
        TipoCargo.VICE_PREFEITO => "Vice-prefeito",
        _ => throw new ArgumentOutOfRangeException(nameof(cargo)),
    };
}
