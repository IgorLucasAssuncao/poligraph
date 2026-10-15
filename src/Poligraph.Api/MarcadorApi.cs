namespace Poligraph.Api;

/// <summary>
/// Marcador para o `WebApplicationFactory` dos testes de integração.
/// Não use `Program`: o projeto de migrations também tem um, no namespace global,
/// e a referência dupla no projeto de testes torna o nome ambíguo.
/// </summary>
public sealed class MarcadorApi;
