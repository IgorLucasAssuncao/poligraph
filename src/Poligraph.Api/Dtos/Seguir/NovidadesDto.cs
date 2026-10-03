using Poligraph.Data;

namespace Poligraph.Api.Dtos;

/// <summary>
/// "O que mudou" (Pendência 63): os cinco avisos sobre quem a pessoa segue, cada um com a janela do
/// dado. Especificação em <c>docs/plano/09 §4.1</c>.
/// </summary>
/// <param name="Semana">A janela dos avisos de voto: os 7 dias que terminam na votação mais recente da base, não no relógio.</param>
/// <param name="Atualizacoes">O último download de cada órgão, para a tela dizer de quando é o dado.</param>
public record NovidadesDto(
    PeriodoDeDiasDto Semana,
    IReadOnlyList<AtualizacaoDaFonteDto> Atualizacoes,
    IReadOnlyList<VotosNaSemanaDto> VotosNaSemana,
    IReadOnlyList<VotoContraOPartidoDto> ContraOPartido,
    IReadOnlyList<TrocaDePartidoDto> TrocasDePartido,
    IReadOnlyList<GastoNaCotaDto> GastosNaCota,
    IReadOnlyList<EmendaPagaDto> EmendasPagas);

public record PeriodoDeDiasDto(DateOnly De, DateOnly Ate);

public record AtualizacaoDaFonteDto(TipoFonteDeCarga Fonte, string Orgao, DateTimeOffset UltimaCarga);

/// <summary>A1: em quantas votações de plenário da janela a pessoa votou.</summary>
/// <param name="Votou">Votos com posição: Sim, Não ou abstenção.</param>
/// <param name="Ausente">Só o Senado registra a ausência; na Câmara quem faltou não tem linha, e o campo vem nulo em vez de um zero que seria falso.</param>
public record VotosNaSemanaDto(
    long PessoaId, string Nome, TipoCasa Casa, int Votou, int? Ausente, int? AusenteJustificado);

/// <summary>A2: Sim ou Não oposto à orientação Sim ou Não da bancada do próprio partido no voto. Só Câmara.</summary>
public record VotoContraOPartidoDto(
    long PessoaId,
    string Nome,
    string VotacaoId,
    DateOnly Data,
    string? Proposicao,
    string? Descricao,
    string Partido,
    string Bancada,
    string Orientacao,
    string Voto,
    string? UrlFonte);

/// <summary>A3: o partido do voto mudou, e o primeiro voto pela sigla nova caiu na janela.</summary>
public record TrocaDePartidoDto(
    long PessoaId, string Nome, TipoCasa Casa, string PartidoAnterior, string PartidoNovo, DateOnly PrimeiroVoto);

/// <summary>A4: a cota do último mês fechado que a base tem, com a maior categoria.</summary>
/// <param name="Casa">A casa do voto mais recente: diz se a cota é a da Câmara (CEAP) ou a do Senado (CEAPS), e de qual órgão é a data da carga.</param>
public record GastoNaCotaDto(
    long PessoaId, string Nome, TipoCasa? Casa, int Ano, int Mes, decimal Total, string MaiorCategoria, decimal MaiorCategoriaValor);

/// <summary>A5: o pago às emendas da pessoa na última competência fechada, com o maior destino.</summary>
/// <param name="MaiorDestino">Quem mais recebeu, fora o intermediário (Banco do Brasil): o banco repassa, e nomeá-lo como destino diria o contrário.</param>
public record EmendaPagaDto(
    long PessoaId, string Nome, DateOnly Mes, decimal Pago, string? MaiorDestino, string? LugarDoMaiorDestino);
