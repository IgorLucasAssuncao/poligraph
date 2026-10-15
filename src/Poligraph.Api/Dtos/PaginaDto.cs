namespace Poligraph.Api.Dtos;

/// <summary>
/// Uma página de uma lista maior. <see cref="Total"/> é o da lista inteira, para a tela
/// dizer quantos faltam em vez de cortar calada.
/// </summary>
/// <remarks>
/// <para><see cref="Pagina"/> começa em 1.</para>
/// </remarks>
public record PaginaDto<T>(IReadOnlyList<T> Itens, int Pagina, int Tamanho, int Total);
