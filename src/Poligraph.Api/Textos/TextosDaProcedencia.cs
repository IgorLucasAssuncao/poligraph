using Poligraph.Api.Tipos;
using Poligraph.Data;

namespace Poligraph.Api.Textos;

/// <summary>
/// As frases do modo auditoria: a regra de cada número, o órgão e a base legal de cada fonte.
/// </summary>
/// <remarks>
/// <para>Ficam aqui, e não no serviço, para o texto ser revisto num lugar só (Pendência 82) sem mexer na consulta.</para>
/// </remarks>
public static class TextosDaProcedencia
{
    public const string FornecedorNaoInformado = "Fornecedor não informado";
    public const string DoadorNaoInformado = "Doador não informado";
    public const string FavorecidoNaoInformado = "Favorecido não informado";
    public const string Sim = "Sim";
    public const string Nao = "Não";

    public static string Emenda(string codigo) => $"Emenda {codigo}";

    public static string Votos(Legislatura legislatura) =>
        $"Os votos com posição (Sim ou Não; abstenção não conta) desta pessoa nas votações da {legislatura}ª legislatura, "
        + "em plenário e comissões, uma linha por votação. É a mesma conta do número da ficha.";

    public static string Cota(int primeiroAnoDaDespesa, int ultimoAnoDaDespesa, CategoriaDeDespesa? categoria) =>
        $"Os lançamentos da cota parlamentar desta pessoa em {(primeiroAnoDaDespesa == ultimoAnoDaDespesa ? $"{primeiroAnoDaDespesa}" : $"{primeiroAnoDaDespesa} a {ultimoAnoDaDespesa}")}"
        + (categoria is null ? "" : $", na categoria \"{categoria}\"")
        + ", pelo valor líquido. Estorno entra negativo.";

    public static string Emendas(int primeiroAnoDaEmenda, int ultimoAnoDaEmenda) =>
        $"As emendas {(primeiroAnoDaEmenda == ultimoAnoDaEmenda ? $"de {primeiroAnoDaEmenda}" : $"de {primeiroAnoDaEmenda} a {ultimoAnoDaEmenda}")} atribuídas a esta pessoa pelo código de autor, uma linha por "
        + "emenda e localidade, pelo valor empenhado. Só entra emenda com autor reconciliado.";

    public static string Campanha(int anoDaEleicao) =>
        $"As receitas da campanha de {anoDaEleicao} desta pessoa, ao cargo da casa em que ela votou. "
        + "O documento do doador pessoa física fica guardado só como hash.";

    public static string Patrimonio(int anoDaEleicao) =>
        $"Os bens declarados ao TSE na candidatura de {anoDaEleicao}, somados por tipo. "
        + "É autodeclaração: o TSE publica o que o candidato informou.";

    public static string Pagamentos(Periodo<AnoDaEmenda> periodoDasEmendas, Uf? uf, CodigoIbge? municipio)
    {
        var ondeFicaASede = municipio is not null ? ", a quem tem sede nesta cidade" : uf is { } ufDaSede ? $", a quem tem sede em {ufDaSede}" : "";
        return $"Os pagamentos das emendas {periodoDasEmendas.Texto}{ondeFicaASede}, do Portal da Transparência, "
            + "uma linha por emenda, mês e favorecido. O ano é o da emenda, e o pagamento pode ser de anos depois."
            + (ondeFicaASede == "" ? "" : " A sede vem do cadastro de CNPJ da Receita Federal.");
    }

    public static string GovernoReceitas(Periodo<AnoDoOrcamento> periodoDoOrcamento) =>
        $"A receita realizada do Poder Executivo federal {periodoDoOrcamento.Texto}, por origem, do arquivo de receitas do Portal da Transparência, uma linha por ano, categoria e origem. "
        + "O que foi pego emprestado é a origem \"operações de crédito\" desse mesmo arquivo.";

    public static string GovernoSigiloso(Periodo<AnoDoOrcamento> periodoDoOrcamento) =>
        $"O gasto sigiloso {periodoDoOrcamento.Texto}: cartão corporativo e ações marcadas como sigilosas, por órgão, dos arquivos mensais do Portal.";

    public static string GovernoViagens(Periodo<AnoDoOrcamento> periodo) =>
        $"As viagens a serviço do Executivo federal {periodo.Texto}: diárias, passagens, seguro e restituição por órgão, do arquivo anual de viagens do Portal da Transparência. "
        + "O pagamento publicado com órgão \"Sigiloso\" vai para o órgão da viagem, pelo identificador do processo.";

    public static string GovernoCompras(Periodo<AnoDoOrcamento> periodo) =>
        $"Os contratos do Executivo federal publicados {periodo.Texto}, por órgão e modalidade, dos arquivos mensais de compras do Portal da Transparência, uma linha por mês, órgão e modalidade. "
        + "Quando o valor inicial e o final diferem mais de 100 vezes, conta o menor.";

    public static string GovernoDefesaCivil(Periodo<AnoDoOrcamento> periodo) =>
        $"O cartão de pagamento da Defesa Civil {periodo.Texto}, dos extratos mensais do Portal da Transparência, uma linha por mês, executor e município.";

    public static string GovernoComprasCentralizadas(Periodo<AnoDoOrcamento> periodo) =>
        $"O cartão de compras centralizadas {periodo.Texto}, dos arquivos mensais do Portal da Transparência, uma linha por mês e órgão.";

    public const string Sancoes =
        "As sanções da empresa no Cadastro de Empresas Inidôneas e Suspensas (CEIS) e no Cadastro Nacional de Empresas Punidas (CNEP), do retrato mais recente que o Portal da Transparência publica.";

    public const string ConveniosDaEntidade =
        "Os convênios em que a entidade é a convenente e que receberam emenda, do arquivo de emendas do Portal da Transparência.";

    public static string ConveniosDoParlamentar(int primeiroAnoDaEmenda, int ultimoAnoDaEmenda) =>
        $"Os convênios ligados às emendas do parlamentar {(primeiroAnoDaEmenda == ultimoAnoDaEmenda ? $"de {primeiroAnoDaEmenda}" : $"de {primeiroAnoDaEmenda} a {ultimoAnoDaEmenda}")}, do arquivo de emendas do Portal da Transparência.";

    public const string Parlamentar =
        "O cadastro do parlamentar (nome, foto e identificação na fonte), do arquivo da Câmara ou da lista do Senado que o gravou por último, e as redes sociais, da Câmara para deputados e do TSE para senadores.";

    public const string CadastroDoParlamentar = "cadastro: nome, foto e identificação na fonte";

    public static string Gestoes(Periodo<AnoDoOrcamento> periodo) =>
        $"Quem governou {periodo.Texto}: presidente, vice, partidos e coligação, do arquivo de candidatos do TSE da eleição de cada gestão.";

    public static string Ementas(Legislatura legislatura) =>
        $"As proposições das votações em que esta pessoa votou na {legislatura}ª legislatura: número, ementa e assunto, do arquivo de proposições votadas da Câmara ou das matérias do Senado.";

    public static string Populacao(Uf? uf) =>
        $"A população estimada pelo IBGE em cada município{(uf is { } escolhida ? $" de {escolhida.Sigla}" : " do país")}, o divisor do mapa por habitante, da tabela 6579 do SIDRA.";

    public static string GovernoGastos(Periodo<AnoDoOrcamento> periodoDoOrcamento) =>
        $"O gasto pago do Poder Executivo federal {periodoDoOrcamento.Texto}, do arquivo anual do orçamento do Portal da Transparência, uma linha por ano e função, mais os Encargos especiais por subfunção. "
        + "Os restos a pagar pagos somados vêm dos arquivos mensais de execução.";

    public const string Entidade =
        "Os pagamentos de emenda a este CNPJ, de todos os anos carregados, do Portal da Transparência, "
        + "uma linha por emenda, mês e favorecido. Repasse feito por intermediário (como o Banco do Brasil) fica de fora.";

    public static string Painel(TipoCasa casa, Legislatura legislatura) =>
        $"As votações de plenário da {legislatura}ª legislatura {(casa == TipoCasa.CAMARA ? "na Câmara" : "no Senado")} com voto nominal "
        + "registrado, uma linha por votação. É a mesma conta do painel: votação de comissão e votação sem voto nominal ficam de fora.";

    /// <summary>O órgão por extenso.</summary>
    public static string Orgao(TipoFonteDeCarga fonte) => fonte switch
    {
        TipoFonteDeCarga.CAMARA => "Câmara dos Deputados",
        TipoFonteDeCarga.SENADO => "Senado Federal",
        TipoFonteDeCarga.TSE => "Tribunal Superior Eleitoral",
        TipoFonteDeCarga.PORTAL_TRANSPARENCIA => "Controladoria-Geral da União, Portal da Transparência",
        TipoFonteDeCarga.RECEITA => "Receita Federal",
        _ => "IBGE"
    };

    /// <summary>A norma que obriga o órgão a publicar o dado, pelo conjunto de dados quando há norma própria.</summary>
    /// <remarks>
    /// <para>O conjunto sai da URL do arquivo: a cota da Câmara, a declaração de bens e a prestação de contas do TSE têm norma específica; o resto fica na norma do órgão.</para>
    /// <para>ATENÇÃO: as citações por artigo pedem conferência do autor antes de irem ao texto do TCC (Pendência 73).</para>
    /// </remarks>
    public static string BaseLegal(TipoFonteDeCarga fonte, string url) => fonte switch
    {
        TipoFonteDeCarga.CAMARA when url.Contains("/cotas/", StringComparison.Ordinal) =>
            "Ato da Mesa 43/2009 da Câmara (cota para o exercício da atividade parlamentar) e Lei 12.527/2011, art. 8º",
        TipoFonteDeCarga.CAMARA or TipoFonteDeCarga.SENADO =>
            "Lei 12.527/2011 (Lei de Acesso à Informação), art. 8º",
        TipoFonteDeCarga.TSE when url.Contains("bem_candidato", StringComparison.Ordinal) =>
            "Lei 9.504/1997 (Lei das Eleições), art. 11, § 1º, IV: a declaração de bens do candidato",
        TipoFonteDeCarga.TSE =>
            "Lei 9.504/1997 (Lei das Eleições), art. 28, § 4º: a divulgação das contas de campanha",
        TipoFonteDeCarga.PORTAL_TRANSPARENCIA =>
            "Lei Complementar 101/2000, art. 48-A, incluído pela Lei Complementar 131/2009 (Lei da Transparência)",
        TipoFonteDeCarga.IBGE =>
            "Lei 8.443/1992, art. 102: a estimativa anual da população por município",
        _ => "Decreto 8.777/2016 (Política de Dados Abertos do Executivo federal)"
    };

    public const string ContextoSemParametro =
        "O contexto pedido precisa de um parâmetro que não veio: idPessoa, casa, período ou CNPJ.";
}
