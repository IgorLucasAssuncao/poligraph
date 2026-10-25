namespace Poligraph.Api.Dtos;

/// <summary>
/// Os parâmetros do método, lidos de onde o cálculo os lê.
/// </summary>
/// <remarks>
/// <para>
/// O questionário e a afinidade vêm das constantes da API, que são as que calculam. O grafo
/// vem da execução do ETL que o desenhou: cada execução grava os parâmetros que usou, e a
/// página mostra os da mais recente de cada casa. Nenhum número desta resposta é escrito à
/// mão.
/// </para>
/// </remarks>
public record MetodologiaDto(
    QuestionarioNaMetodologiaDto Questionario,
    AfinidadeNaMetodologiaDto Afinidade,
    IReadOnlyList<CasaNaMetodologiaDto> Casas);

/// <summary>Quantas perguntas o cidadão responde, e quantas precisa opinar para haver resultado.</summary>
public record QuestionarioNaMetodologiaDto(
    int PerguntasDaCamara,
    int AberturaDaCamara,
    int DesempateDaCamara,
    int PerguntasDoSenado,
    double FracaoMinimaDeRespostas,
    int MinimoDeRespostas);

/// <summary>Quantos parlamentares a tela mostra, e quantos vizinhos posicionam o cidadão no grafo.</summary>
public record AfinidadeNaMetodologiaDto(int QuantidadeExibida, int VizinhosParaPosicionar);

/// <summary>
/// Uma casa: as votações da legislatura e os parâmetros da execução que desenhou o grafo.
/// </summary>
/// <remarks>
/// <para>Os parâmetros são nulos em execução anterior a 2026-09-25, quando passaram a ser gravados.</para>
/// </remarks>
public record CasaNaMetodologiaDto(
    string Casa,
    int Legislatura,
    int Votacoes,
    int VotacoesSecretas,
    DateTimeOffset? AnaliseConcluidaEm,
    int? VizinhosPorNo,
    int? MinimoVotacoesComuns,
    double? RazaoRecencia,
    double? PesoDestaque,
    double? PesoAutoridade);
