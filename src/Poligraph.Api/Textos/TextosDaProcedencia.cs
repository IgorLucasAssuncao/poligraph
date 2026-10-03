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

    public static string Cota(int de, int ate, CategoriaDeDespesa? categoria) =>
        $"Os lançamentos da cota parlamentar desta pessoa em {(de == ate ? $"{de}" : $"{de} a {ate}")}"
        + (categoria is null ? "" : $", na categoria \"{categoria}\"")
        + ", pelo valor líquido. Estorno entra negativo.";

    public static string Emendas(int de, int ate) =>
        $"As emendas {(de == ate ? $"de {de}" : $"de {de} a {ate}")} atribuídas a esta pessoa pelo código de autor, uma linha por "
        + "emenda e localidade, pelo valor empenhado. Só entra emenda com autor reconciliado.";

    public static string Campanha(int eleicao) =>
        $"As receitas da campanha de {eleicao} desta pessoa, ao cargo da casa em que ela votou. "
        + "O documento do doador pessoa física fica guardado só como hash.";

    public static string Patrimonio(int eleicao) =>
        $"Os bens declarados ao TSE na candidatura de {eleicao}, somados por tipo. "
        + "É autodeclaração: o TSE publica o que o candidato informou.";

    public static string Pagamentos(Periodo periodo, Uf? uf, CodigoIbge? municipio)
    {
        var lugar = municipio is not null ? ", a quem tem sede nesta cidade" : uf is { } sigla ? $", a quem tem sede em {sigla}" : "";
        return $"Os pagamentos das emendas {periodo.Texto}{lugar}, do Portal da Transparência, "
            + "uma linha por emenda, mês e favorecido. O ano é o da emenda, e o pagamento pode ser de anos depois."
            + (lugar == "" ? "" : " A sede vem do cadastro de CNPJ da Receita Federal.");
    }

    public static string GovernoReceitas(Periodo periodo) =>
        $"A receita realizada do Poder Executivo federal {periodo.Texto}, por origem, do arquivo de receitas do Portal da Transparência, uma linha por ano, categoria e origem. "
        + "O que foi pego emprestado é a origem \"operações de crédito\" desse mesmo arquivo.";

    public static string GovernoSigiloso(Periodo periodo) =>
        $"O gasto sigiloso {periodo.Texto}: cartão corporativo e ações marcadas como sigilosas, por órgão, dos arquivos mensais do Portal.";

    public static string GovernoGastos(Periodo periodo) =>
        $"O gasto pago do Poder Executivo federal {periodo.Texto}, do arquivo anual do orçamento do Portal da Transparência, uma linha por ano e função, mais os Encargos especiais por subfunção. "
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
        "O contexto pedido precisa de um parâmetro que não veio: pessoa, casa, período ou CNPJ.";
}
