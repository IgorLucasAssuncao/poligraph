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
/// <param name="Pessoa">Obrigatória em votos, cota, emendas, campanha e patrimônio.</param>
/// <param name="Legislatura">Sem ela, a corrente.</param>
/// <param name="Ano">Em emendas e cota, um ano em vez do mandato inteiro; em campanha e patrimônio, a eleição em vez da que deu o mandato.</param>
/// <param name="Casa">Só no painel.</param>
/// <param name="Periodo">Nos pagamentos e no governo: os anos da página.</param>
/// <param name="Cnpj">Só na entidade.</param>
/// <param name="Categoria">Só na cota: uma linha de "Em quê".</param>
/// <param name="Uf">Só nos pagamentos: o que chegou a quem tem sede no estado.</param>
/// <param name="Municipio">Só nos pagamentos: o que chegou a quem tem sede na cidade.</param>
public record ConsultaDeProcedencia(
    ContextoDeProcedencia Contexto,
    PessoaId? Pessoa,
    Legislatura? Legislatura,
    Ano? Ano,
    TipoCasa? Casa,
    Periodo? Periodo,
    Cnpj? Cnpj,
    CategoriaDeDespesa? Categoria,
    Uf? Uf,
    CodigoIbge? Municipio);
