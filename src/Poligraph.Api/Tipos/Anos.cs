using System.Diagnostics.CodeAnalysis;
using System.Globalization;

namespace Poligraph.Api.Tipos;

/// <summary>
/// Um ano com significado próprio: de emenda, de despesa, de eleição, de orçamento. Os tipos não se
/// misturam: o ano da emenda não serve onde se pede o ano da despesa.
/// </summary>
public interface IAno<TAno> : IParsable<TAno> where TAno : struct, IAno<TAno>
{
    int Valor { get; }

    static abstract TAno De(int valor);

    /// <summary>A regra comum: número de quatro dígitos entre 1988 e 2100, a faixa de todo dado público que o projeto lê.</summary>
    static TAno Ler(string s) =>
        Ler(s, out var ano) ? ano : throw new FormatException($"{typeof(TAno).Name} inválido: {s}");

    static bool Ler([NotNullWhen(true)] string? s, out TAno ano)
    {
        var valido = int.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture, out var valor) && valor is >= 1988 and <= 2100;
        ano = valido ? TAno.De(valor) : default;
        return valido;
    }
}

/// <summary>
/// O ano de uma emenda, como o Portal da Transparência a registra: os quatro primeiros dígitos do
/// código da emenda. Uma emenda de 2024 paga em 2025 continua sendo de 2024.
/// </summary>
public readonly record struct AnoDaEmenda(int Valor) : IAno<AnoDaEmenda>
{
    public static AnoDaEmenda De(int valor) => new(valor);

    public static AnoDaEmenda Parse(string s, IFormatProvider? provider) => IAno<AnoDaEmenda>.Ler(s);

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out AnoDaEmenda resultado) =>
        IAno<AnoDaEmenda>.Ler(s, out resultado);

    public override string ToString() => Valor.ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// O ano de uma despesa da cota parlamentar (CEAP da Câmara, CEAPS do Senado): o ano da nota, não o
/// do reembolso.
/// </summary>
public readonly record struct AnoDaDespesa(int Valor) : IAno<AnoDaDespesa>
{
    public static AnoDaDespesa De(int valor) => new(valor);

    public static AnoDaDespesa Parse(string s, IFormatProvider? provider) => IAno<AnoDaDespesa>.Ler(s);

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out AnoDaDespesa resultado) =>
        IAno<AnoDaDespesa>.Ler(s, out resultado);

    public override string ToString() => Valor.ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// O ano de uma eleição do TSE: a de campanha e a da declaração de bens. A que deu o mandato é a do
/// ano anterior ao início da legislatura.
/// </summary>
public readonly record struct AnoDaEleicao(int Valor) : IAno<AnoDaEleicao>
{
    public static AnoDaEleicao De(int valor) => new(valor);

    public static AnoDaEleicao Parse(string s, IFormatProvider? provider) => IAno<AnoDaEleicao>.Ler(s);

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out AnoDaEleicao resultado) =>
        IAno<AnoDaEleicao>.Ler(s, out resultado);

    public override string ToString() => Valor.ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// O ano do orçamento federal (exercício): o da dotação, da execução e da receita na página do Governo.
/// </summary>
public readonly record struct AnoDoOrcamento(int Valor) : IAno<AnoDoOrcamento>
{
    public static AnoDoOrcamento De(int valor) => new(valor);

    public static AnoDoOrcamento Parse(string s, IFormatProvider? provider) => IAno<AnoDoOrcamento>.Ler(s);

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out AnoDoOrcamento resultado) =>
        IAno<AnoDoOrcamento>.Ler(s, out resultado);

    public override string ToString() => Valor.ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// O ano de uma linha da tabela <c>reconciliacoes</c>: o ano da fonte reconciliada, que é o da emenda
/// nas emendas, o da despesa na cota e o do exercício no orçamento federal.
/// </summary>
public readonly record struct AnoDaReconciliacao(int Valor) : IAno<AnoDaReconciliacao>
{
    public static AnoDaReconciliacao De(int valor) => new(valor);

    public static AnoDaReconciliacao Parse(string s, IFormatProvider? provider) => IAno<AnoDaReconciliacao>.Ler(s);

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out AnoDaReconciliacao resultado) =>
        IAno<AnoDaReconciliacao>.Ler(s, out resultado);

    public override string ToString() => Valor.ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// Os anos que a página mostra, de um tipo de ano só. Vem da URL como <c>de</c> e <c>ate</c>, ou
/// <c>ano</c> para um ano só; uma ponta sem a outra fica aberta e o serviço a completa com os anos
/// carregados.
/// </summary>
public readonly record struct Periodo<TAno>(TAno? Primeiro, TAno? Ultimo) where TAno : struct, IAno<TAno>
{
    /// <summary>O período lido da URL. Ano fora do formato responde 400.</summary>
    public static ValueTask<Periodo<TAno>?> BindAsync(HttpContext contexto)
    {
        var consulta = contexto.Request.Query;
        if (!LerDaUrl(consulta, "de", out var primeiro) || !LerDaUrl(consulta, "ate", out var ultimo)
            || !LerDaUrl(consulta, "ano", out var unico))
        {
            return ValueTask.FromResult<Periodo<TAno>?>(null);
        }

        return ValueTask.FromResult<Periodo<TAno>?>(new Periodo<TAno>(primeiro ?? unico, ultimo ?? unico));
    }

    /// <summary>Os dois anos, quando vieram os dois.</summary>
    public bool Completo => Primeiro.HasValue && Ultimo.HasValue;

    /// <summary>Os anos do período, do primeiro ao último. Só com o período completo.</summary>
    public IEnumerable<int> Anos => Enumerable.Range(Primeiro.GetValueOrDefault().Valor, Ultimo.GetValueOrDefault().Valor - Primeiro.GetValueOrDefault().Valor + 1);

    /// <summary>"de 2025" ou "de 2019 a 2026", como as regras do modo auditoria escrevem.</summary>
    public string Texto => Primeiro.Equals(Ultimo) ? $"de {Primeiro}" : $"de {Primeiro} a {Ultimo}";

    private static bool LerDaUrl(IQueryCollection consulta, string parametro, out TAno? ano)
    {
        ano = null;
        if (!consulta.TryGetValue(parametro, out var texto))
        {
            return true;
        }

        if (!TAno.TryParse(texto, CultureInfo.InvariantCulture, out var lido))
        {
            return false;
        }

        ano = lido;
        return true;
    }
}
