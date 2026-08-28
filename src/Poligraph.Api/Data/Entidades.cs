namespace Poligraph.Api.Data;

/// <summary>Parlamentar. Identidade própria do projeto, mapeada para os IDs externos.</summary>
public class PessoaModel
{
    public long Id { get; set; }
    public required string NomeCivil { get; set; }
    public required string NomeExibicao { get; set; }
    public DateOnly? DataNascimento { get; set; }
    public Sexo? Sexo { get; set; }

    /// <summary>⛔ NUNCA o CPF em claro — RNF-13.</summary>
    public string? CpfHash { get; set; }

    /// <summary>
    /// URL da foto oficial, na própria Câmara.
    ///
    /// 🔴 Guardamos a URL, ⛔ NÃO a imagem. A diferença é jurídica, não de espaço:
    /// **linkar** e **rehospedar** são atos diferentes perante licença e LGPD, e
    /// rehospedar foto de pessoa é decisão que este trabalho ainda não tomou.
    ///
    /// ⚠️ Consequência aceita: se a Câmara mudar o padrão de URL, as fotos somem da
    /// tela. `Avatar.tsx` cai para as iniciais sozinho — por isso o `onError` existe.
    /// </summary>
    public string? UrlFoto { get; set; }

    /// <summary>
    /// Exclusão lógica. `null` = ativo.
    ///
    /// 🔴 Parlamentar ⛔ NUNCA é apagado de verdade. O voto dele é registro histórico e
    /// público: apagar a pessoa levaria junto — por `CASCADE` — o nó no grafo, as
    /// arestas e as similaridades de toda execução já feita, inclusive as que a banca
    /// pode querer reproduzir.
    ///
    /// ⚠️ Isto ⛔ NÃO vale para `usuario` nem `segue`, e a diferença é jurídica, não de
    /// gosto — ver `EndpointsAutenticacao.ExcluirContaAsync`.
    /// </summary>
    public DateTimeOffset? ExcluidoEm { get; set; }

    public List<PessoaFonteIdModel> FontesId { get; set; } = [];
    public List<VotoModel> Votos { get; set; } = [];
}

/// <summary>
/// Liga a pessoa ao ID dela em cada fonte. `Metodo` e `Confianca` não são enfeite:
/// são o resultado do objetivo específico #2, reportável no TCC.
/// </summary>
public class PessoaFonteIdModel
{
    public long PessoaId { get; set; }
    public PessoaModel? Pessoa { get; set; }

    public FonteDeIdentificador Fonte { get; set; }
    public required string IdExterno { get; set; }
    public MetodoDeVinculo Metodo { get; set; }
    public float? Confianca { get; set; }
}

/// <summary>Uma votação nominal. O Id é texto: "2456731-84" (achado #3).</summary>
public class VotacaoModel
{
    public required string Id { get; set; }
    public Casa Casa { get; set; }
    public short Legislatura { get; set; }
    public DateOnly Data { get; set; }
    public string? Orgao { get; set; }
    public string? Descricao { get; set; }

    public long? ProposicaoId { get; set; }
    public ProposicaoModel? Proposicao { get; set; }

    public CategoriaDeVotacao Categoria { get; set; }

    /// <summary>🔴 Senado: 56% das votações são secretas — registram "Votou", não posição.</summary>
    public bool Secreta { get; set; }

    public bool Plenario { get; set; }
    public int? VotosSim { get; set; }
    public int? VotosNao { get; set; }

    public List<VotoModel> Votos { get; set; } = [];
}

/// <summary>
/// O voto de uma pessoa numa votação.
/// `PartidoNoVoto` e `UfNoVoto` são desnormalizados DE PROPÓSITO: são registro histórico.
/// </summary>
public class VotoModel
{
    public required string VotacaoId { get; set; }
    public VotacaoModel? Votacao { get; set; }

    public long PessoaId { get; set; }
    public PessoaModel? Pessoa { get; set; }

    /// <summary>+1 sim · -1 não · 0 abstenção · NULL fora do cálculo — RN-03.</summary>
    public short? Valor { get; set; }

    public required string PartidoNoVoto { get; set; }
    public required string UfNoVoto { get; set; }
}

public class ProposicaoModel
{
    public long Id { get; set; }
    public string? SiglaTipo { get; set; }
    public int? Numero { get; set; }
    public short? Ano { get; set; }
    public string? Ementa { get; set; }
    public string? UrlInteiroTeor { get; set; }
}

/// <summary>PerguntaModel do questionário. Curadoria manual — PL11.</summary>
public class PerguntaModel
{
    /// <summary>"q1" — ⚠️ nunca expor o idVotacao ao cidadão.</summary>
    public required string Id { get; set; }

    public required string VotacaoId { get; set; }
    public VotacaoModel? Votacao { get; set; }

    /// <summary>Afirmação em linguagem leiga. Formato: "X deve ser Y."</summary>
    public required string Texto { get; set; }

    /// <summary>
    /// 🔴 O campo mais perigoso do sistema. +1 = "Sim" aprova a afirmação;
    /// -1 = "Sim" a rejeita (destaque). Hoje sempre +1 — só texto principal.
    /// </summary>
    public short Polaridade { get; set; }

    public short Ordem { get; set; }
    public bool Ativa { get; set; } = true;
}

/// <summary>Uma rodada do ETL analítico. Dá reprodutibilidade às figuras do TCC.</summary>
/// <summary>
/// Uma despesa da cota parlamentar (CEAP).
///
/// ⚠️ Vem do arquivo em bloco `www.camara.leg.br/cotas/Ano-{ano}.csv.zip`, ⛔ NÃO da
/// API — `/deputados/{id}/despesas` responde 200 e devolve lista vazia para todo
/// deputado e todo ano testado. Ver <see href="../../docs/14-fontes-de-gasto.md"/>.
///
/// ⭐ Liga a `pessoas` por `ideCadastro`, que é o MESMO id da Câmara que o projeto já
/// usa em `pessoa_fonte_ids` — a ligação sai de graça.
/// </summary>
public class DespesaModel
{
    public long Id { get; set; }
    public long PessoaId { get; set; }

    public short Ano { get; set; }
    public short Mes { get; set; }

    /// <summary>A subcota — "PASSAGEM AÉREA", "COMBUSTÍVEIS", "DIVULGAÇÃO…"</summary>
    public required string Categoria { get; set; }

    public string? Fornecedor { get; set; }

    /// <summary>
    /// 🔴 CNPJ do fornecedor **ou hash**, quando é pessoa física.
    ///
    /// ⚠️ O campo `txtCNPJCPF` do CSV mistura os dois: fornecedor pessoa jurídica traz
    /// CNPJ, fornecedor pessoa física traz **CPF em claro**. A RNF-13 proíbe guardar CPF
    /// assim, então o ETL aplica o mesmo hash de `PessoaModel.CpfHash` quando detecta 11
    /// dígitos. CNPJ (14 dígitos) é dado público de empresa e fica em claro.
    /// </summary>
    public string? CnpjOuHash { get; set; }

    /// <summary>⚠️ `true` quando `CnpjOuHash` é hash de CPF — sem isto ninguém sabe.</summary>
    public bool FornecedorEhPessoaFisica { get; set; }

    /// <summary>Já descontada a glosa — é o que o erário efetivamente pagou.</summary>
    public decimal ValorLiquido { get; set; }

    public DateOnly? DataEmissao { get; set; }

    /// <summary>Link para o documento fiscal na Câmara. ⭐ É o que torna auditável.</summary>
    public string? UrlDocumento { get; set; }

    public PessoaModel? Pessoa { get; set; }
}

/// <summary>
/// Uma receita de campanha eleitoral — inclui o **fundo eleitoral**.
///
/// ⭐ Liga a `pessoas` por **hash de CPF**, que é chave forte: o teste contra o Amapá
/// casou **15 de 15**, contra 14 de 15 do nome civil.
///
/// ⚠️ Fonte: `prestacao_de_contas_eleitorais_candidatos_{ano}.zip` do TSE — 377 MB,
/// Latin-1, um CSV por UF. Ver <see href="../../docs/14-fontes-de-gasto.md"/>.
/// </summary>
public class ReceitaDeCampanhaModel
{
    public long Id { get; set; }
    public long PessoaId { get; set; }

    /// <summary>Ano da ELEIÇÃO, ⛔ não do exercício. 2022 elegeu a legislatura 57.</summary>
    public short AnoEleicao { get; set; }

    /// <summary>
    /// 🔴 O "fundão" — FEFC, criado em 2017.
    ///
    /// ⚠️ **O valor tem de ser idêntico ao de `receitas.FUNDO_ESPECIAL` no ETL Python**,
    /// que é quem grava a coluna. Divergir de uma letra faria o total do fundão sair
    /// **zero** na ficha, sem erro nenhum. `test_contrato_schema.py` compara os dois.
    /// </summary>
    public const string FonteFundoEspecial = "FUNDO ESPECIAL";

    /// <summary>🔴 Fundo **Partidário** — permanente, ⛔ NÃO é o fundão.</summary>
    public const string FonteFundoPartidario = "FUNDO PARTIDARIO";

    /// <summary>
    /// 🔴 <see cref="FonteFundoEspecial"/> é o "fundão"; <see cref="FonteFundoPartidario"/>
    /// é outro fundo.
    ///
    /// ⚠️ O CSV os separa, e somá-los como "dinheiro público de campanha" é defensável
    /// mas precisa ser dito — ⛔ não são a mesma coisa.
    /// </summary>
    public required string FonteReceita { get; set; }

    /// <summary>"Recursos de partido político", "Recursos de pessoas físicas"…</summary>
    public string? OrigemReceita { get; set; }

    public string? Doador { get; set; }

    /// <summary>🔴 CNPJ do doador **ou hash**, quando pessoa física — como em `DespesaModel`.</summary>
    public string? DoadorCnpjOuHash { get; set; }

    public bool DoadorEhPessoaFisica { get; set; }

    public decimal Valor { get; set; }

    public PessoaModel? Pessoa { get; set; }
}

/// <summary>
/// Uma emenda parlamentar — o instrumento de poder orçamentário do parlamentar.
///
/// 🔴 **A chave é o CÓDIGO DO AUTOR, ⛔ não o nome.** O `codigoEmenda` do Portal embute
/// um identificador estável:
///
/// <code>
/// 202541840004
///  │   │    └── numeroEmenda
///  │   └─────── 4184 ← código do autor
///  └─────────── ano
/// </code>
///
/// **Medido:** 173 de 173 autores com código estável dentro do ano, **zero colisões**.
/// Entre 2023 e 2025, mudou para dois — ⭐ e os dois viraram **senadores**, o que
/// confirma a chave: ela identifica o **mandato**, e por isso é estável dentro dele.
///
/// ⚠️ **`PessoaId` é ANULÁVEL de propósito.** A emenda é ingerida mesmo sem dono
/// conhecido — senador, emenda de bancada, parlamentar de outra legislatura. Perder o
/// registro por não saber ligar seria pior: o dado deixa de existir, e a reconciliação
/// futura não tem o que reconciliar.
/// </summary>
public class EmendaModel
{
    public long Id { get; set; }

    /// <summary>⚠️ `null` enquanto o autor não foi reconciliado — ver o resumo acima.</summary>
    public long? PessoaId { get; set; }

    /// <summary>🔴 A chave do Portal. ⭐ Serve para Câmara **e** Senado.</summary>
    public required string CodigoAutor { get; set; }

    /// <summary>⚠️ Guardado para a reconciliação e para auditoria — ⛔ não é chave.</summary>
    public required string NomeAutor { get; set; }

    /// <summary>Código completo do Portal — ⭐ torna a linha rastreável na fonte.</summary>
    public required string CodigoEmenda { get; set; }

    public short Ano { get; set; }

    /// <summary>"EmendaModel Individual — Transferências com Finalidade Definida" etc.</summary>
    public string? Tipo { get; set; }

    /// <summary>⭐ Para ONDE o dinheiro foi — município ou "Nacional".</summary>
    public string? Localidade { get; set; }

    public string? Funcao { get; set; }
    public string? Subfuncao { get; set; }

    /// <summary>⚠️ Pode ser NEGATIVO — é cancelamento de empenho.</summary>
    public decimal ValorEmpenhado { get; set; }

    public decimal ValorLiquidado { get; set; }

    /// <summary>⭐ A distância entre empenhado e pago é o que a análise procura.</summary>
    public decimal ValorPago { get; set; }

    /// <summary>
    /// ⚠️ Resto a pagar de exercícios ANTERIORES — pode ser muito maior que o pago do
    /// ano. ⛔ Somar como se fosse do ano corrente inflaria o número na ficha.
    /// </summary>
    public decimal ValorRestoPago { get; set; }

    public PessoaModel? Pessoa { get; set; }
}

/// <summary>
/// Liga o código de autor do Portal a uma pessoa nossa.
///
/// ⭐ **É a tabela que o autor pediu ao dispensar o casamento por nome:** ingere-se tudo
/// primeiro, resolve-se depois. Um código sem `pessoa_id` fica visível como pendência de
/// reconciliação, ⛔ em vez de virar registro perdido.
///
/// ⚠️ Serve para Senado também — o Portal usa o mesmo esquema de código para as duas
/// casas.
/// </summary>
public class AutorDeEmendaModel
{
    /// <summary>O código extraído do `codigoEmenda`.</summary>
    public required string Codigo { get; set; }

    /// <summary>⚠️ Última grafia vista — muda; o código, não.</summary>
    public required string NomeAutor { get; set; }

    /// <summary>`null` = ainda não reconciliado.</summary>
    public long? PessoaId { get; set; }

    public MetodoDeAutor Metodo { get; set; }

    public DateTimeOffset AtualizadoEm { get; set; }

    public PessoaModel? Pessoa { get; set; }
}

public class ExecucaoModel
{
    public long Id { get; set; }
    public Casa Casa { get; set; }
    public short Legislatura { get; set; }

    /// <summary>k do kNN — 10 por decisão medida.</summary>
    public short K { get; set; }

    public required string VersaoCarga { get; set; }
    public DateTimeOffset IniciadaEm { get; set; }
    public DateTimeOffset? ConcluidaEm { get; set; }
    public StatusDaExecucao Status { get; set; }
}

/// <summary>SimilaridadeModel entre dois parlamentares da MESMA casa. Escrita pelo Python.</summary>
public class SimilaridadeModel
{
    public long ExecucaoId { get; set; }
    public long PessoaA { get; set; }
    public long PessoaB { get; set; }

    public Metrica Metrica { get; set; }

    public float Valor { get; set; }

    /// <summary>🔴 Mínimo de 20 — RN-02. Abaixo disso o par é descartado.</summary>
    public int NVotacoesComuns { get; set; }
}

/// <summary>Aresta do grafo. Três tipos em CAMADAS — ⛔ não somar os pesos.</summary>
public class ArestaGrafoModel
{
    public long ExecucaoId { get; set; }
    public long PessoaA { get; set; }
    public long PessoaB { get; set; }

    public TipoDeAresta Tipo { get; set; }

    public float Peso { get; set; }
}

/// <summary>Métricas do nó, por execução.</summary>
/// <summary>
/// Como uma bancada orientou o voto numa votação.
///
/// <para>
/// 🔴 <b>É o que permite medir governismo e disciplina.</b> Sem ela, saber que um
/// deputado votou "Sim" ⛔ não diz nada sobre alinhamento: só comparando com o que a
/// liderança dele — e a do Governo — pediu é que "Sim" vira posição.
/// </para>
///
/// <para>
/// ⚠️ <c>Bancada</c> mistura três naturezas no mesmo campo, porque a fonte mistura:
/// partido (<c>PT</c>), bloco (<c>Bl AvanSolidPrd</c>) e posição na Casa
/// (<c>Governo</c>, <c>Oposição</c>, <c>Minoria</c>, <c>Maioria</c>). Separar aqui
/// exigiria uma taxonomia nossa sobre dado da Câmara — a distinção é feita na leitura.
/// </para>
///
/// <para>
/// ⚠️ ⛔ Só existe para a CÂMARA. O Senado ⛔ não publica orientação de bancada.
/// </para>
/// </summary>
public class OrientacaoModel
{
    public required string VotacaoId { get; set; }
    public VotacaoModel? Votacao { get; set; }

    /// <summary>Partido, bloco ou posição na Casa — ver a nota da classe.</summary>
    public required string Bancada { get; set; }

    /// <summary>
    /// Sim | Não | Obstrução | Liberado | Abstenção.
    ///
    /// ⚠️ ⛔ NÃO é enum: a Câmara publica string vazia em 24% das linhas e o conjunto
    /// ⛔ não é fechado por contrato nenhum. Fechá-lo num tipo faria a ingestão inteira
    /// estourar no dia em que aparecer um valor novo — e o dado é ANUAL, então isso
    /// seria descoberto meses depois.
    /// </summary>
    public required string Orientacao { get; set; }
}

public class NoMetricaModel
{
    public long ExecucaoId { get; set; }
    public long PessoaId { get; set; }

    public short? Comunidade { get; set; }

    /// <summary>Posição no DESENHO — layout de molas. ⛔ Sem interpretação.</summary>
    public float? EixoX { get; set; }
    public float? EixoY { get; set; }

    /// <summary>
    /// 1ª componente principal (SVD) — ⭐ o eixo que SIGNIFICA alguma coisa.
    ///
    /// ⚠️ Convive com `EixoX` de propósito (PL43): molas desenham bem, componentes
    /// interpretam. Qual das duas a tela usa é decisão em aberto.
    /// </summary>
    public float? Componente1 { get; set; }

    /// <summary>2ª componente principal.</summary>
    public float? Componente2 { get; set; }

    /// <summary>⚠️ NULL no Senado — não existe orientação de bancada.</summary>
    public float? Governismo { get; set; }

    /// <summary>⚠️ NULL no Senado — idem.</summary>
    public float? Disciplina { get; set; }

    public int NVotacoes { get; set; }
}
