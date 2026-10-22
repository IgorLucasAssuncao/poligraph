namespace Poligraph.Api.Dtos;

/// <summary>A página da cidade (Pendência 90, fase 4): quem foi eleito para governá-la em cada período e quanto de emenda chegou.</summary>
/// <param name="Recebido">Todo o pago a quem tem sede na cidade, na base inteira.</param>
/// <param name="Gestoes">Do mandato municipal mais recente ao mais antigo.</param>
/// <param name="PorAno">Pelo ano do pagamento.</param>
public record GestoesDaCidadeDto(
    MunicipioDto Municipio,
    int? Populacao,
    decimal Recebido,
    decimal NaPrefeitura,
    IReadOnlyList<GestaoDaCidadeDto> Gestoes,
    IReadOnlyList<PagoNoAnoDto> PorAno);

/// <summary>Um mandato municipal: os eleitos, os governadores eleitos nos anos que coincidem e o que chegou nesses anos.</summary>
/// <param name="Prefeitos">Em geral um; dois quando houve eleição suplementar para o mesmo período.</param>
/// <param name="ComPagamento">Algum ano da gestão está na base de pagamentos (desde ago/2015). Sem isso, a tela diz "sem pagamento na base", não R$ 0.</param>
public record GestaoDaCidadeDto(
    short PrimeiroAno,
    short UltimoAno,
    IReadOnlyList<EleitoNaGestaoDto> Prefeitos,
    IReadOnlyList<EleitoNaGestaoDto> Vices,
    IReadOnlyList<GovernadorNoPeriodoDto> Governadores,
    decimal Recebido,
    decimal NaPrefeitura,
    bool ComPagamento);

/// <summary>Um eleito, com o link que a tela usa: a ficha do parlamentar quando ele votou no Congresso, senão a do político.</summary>
public record EleitoNaGestaoDto(long IdPessoa, string Nome, string Partido, bool Parlamentar);

/// <summary>Um governador eleito e os anos do mandato dele que caem dentro da gestão municipal.</summary>
public record GovernadorNoPeriodoDto(EleitoNaGestaoDto Governador, short DeAno, short AteAno);

/// <summary>O pago num ano, e a parte que foi para a prefeitura ou órgão municipal.</summary>
public record PagoNoAnoDto(int Ano, decimal Recebido, decimal NaPrefeitura);
