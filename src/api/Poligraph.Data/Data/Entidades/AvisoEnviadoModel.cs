namespace Poligraph.Data;

/// <summary>
/// Uma novidade já avisada a uma pessoa (Pendência 89), pela chave do fato, como <c>A2:votacao:pessoa</c>.
/// É o consumidor idempotente: rodar o envio duas vezes não repete aviso.
/// </summary>
/// <remarks>
/// <para>RISCO: as chaves de A2 e A3 levam o id do parlamentar, então a tabela diz sobre quem a pessoa foi avisada, que é tão sensível quanto a lista de quem ela segue. Sai com a conta, com a revogação do consentimento de seguir ou de avisar, ao deixar de seguir o parlamentar da chave e depois de 90 dias.</para>
/// </remarks>
public class AvisoEnviadoModel
{
    public long UsuarioId { get; set; }

    public required string Chave { get; set; }

    public DateTimeOffset EnviadoEm { get; set; }
}
