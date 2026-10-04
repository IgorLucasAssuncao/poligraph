using System.Diagnostics.CodeAnalysis;
using System.Globalization;

using Poligraph.Api.Services;

namespace Poligraph.Api.Tipos;

/// <summary>
/// O identificador de uma pessoa no NOSSO banco: a chave de <c>pessoas</c>. Não é o id da Câmara, o código
/// do Senado nem o sequencial do TSE; esses ficam em <c>pessoa_fonte_ids</c>.
/// </summary>
/// <remarks>
/// <para>Lido da URL pelo próprio ASP.NET (<see cref="IParsable{TSelf}"/>): um valor que não é número positivo responde 400 antes de chegar ao serviço.</para>
/// </remarks>
public readonly record struct IdPessoa(long Valor) : IParsable<IdPessoa>
{
    public static IdPessoa Parse(string s, IFormatProvider? provider) =>
        TryParse(s, provider, out var id) ? id : throw new FormatException($"Identificador de pessoa inválido: {s}");

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out IdPessoa resultado)
    {
        resultado = default;
        if (!long.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture, out var valor) || valor <= 0)
        {
            return false;
        }

        resultado = new IdPessoa(valor);
        return true;
    }

    public override string ToString() => Valor.ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// O número de uma legislatura: os quatro anos entre uma eleição e a seguinte (a 57ª vai de 2023 a 2027).
/// </summary>
public readonly record struct Legislatura(short Numero) : IParsable<Legislatura>
{
    public static Legislatura Parse(string s, IFormatProvider? provider) =>
        TryParse(s, provider, out var legislatura) ? legislatura : throw new FormatException($"Legislatura inválida: {s}");

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out Legislatura resultado)
    {
        resultado = default;
        if (!short.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture, out var numero) || numero is < 1 or > 99)
        {
            return false;
        }

        resultado = new Legislatura(numero);
        return true;
    }

    public override string ToString() => Numero.ToString(CultureInfo.InvariantCulture);
}

/// <summary>
/// Um CNPJ, só os 14 dígitos, sem pontuação.
/// </summary>
public readonly record struct Cnpj(string Digitos) : IParsable<Cnpj>
{
    public static Cnpj Parse(string s, IFormatProvider? provider) =>
        TryParse(s, provider, out var cnpj) ? cnpj : throw new FormatException($"CNPJ inválido: {s}");

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out Cnpj resultado)
    {
        resultado = default;
        if (s is null || s.Length != 14 || !s.All(char.IsAsciiDigit))
        {
            return false;
        }

        resultado = new Cnpj(s);
        return true;
    }

    public override string ToString() => Digitos;
}

/// <summary>
/// A sigla de uma das 27 unidades da federação, em maiúsculas.
/// </summary>
/// <remarks>
/// <para>Aceita a sigla em minúsculas e a devolve em maiúsculas: <c>pr</c> vira <c>PR</c>.</para>
/// </remarks>
public readonly record struct Uf(string Sigla) : IParsable<Uf>
{
    public static Uf Parse(string s, IFormatProvider? provider) =>
        TryParse(s, provider, out var uf) ? uf : throw new FormatException($"UF desconhecida: {s}");

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out Uf resultado)
    {
        resultado = default;
        var sigla = s?.Trim().ToUpperInvariant();
        if (sigla is null || !Ufs.Todas.Contains(sigla))
        {
            return false;
        }

        resultado = new Uf(sigla);
        return true;
    }

    public override string ToString() => Sigla;
}

/// <summary>
/// O código de município do IBGE, com os 7 dígitos (o último é o verificador).
/// </summary>
public readonly record struct CodigoIbge(string Digitos) : IParsable<CodigoIbge>
{
    public static CodigoIbge Parse(string s, IFormatProvider? provider) =>
        TryParse(s, provider, out var codigo) ? codigo : throw new FormatException($"Código IBGE inválido: {s}");

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out CodigoIbge resultado)
    {
        resultado = default;
        if (s is null || s.Length != 7 || !s.All(char.IsAsciiDigit))
        {
            return false;
        }

        resultado = new CodigoIbge(s);
        return true;
    }

    public override string ToString() => Digitos;
}

/// <summary>
/// Uma categoria de despesa da cota parlamentar, como a fonte a escreve ("PASSAGEM AÉREA - SIGEPA").
/// </summary>
public readonly record struct CategoriaDeDespesa(string Nome) : IParsable<CategoriaDeDespesa>
{
    public static CategoriaDeDespesa Parse(string s, IFormatProvider? provider) =>
        TryParse(s, provider, out var categoria) ? categoria : throw new FormatException("Categoria de despesa vazia.");

    public static bool TryParse([NotNullWhen(true)] string? s, IFormatProvider? provider, out CategoriaDeDespesa resultado)
    {
        resultado = default;
        if (string.IsNullOrWhiteSpace(s) || s.Length > 200)
        {
            return false;
        }

        resultado = new CategoriaDeDespesa(s);
        return true;
    }

    public override string ToString() => Nome;
}
