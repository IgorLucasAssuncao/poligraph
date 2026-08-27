namespace Poligraph.Api.Data;

/// <summary>Parlamentar. Identidade própria do projeto, mapeada para os IDs externos.</summary>
public class Pessoa
{
    public long Id { get; set; }
    public required string NomeCivil { get; set; }
    public required string NomeExibicao { get; set; }
    public DateOnly? DataNascimento { get; set; }
    public string? Sexo { get; set; }

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

    public List<PessoaFonteId> FontesId { get; set; } = [];
    public List<Voto> Votos { get; set; } = [];
}

/// <summary>
/// Liga a pessoa ao ID dela em cada fonte. `Metodo` e `Confianca` não são enfeite:
/// são o resultado do objetivo específico #2, reportável no TCC.
/// </summary>
public class PessoaFonteId
{
    public long PessoaId { get; set; }
    public Pessoa? Pessoa { get; set; }

    public required string Fonte { get; set; }       // CAMARA | SENADO | TSE
    public required string IdExterno { get; set; }
    public required string Metodo { get; set; }      // CPF | FUZZY | MANUAL
    public float? Confianca { get; set; }
}

/// <summary>Uma votação nominal. O Id é texto: "2456731-84" (achado #3).</summary>
public class Votacao
{
    public required string Id { get; set; }
    public required string Casa { get; set; }        // CAMARA | SENADO
    public short Legislatura { get; set; }
    public DateOnly Data { get; set; }
    public string? Orgao { get; set; }
    public string? Descricao { get; set; }

    public long? ProposicaoId { get; set; }
    public Proposicao? Proposicao { get; set; }

    /// <summary>PROCEDIMENTAL | DESTAQUE | SUBSTANTIVA | AUTORIDADE</summary>
    public required string Categoria { get; set; }

    /// <summary>🔴 Senado: 56% das votações são secretas — registram "Votou", não posição.</summary>
    public bool Secreta { get; set; }

    public bool Plenario { get; set; }
    public int? VotosSim { get; set; }
    public int? VotosNao { get; set; }

    public List<Voto> Votos { get; set; } = [];
}

/// <summary>
/// O voto de uma pessoa numa votação.
/// `PartidoNoVoto` e `UfNoVoto` são desnormalizados DE PROPÓSITO: são registro histórico.
/// </summary>
public class Voto
{
    public required string VotacaoId { get; set; }
    public Votacao? Votacao { get; set; }

    public long PessoaId { get; set; }
    public Pessoa? Pessoa { get; set; }

    /// <summary>+1 sim · -1 não · 0 abstenção · NULL fora do cálculo — RN-03.</summary>
    public short? Valor { get; set; }

    public required string PartidoNoVoto { get; set; }
    public required string UfNoVoto { get; set; }
}

public class Proposicao
{
    public long Id { get; set; }
    public string? SiglaTipo { get; set; }
    public int? Numero { get; set; }
    public short? Ano { get; set; }
    public string? Ementa { get; set; }
    public string? UrlInteiroTeor { get; set; }
}

/// <summary>Pergunta do questionário. Curadoria manual — PL11.</summary>
public class Pergunta
{
    /// <summary>"q1" — ⚠️ nunca expor o idVotacao ao cidadão.</summary>
    public required string Id { get; set; }

    public required string VotacaoId { get; set; }
    public Votacao? Votacao { get; set; }

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
public class Despesa
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
    /// assim, então o ETL aplica o mesmo hash de `Pessoa.CpfHash` quando detecta 11
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

    public Pessoa? Pessoa { get; set; }
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
public class ReceitaDeCampanha
{
    public long Id { get; set; }
    public long PessoaId { get; set; }

    /// <summary>Ano da ELEIÇÃO, ⛔ não do exercício. 2022 elegeu a legislatura 57.</summary>
    public short AnoEleicao { get; set; }

    /// <summary>
    /// 🔴 `FUNDO ESPECIAL` é o "fundão" (FEFC); `FUNDO PARTIDARIO` é outro fundo.
    ///
    /// ⚠️ O CSV os separa, e somá-los como "dinheiro público de campanha" é defensável
    /// mas precisa ser dito — ⛔ não são a mesma coisa.
    /// </summary>
    public required string FonteReceita { get; set; }

    /// <summary>"Recursos de partido político", "Recursos de pessoas físicas"…</summary>
    public string? OrigemReceita { get; set; }

    public string? Doador { get; set; }

    /// <summary>🔴 CNPJ do doador **ou hash**, quando pessoa física — como em `Despesa`.</summary>
    public string? DoadorCnpjOuHash { get; set; }

    public bool DoadorEhPessoaFisica { get; set; }

    public decimal Valor { get; set; }

    public Pessoa? Pessoa { get; set; }
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
public class Emenda
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

    /// <summary>"Emenda Individual — Transferências com Finalidade Definida" etc.</summary>
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

    public Pessoa? Pessoa { get; set; }
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
public class AutorDeEmenda
{
    /// <summary>O código extraído do `codigoEmenda`.</summary>
    public required string Codigo { get; set; }

    /// <summary>⚠️ Última grafia vista — muda; o código, não.</summary>
    public required string NomeAutor { get; set; }

    /// <summary>`null` = ainda não reconciliado.</summary>
    public long? PessoaId { get; set; }

    /// <summary>`AUTOMATICO` (nome normalizado) | `MANUAL` | `NAO_RESOLVIDO`</summary>
    public required string Metodo { get; set; }

    public DateTimeOffset AtualizadoEm { get; set; }

    public Pessoa? Pessoa { get; set; }
}

public class Execucao
{
    public long Id { get; set; }
    public required string Casa { get; set; }
    public short Legislatura { get; set; }

    /// <summary>k do kNN — 10 por decisão medida.</summary>
    public short K { get; set; }

    public required string VersaoCarga { get; set; }
    public DateTimeOffset IniciadaEm { get; set; }
    public DateTimeOffset? ConcluidaEm { get; set; }
    public required string Status { get; set; }      // EM_ANDAMENTO | CONCLUIDA | FALHOU
}

/// <summary>Similaridade entre dois parlamentares da MESMA casa. Escrita pelo Python.</summary>
public class Similaridade
{
    public long ExecucaoId { get; set; }
    public long PessoaA { get; set; }
    public long PessoaB { get; set; }

    /// <summary>CONCORDANCIA | COSSENO — as duas são calculadas (RF-18).</summary>
    public required string Metrica { get; set; }

    public float Valor { get; set; }

    /// <summary>🔴 Mínimo de 20 — RN-02. Abaixo disso o par é descartado.</summary>
    public int NVotacoesComuns { get; set; }
}

/// <summary>Aresta do grafo. Três tipos em CAMADAS — ⛔ não somar os pesos.</summary>
public class ArestaGrafo
{
    public long ExecucaoId { get; set; }
    public long PessoaA { get; set; }
    public long PessoaB { get; set; }

    /// <summary>SIMILARIDADE_VOTO | COMISSAO_COMUM | COAUTORIA</summary>
    public required string Tipo { get; set; }

    public float Peso { get; set; }
}

/// <summary>Métricas do nó, por execução.</summary>
public class NoMetrica
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
