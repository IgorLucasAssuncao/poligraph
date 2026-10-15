namespace Poligraph.Data;

/// <summary>
/// LGPD — a finalidade específica de um consentimento (RNF-12b).
///
/// Um valor só, e é isso que o torna auditável: consentimento genérico não
/// atende ao art. 8º, §4º.
/// </summary>
/// <remarks>
/// <para>Era <c>EMAIL_NOTICIAS</c>, e ficou sem uso quando o e-mail saiu (Pendência 63). Desde a Pendência 62 é o consentimento de seguir: a lista de seguidos é dado sensível (art. 5º, II) e a política diz que o consentimento é dado ao seguir; sem registro, não haveria como provar.</para>
/// </remarks>
public enum TipoFinalidadeDeConsentimento
{
    SEGUIR_PARLAMENTARES,
}
