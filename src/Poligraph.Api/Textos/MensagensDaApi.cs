namespace Poligraph.Api.Textos;

/// <summary>
/// As mensagens que a API devolve ou registra: erros para quem chama, título da documentação e
/// os avisos do log.
/// </summary>
public static class MensagensDaApi
{
    public const string TituloDaDocumentacao = "Registro Aberto — API";

    public const string RespostasInsuficientes = "Responda mais perguntas para que o resultado tenha significado.";
    public const string SemBaseComparavel = "Nenhum parlamentar votou o suficiente nas perguntas respondidas.";

    public static string UfDesconhecida(string uf) => $"UF desconhecida: {uf}.";

    public const string SoSegueQuemEstaEmExercicio = "Só é possível seguir quem está em exercício.";
    public const string SoSegueQuemEstaEmExercicioDetalhe =
        "A pessoa não votou na legislatura atual. A ficha dela continua aberta para consulta.";
    public const string FaltaConsentimentoParaSeguir = "Falta o consentimento para seguir.";
    public const string FaltaConsentimentoParaSeguirDetalhe =
        "A lista de quem você segue indica posição política, e só é gravada com o seu consentimento.";

    public const string PastaDeChavesObrigatoria =
        "DataProtection:Pasta é obrigatória em produção: sem ela, cada deploy troca as chaves e desloga todo mundo.";

    public const string LoginDesligado =
        "Login com Google DESLIGADO: Google:ClientId não configurado. O site funciona; entrar não. Ver docs/plano/08-obter-as-chaves.md";
    public const string LoginLigado = "Login com Google ligado (Client ID ...{Final}).";

    public const string CacheAquecido = "Cache aquecido em {Duracao}";
    public const string CacheNaoAquecido = "Aquecimento do cache falhou; as requisições calculam sob demanda";
}
