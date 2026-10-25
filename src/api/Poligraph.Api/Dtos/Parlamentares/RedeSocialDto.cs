using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>Uma rede social publicada pelo próprio parlamentar — à Câmara ou ao TSE.</summary>
/// <remarks>
/// <para><see cref="Fonte"/> diz de onde e, com isso, de quando: a da Câmara é a lista atual; a do TSE, a da candidatura.</para>
/// </remarks>
public record RedeSocialDto(TipoRedeSocial Rede, string Url, FonteDaRedeSocial Fonte);
