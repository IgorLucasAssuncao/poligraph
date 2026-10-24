namespace Poligraph.Api.Textos;

/// <summary>
/// As mensagens que a API devolve ou registra: erros para quem chama, título da documentação e
/// os avisos do log.
/// </summary>
public static class MensagensDaApi
{
    public const string TituloDaDocumentacao = "Registro Aberto — API";

    public const string DoadorNaoInformado = "Repasse sem o nome de quem entregou";

    public const string SaudeWorkerDePe = "O worker dos avisos está de pé.";
    public const string SaudeWorkerSemFila = "A fila de tarefas (schema hangfire) não existe: o worker nunca subiu neste banco.";
    public const string SaudeWorkerSemServidor = "Nenhum worker registrado na fila: os avisos não estão saindo.";

    public static string SaudeWorkerParado(TimeSpan semBatida) =>
        $"O worker dos avisos não dá sinal há {Math.Round(semBatida.TotalMinutes)} min.";

    public const string SaudeRotinaNenhuma = "Nenhuma rotina da ETL terminou neste banco ainda.";

    public static string SaudeRotinaEmDia(TimeSpan desde) =>
        $"A última rotina da ETL terminou há {Math.Round(desde.TotalHours)} h.";

    public static string SaudeRotinaAtrasada(TimeSpan desde) =>
        $"A última rotina da ETL terminou há {Math.Round(desde.TotalDays)} dias: a semanal atrasou.";

    public const string RespostasInsuficientes = "Responda mais perguntas para que o resultado tenha significado.";
    public const string SemBaseComparavel = "Nenhum parlamentar votou o suficiente nas perguntas respondidas.";

    public static string UfDesconhecida(string uf) => $"UF desconhecida: {uf}.";

    public const string SoSegueQuemEstaEmExercicio = "Só é possível seguir quem está em exercício.";
    public const string SoSegueQuemEstaEmExercicioDetalhe =
        "A pessoa não votou na legislatura atual. A ficha dela continua aberta para consulta.";
    public const string FaltaConsentimentoParaSeguir = "Falta o consentimento para seguir.";
    public const string FaltaConsentimentoParaSeguirDetalhe =
        "A lista de quem você segue indica posição política, e só é gravada com o seu consentimento.";
    public const string FaltaConsentimentoParaAvisos = "Falta o consentimento para receber avisos.";
    public const string FaltaConsentimentoParaAvisosDetalhe =
        "Os avisos dizem que você segue alguém, e o navegador só é inscrito com o seu consentimento.";
    public const string InscricaoInvalida = "O navegador mandou uma inscrição incompleta.";

    /// <summary>
    /// O aviso no navegador (Pendência 89): diz o tipo do fato e quantos, sem o nome de ninguém, porque
    /// aparece na tela de bloqueio. Quem foi, a pessoa vê ao abrir o site.
    /// </summary>
    /// <param name="contraOPartido">Votos contra a orientação do partido (A2).</param>
    /// <param name="trocas">Trocas de partido (A3).</param>
    /// <param name="mesDoResumo">O mês dos gastos e das emendas que chegaram (A4, A5), ou nulo.</param>
    public static (string Titulo, string Corpo) Aviso(int contraOPartido, int trocas, DateOnly? mesDoResumo) =>
        (contraOPartido, trocas, mesDoResumo) switch
        {
            ( > 0, 0, null) => ("Voto contra o partido", contraOPartido == 1
                ? "Um parlamentar que você segue votou contra a orientação do próprio partido."
                : $"Parlamentares que você segue votaram {contraOPartido} vezes contra a orientação do próprio partido."),
            (0, > 0, null) => ("Troca de partido", trocas == 1
                ? "Um parlamentar que você segue mudou de partido."
                : $"{trocas} parlamentares que você segue mudaram de partido."),
            (0, 0, { } mes) => ($"Gastos de {NomeDoMes(mes)}", $"Saíram os gastos da cota e as emendas pagas em {NomeDoMes(mes)} dos parlamentares que você segue."),
            _ => ("Novidades de quem você segue", Juntar(contraOPartido, trocas, mesDoResumo)),
        };

    private static readonly string[] Meses =
        ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

    private static string NomeDoMes(DateOnly mes) => Meses[mes.Month - 1];

    private static string Juntar(int contraOPartido, int trocas, DateOnly? mesDoResumo)
    {
        List<string> partes = [];
        if (contraOPartido > 0)
        {
            partes.Add(contraOPartido == 1 ? "1 voto contra o partido" : $"{contraOPartido} votos contra o partido");
        }
        if (trocas > 0)
        {
            partes.Add(trocas == 1 ? "1 troca de partido" : $"{trocas} trocas de partido");
        }
        if (mesDoResumo is { } mes)
        {
            partes.Add($"os gastos de {NomeDoMes(mes)}");
        }
        var texto = partes.Count == 1 ? partes[0] : string.Join(", ", partes[..^1]) + " e " + partes[^1];
        return char.ToUpperInvariant(texto[0]) + texto[1..] + ".";
    }

    public const string PastaDeChavesObrigatoria =
        "DataProtection:Pasta é obrigatória em produção: sem ela, cada deploy troca as chaves e desloga todo mundo.";

    public const string LoginDesligado =
        "Login com Google DESLIGADO: Google:ClientId não configurado. O site funciona; entrar não. Ver docs/plano/08-obter-as-chaves.md";
    public const string LoginLigado = "Login com Google ligado (Client ID ...{Final}).";

    public const string FaltaCabecalhoDoSite =
        "Pedido que muda estado precisa vir do próprio site (cabeçalho X-Requested-With).";

    public const string CacheAquecido = "Cache aquecido em {Duracao}";
    public const string CacheNaoAquecido = "Aquecimento do cache falhou; as requisições calculam sob demanda";
}
