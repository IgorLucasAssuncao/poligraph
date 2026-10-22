using Poligraph.Api.Textos;
using Poligraph.Api.Tipos;

namespace Poligraph.Api.Services;

/// <summary>
/// A página que o link de compartilhar (<c>/p/{id}</c>) devolve: as tags Open Graph com o nome e a foto da pessoa, e o redirecionamento para a ficha.
/// </summary>
/// <remarks>
/// <para>DECISÃO (autor, 2026-10-22): quem monta a prévia (WhatsApp, redes, mensageiros) não roda o JavaScript do site, e o <c>index.html</c> é o mesmo para toda rota. A prévia precisa sair do servidor.</para>
/// <para>A foto é a oficial da Câmara ou do Senado, pelo endereço que a ficha já usa. Quem não tem foto (prefeito, governador) fica com a prévia só de texto.</para>
/// <para>O redirecionamento é por <c>meta refresh</c>, sem script: a CSP do site não libera script inline.</para>
/// </remarks>
public class ServicoCompartilhamento(ServicoParlamentares parlamentares, ServicoPoliticos politicos)
{
    private readonly ServicoParlamentares _parlamentares = parlamentares;
    private readonly ServicoPoliticos _politicos = politicos;

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

    private static string Pagina(string origem, string caminho, string nome, string descricao, string? urlFoto)
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
              <meta property="og:type" content="profile">
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
