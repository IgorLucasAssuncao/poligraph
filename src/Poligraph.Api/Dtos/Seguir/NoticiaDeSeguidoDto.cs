namespace Poligraph.Api.Dtos;

/// <summary>
/// Uma notícia do feed da página inicial, com quem a trouxe: o "porque você segue" (RF-46)
/// é dito com o nome de quem aparece nela.
/// </summary>
public record NoticiaDeSeguidoDto(
    long PessoaId, string Nome, string? UrlFoto, NoticiaNaFichaDto Noticia);
