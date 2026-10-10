using System.Diagnostics.CodeAnalysis;
using Poligraph.Data;

namespace Poligraph.Api.Tipos;

/// <summary>Os números da tela que o modo auditoria sabe explicar (Pendência 73).</summary>
public enum TipoDeContexto
{
    Votos,
    Cota,
    Emendas,
    Campanha,
    Patrimonio,
    Painel,
    Pagamentos,
    Entidade,
    GovernoGastos,
    GovernoReceitas,
    GovernoSigiloso,
    GovernoViagens,
    GovernoCompras,
    GovernoDefesaCivil,
    GovernoComprasCentralizadas,
    Sancoes,
    Convenios,
    Parlamentar,
    Gestoes,
}

/// <summary>
/// O contexto da rota <c>/api/procedencia/{contexto}</c>, lido do nome que vai na URL
/// (<c>votos</c>, <c>governo-gastos</c>).
/// </summary>
public readonly record struct ContextoDeProcedencia(TipoDeContexto Tipo) : IParsable<ContextoDeProcedencia>
{
    /// <summary>O nome de cada contexto na URL, na ordem em que aparecem na ficha.</summary>
    public static readonly IReadOnlyDictionary<string, TipoDeContexto> Nomes = new Dictionary<string, TipoDeContexto>
    {
        ["votos"] = TipoDeContexto.Votos,
        ["cota"] = TipoDeContexto.Cota,
        ["emendas"] = TipoDeContexto.Emendas,
        ["campanha"] = TipoDeContexto.Campanha,
        ["patrimonio"] = TipoDeContexto.Patrimonio,
        ["painel"] = TipoDeContexto.Painel,
        ["pagamentos"] = TipoDeContexto.Pagamentos,
        ["entidade"] = TipoDeContexto.Entidade,
        ["governo-gastos"] = TipoDeContexto.GovernoGastos,
        ["governo-receitas"] = TipoDeContexto.GovernoReceitas,
        ["governo-sigiloso"] = TipoDeContexto.GovernoSigiloso,
        ["governo-viagens"] = TipoDeContexto.GovernoViagens,
        ["governo-compras"] = TipoDeContexto.GovernoCompras,
        ["governo-defesa-civil"] = TipoDeContexto.GovernoDefesaCivil,
        ["governo-compras-centralizadas"] = TipoDeContexto.GovernoComprasCentralizadas,
        ["sancoes"] = TipoDeContexto.Sancoes,
        ["convenios"] = TipoDeContexto.Convenios,
        ["parlamentar"] = TipoDeContexto.Parlamentar,
        ["gestoes"] = TipoDeContexto.Gestoes,
    };

    public static ContextoDeProcedencia Parse(string s, IFormatProvider? provider) =>
        TryParse(s, provider, out var contexto) ? contexto : throw new FormatException($"Contexto desconhecido: {s}");

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out ContextoDeProcedencia resultado)
    {
        resultado = default;
        if (s is null || !Nomes.TryGetValue(s, out var tipo))
        {
            return false;
        }

        resultado = new ContextoDeProcedencia(tipo);
        return true;
    }

    public override string ToString()
    {
        var tipo = Tipo;
        return Nomes.First(n => n.Value == tipo).Key;
    }
}

/// <summary>
/// O número cuja procedência se pede, com o recorte da tela que o mostra.
/// </summary>
/// <param name="Contexto">Qual número da tela.</param>
/// <param name="IdPessoa">Obrigatório em votos, cota, emendas, campanha e patrimônio.</param>
/// <param name="Legislatura">Sem ela, a corrente.</param>
/// <param name="AnoDaDespesa">Só na cota: um ano em vez do mandato inteiro.</param>
/// <param name="AnoDaEmenda">Só nas emendas: um ano em vez do mandato inteiro.</param>
/// <param name="AnoDaEleicao">Só na campanha e no patrimônio: a eleição em vez da que deu o mandato.</param>
/// <param name="Casa">Só no painel.</param>
/// <param name="PeriodoDasEmendas">Só nos pagamentos: os anos de emenda da página.</param>
/// <param name="PeriodoDoOrcamento">Só no governo: os anos do orçamento da página.</param>
/// <param name="Cnpj">Só na entidade.</param>
/// <param name="Categoria">Só na cota: uma linha de "Em quê".</param>
/// <param name="Uf">Só nos pagamentos: o que chegou a quem tem sede no estado.</param>
/// <param name="Municipio">Só nos pagamentos: o que chegou a quem tem sede na cidade.</param>
public record ConsultaDeProcedencia(
    ContextoDeProcedencia Contexto,
    IdPessoa? IdPessoa,
    Legislatura? Legislatura,
    AnoDaDespesa? AnoDaDespesa,
    AnoDaEmenda? AnoDaEmenda,
    AnoDaEleicao? AnoDaEleicao,
    TipoCasa? Casa,
    Periodo<AnoDaEmenda> PeriodoDasEmendas,
    Periodo<AnoDoOrcamento> PeriodoDoOrcamento,
    Cnpj? Cnpj,
    CategoriaDeDespesa? Categoria,
    Uf? Uf,
    CodigoIbge? Municipio);
