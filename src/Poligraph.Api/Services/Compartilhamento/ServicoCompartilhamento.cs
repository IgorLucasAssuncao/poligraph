using Poligraph.Api.Textos;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Services;

/// <summary>
/// A página que o link de compartilhar devolve: as tags Open Graph e o redirecionamento para a página do site.
/// <c>/p/{id}</c> é a pessoa, com o nome e a foto; <c>/c/{ibge}</c> a cidade e <c>/e/{cnpj}</c> a entidade, com prévia só de texto.
/// </summary>
/// <remarks>
/// <para>DECISÃO (autor, 2026-10-22): quem monta a prévia (WhatsApp, redes, mensageiros) não roda o JavaScript do site, e o <c>index.html</c> é o mesmo para toda rota. A prévia precisa sair do servidor.</para>
/// <para>A foto é a oficial da Câmara ou do Senado, pelo endereço que a ficha já usa. Quem não tem foto (prefeito, governador) fica com a prévia só de texto.</para>
/// <para>O redirecionamento é por <c>meta refresh</c>, sem script: a CSP do site não libera script inline.</para>
/// </remarks>
public class ServicoCompartilhamento(
    ServicoParlamentares parlamentares, ServicoPoliticos politicos, ServicoGestoesDaCidade cidades, ServicoEntidades entidades)
{
    private readonly ServicoParlamentares _parlamentares = parlamentares;
    private readonly ServicoPoliticos _politicos = politicos;
    private readonly ServicoGestoesDaCidade _cidades = cidades;
    private readonly ServicoEntidades _entidades = entidades;

    /// <summary>A página de prévia. Nula para quem não existe, e o endpoint responde 404.</summary>
    public async Task<string?> ObterPaginaAsync(IdPessoa idPessoa, string origem, CancellationToken ct)
    {
        var ficha = await _parlamentares.ObterFichaAsync(idPessoa, null, ct);
        if (ficha is { Casa: not null })
        {
            var casa = ficha.Casa == Poligraph.Data.TipoCasa.SENADO ? TextosDoCompartilhamento.Senador : TextosDoCompartilhamento.Deputado;
            return Pagina(
                origem, $"/parlamentar/{ficha.IdPessoa}", ficha.Nome,
                TextosDoCompartilhamento.DescricaoDoParlamentar(casa, ficha.Partido, ficha.Uf), ficha.UrlFoto);
        }

        var politico = await _politicos.ObterFichaAsync(idPessoa, ct);
        if (politico is null)
        {
            return null;
        }

        var mandato = politico.Mandatos[0];
        return Pagina(
            origem, $"/politico/{politico.IdPessoa}", politico.Nome,
            TextosDoCompartilhamento.DescricaoDoPolitico(mandato.Cargo, mandato.Partido, mandato.Uf, mandato.Municipio?.Nome),
            politico.UrlFoto);
    }

    /// <summary>A prévia da cidade: o total que chegou e o prefeito eleito mais recente. Nula para código que não é município.</summary>
    public async Task<string?> ObterPaginaDaCidadeAsync(CodigoIbge codigoIbge, string origem, CancellationToken ct)
    {
        var cidade = await _cidades.ObterAsync(codigoIbge, ct);
        if (cidade is null)
        {
            return null;
        }

        var prefeito = cidade.Gestoes.FirstOrDefault()?.Prefeitos.FirstOrDefault();
        return Pagina(
            origem, $"/cidades/{cidade.Municipio.CodigoIbge}", $"{cidade.Municipio.Nome} – {cidade.Municipio.Uf}",
            TextosDoCompartilhamento.DescricaoDaCidade(
                ValorCompacto(cidade.Recebido), cidade.PorAno.Count > 0 ? cidade.PorAno[0].Ano : null,
                prefeito is null ? null : Capitalizado(prefeito.Nome)),
            null, "website");
    }

    /// <summary>A prévia da entidade: o que recebeu de emendas e a sede. Nula para CNPJ sem página.</summary>
    public async Task<string?> ObterPaginaDaEntidadeAsync(Cnpj cnpj, string origem, CancellationToken ct)
    {
        var entidade = await _entidades.ObterAsync(cnpj, ct);
        if (entidade is null)
        {
            return null;
        }

        return Pagina(
            origem, $"/entidades/{entidade.Cnpj}", entidade.Nome,
            TextosDoCompartilhamento.DescricaoDaEntidade(
                ValorCompacto(entidade.Recebido), entidade.Emendas,
                entidade.Sede is null ? null : $"{Capitalizado(entidade.Sede.Nome)} – {entidade.Sede.Uf}"),
            null, "website");
    }

    private static string Pagina(string origem, string caminho, string nome, string descricao, string? urlFoto, string tipo = "profile")
    {
        var url = Escapar(origem + caminho);
        var titulo = Escapar(TextosDoCompartilhamento.Titulo(Capitalizado(nome)));
        var texto = Escapar(descricao);
        var imagem = urlFoto is { Length: > 0 } && Uri.TryCreate(urlFoto, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps
            ? $"""
                <meta property="og:image" content="{Escapar(urlFoto)}">
                <meta property="og:image:alt" content="{Escapar(TextosDoCompartilhamento.AltDaFoto(Capitalizado(nome)))}">
                <meta name="twitter:image" content="{Escapar(urlFoto)}">
              """
            : "";

        return $"""
            <!doctype html>
            <html lang="pt-BR">
            <head>
              <meta charset="utf-8">
              <title>{titulo}</title>
              <meta name="description" content="{texto}">
              <meta property="og:type" content="{tipo}">
              <meta property="og:site_name" content="{TextosDoCompartilhamento.NomeDoSite}">
              <meta property="og:locale" content="pt_BR">
              <meta property="og:title" content="{titulo}">
              <meta property="og:description" content="{texto}">
              <meta property="og:url" content="{url}">
            {imagem}
              <meta name="twitter:card" content="summary">
              <meta name="twitter:title" content="{titulo}">
              <meta name="twitter:description" content="{texto}">
              <link rel="canonical" href="{url}">
              <meta http-equiv="refresh" content="0; url={url}">
            </head>
            <body><p><a href="{url}">{titulo}</a></p></body>
            </html>
            """;
    }

    /// <summary>Escapa o que muda o sentido no HTML e no atributo (&amp;, &lt;, &gt;, aspas). O acento fica como é: a página é UTF-8.</summary>
    private static string Escapar(string texto) =>
        texto.Replace("&", "&amp;", StringComparison.Ordinal)
             .Replace("<", "&lt;", StringComparison.Ordinal)
             .Replace(">", "&gt;", StringComparison.Ordinal)
             .Replace("\"", "&quot;", StringComparison.Ordinal)
             .Replace("'", "&#39;", StringComparison.Ordinal);

    /// <summary>"R$ 236,6 mi", "R$ 3,9 bi": o valor da prévia, curto como na tela.</summary>
    private static string ValorCompacto(decimal valor)
    {
        var ptBr = System.Globalization.CultureInfo.GetCultureInfo("pt-BR");
        return valor switch
        {
            >= 1_000_000_000m => $"R$ {(valor / 1_000_000_000m).ToString("0.#", ptBr)} bi",
            >= 1_000_000m => $"R$ {(valor / 1_000_000m).ToString("0.#", ptBr)} mi",
            >= 1_000m => $"R$ {(valor / 1_000m).ToString("0.#", ptBr)} mil",
            _ => valor.ToString("C", ptBr),
        };
    }

    /// <summary>"JOÃO DA SILVA" vira "João da Silva": o nome de urna vem em caixa alta, e a prévia não grita.</summary>
    private static string Capitalizado(string nome)
    {
        if (nome.Any(char.IsLower))
        {
            return nome;
        }

        var minusculas = new HashSet<string>(StringComparer.Ordinal) { "da", "de", "do", "das", "dos", "e" };
        return string.Join(' ', nome.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select((p, i) => i > 0 && minusculas.Contains(p) ? p : char.ToUpperInvariant(p[0]) + p[1..]));
    }
}
