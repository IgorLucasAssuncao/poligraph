using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Data;

namespace Poligraph.Migrations;

/// <summary>
/// Dados de teste para desenvolvimento local.
///
/// ⛔ NUNCA use HasData() do EF para isto: HasData entra dentro da migration, e a
/// migration roda em produção — os deputados fictícios iriam para o ar.
///
/// ⚠️ O seed PRECISA conter perguntas de polaridade -1. Semear só polaridade +1 faz o
/// bug mais perigoso do sistema ficar invisível durante todo o desenvolvimento.
/// </summary>
public static class SemeadorDesenvolvimento
{
    private const short Legislatura = 57;

    public static async Task SemearAsync(PoligraphDb db, CancellationToken ct = default)
    {
        // guarda de idempotência: já semeado, sai
        if (await db.Pessoas.AnyAsync(ct)) return;

        var pessoas = GerarParlamentares();
        db.Pessoas.AddRange(pessoas);

        var proposicoes = GerarProposicoes();
        db.Proposicoes.AddRange(proposicoes);

        var votacoes = GerarVotacoes(proposicoes);
        db.Votacoes.AddRange(votacoes);

        await db.SaveChangesAsync(ct);

        var votos = GerarVotos(pessoas, votacoes);
        ContabilizarPlacar(votacoes, votos);

        db.Votos.AddRange(votos);
        db.Perguntas.AddRange(GerarPerguntas(votacoes));

        await db.SaveChangesAsync(ct);
    }

    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// Preenche `votos_sim` / `votos_nao` a partir dos votos gerados.
    ///
    /// ⚠️ Contado, ⛔ nunca escrito à mão: número fixo no seed sai de sincronia com o
    /// padrão de votos na primeira vez que alguém mexer na matriz, e aí a tela do
    /// questionário passa a afirmar um comparecimento que não existe no banco.
    ///
    /// Em produção quem preenche é a ingestão, com o placar oficial da Câmara.
    /// </summary>
    private static void ContabilizarPlacar(List<Votacao> votacoes, List<Voto> votos)
    {
        foreach (var votacao in votacoes)
        {
            var daVotacao = votos.Where(v => v.VotacaoId == votacao.Id).ToList();

            votacao.VotosSim = daVotacao.Count(v => v.Valor == 1);
            votacao.VotosNao = daVotacao.Count(v => v.Valor == -1);
        }
    }

    private static List<Pessoa> GerarParlamentares()
    {
        // 12 deputados fictícios em 3 blocos de voto, para o grafo ter estrutura visível
        string[] nomes =
        [
            "Ana Ribeiro", "Bruno Tavares", "Carla Nunes", "Diego Salles",
            "Elisa Moraes", "Fábio Lins", "Gabriela Rocha", "Heitor Prado",
            "Isabel Queiroz", "João Bastos", "Karina Melo", "Lucas Ferraz"
        ];

        return [.. nomes.Select((nome, i) => new Pessoa
        {
            NomeCivil = nome,
            NomeExibicao = nome,
            DataNascimento = new DateOnly(1970 + i, 3, 15),
            Sexo = i % 2 == 0 ? "F" : "M"
        })];
    }

    private static List<Proposicao> GerarProposicoes() =>
    [
        new() { Id = 900001, SiglaTipo = "PL",  Numero = 2162, Ano = 2023,
                Ementa = "Concede anistia aos participantes das manifestações de 8 de janeiro." },
        new() { Id = 900002, SiglaTipo = "PL",  Numero = 2159, Ano = 2021,
                Ementa = "Dispõe sobre o licenciamento ambiental." },
        new() { Id = 900003, SiglaTipo = "PL",  Numero = 1112, Ano = 2023,
                Ementa = "Estabelece cumprimento mínimo de 80% da pena para crimes hediondos." },
        new() { Id = 900004, SiglaTipo = "PLP", Numero = 243,  Ano = 2023,
                Ementa = "Incentivo à permanência de estudantes no ensino médio." },
        new() { Id = 900005, SiglaTipo = "PL",  Numero = 5496, Ano = 2013,
                Ementa = "Dispõe sobre o contrato de trabalho por prazo determinado." },
    ];

    private static List<Votacao> GerarVotacoes(List<Proposicao> proposicoes) =>
    [
        Votacao("900001-1", proposicoes[0], "SUBSTANTIVA", new(2025, 12, 9),
                "Aprovado o Projeto de Lei nº 2.162, de 2023."),
        Votacao("900002-1", proposicoes[1], "SUBSTANTIVA", new(2025, 7, 16),
                "Aprovado o Substitutivo ao Projeto de Lei nº 2.159, de 2021."),
        Votacao("900003-1", proposicoes[2], "SUBSTANTIVA", new(2025, 7, 2),
                "Aprovado o Substitutivo ao Projeto de Lei nº 1.112, de 2023."),
        Votacao("900004-1", proposicoes[3], "SUBSTANTIVA", new(2023, 12, 13),
                "Aprovado o Projeto de Lei Complementar nº 243, de 2023."),
        // 🔴 DESTAQUE: aqui "Sim" significa MANTER o texto, ou seja, REJEITAR a supressão
        Votacao("900005-1", proposicoes[4], "DESTAQUE", new(2023, 11, 21),
                "Mantido o texto. Sim: 8; Não: 4."),
    ];

    private static Votacao Votacao(
        string id, Proposicao proposicao, string categoria, DateOnly data, string descricao) =>
        new()
        {
            Id = id,
            Casa = "CAMARA",
            Legislatura = Legislatura,
            Data = data,
            Orgao = "PLEN",
            Descricao = descricao,
            ProposicaoId = proposicao.Id,
            Categoria = categoria,
            Secreta = false,
            Plenario = true
        };

    /// <summary>
    /// Três blocos de 4 deputados. Dentro do bloco votam igual; entre blocos divergem —
    /// assim o grafo tem comunidade detectável e a afinidade tem o que separar.
    /// </summary>
    private static List<Voto> GerarVotos(List<Pessoa> pessoas, List<Votacao> votacoes)
    {
        // padrão de voto por bloco, uma coluna por votação
        short[][] padrao =
        [
            [ 1,  1,  1, -1,  1],   // bloco 0
            [-1, -1,  1,  1, -1],   // bloco 1
            [ 1, -1, -1,  1, -1],   // bloco 2
        ];

        string[] partidos = ["PARTIDO-A", "PARTIDO-B", "PARTIDO-C"];
        string[] ufs = ["SP", "MG", "BA", "RS"];

        var votos = new List<Voto>();

        for (var i = 0; i < pessoas.Count; i++)
        {
            var bloco = i / 4;

            for (var v = 0; v < votacoes.Count; v++)
            {
                // um ausente de propósito: exercita "ausência não é discordância"
                if (i == 11 && v == 4) continue;

                votos.Add(new Voto
                {
                    VotacaoId = votacoes[v].Id,
                    PessoaId = pessoas[i].Id,
                    Valor = padrao[bloco][v],
                    PartidoNoVoto = partidos[bloco],
                    UfNoVoto = ufs[i % 4]
                });
            }
        }

        return votos;
    }

    /// <summary>
    /// ⚠️ A pergunta q5 tem polaridade -1 DE PROPÓSITO — é o que mantém o caminho da
    /// inversão exercitado em desenvolvimento.
    /// </summary>
    private static List<Pergunta> GerarPerguntas(List<Votacao> votacoes) =>
    [
        Pergunta("q1", votacoes[0], 1, 1,
            "Os condenados pelos atos de 8 de janeiro de 2023 devem ser anistiados."),
        Pergunta("q2", votacoes[1], 1, 2,
            "Obras devem poder ser licenciadas por autodeclaração, sem análise prévia do órgão ambiental."),
        Pergunta("q3", votacoes[2], 1, 3,
            "Condenados por crimes hediondos devem cumprir ao menos 80% da pena antes de mudar de regime."),
        Pergunta("q4", votacoes[3], 1, 4,
            "O governo deve pagar um incentivo em dinheiro para o estudante concluir o ensino médio."),
        Pergunta("q5", votacoes[4], -1, 5,
            "Deve ser mais fácil contratar trabalhadores por prazo determinado."),
    ];

    private static Pergunta Pergunta(
        string id, Votacao votacao, short polaridade, short ordem, string texto) =>
        new()
        {
            Id = id,
            VotacaoId = votacao.Id,
            Texto = texto,
            Polaridade = polaridade,
            Ordem = ordem,
            Ativa = true
        };
}
