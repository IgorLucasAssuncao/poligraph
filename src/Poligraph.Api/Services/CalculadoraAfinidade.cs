namespace Poligraph.Api.Services;

/// <summary>Resposta do cidadão a uma pergunta.</summary>
/// <param name="PerguntaId">Ex.: "q1" — ⚠️ nunca o idVotacao.</param>
/// <param name="Valor">+1 concordo · -1 discordo · 0 não sei.</param>
public readonly record struct RespostaCidadao(string PerguntaId, short Valor);

/// <summary>Como o parlamentar se posicionou na afirmação de uma pergunta.</summary>
/// <param name="VotoModel">+1 sim · -1 não · 0 abstenção · null ausente.</param>
/// <param name="Polaridade">+1 "Sim" aprova a afirmação · -1 "Sim" a rejeita.</param>
public readonly record struct PosicaoParlamentar(short? VotoModel, short Polaridade);

/// <summary>Afinidade de um parlamentar com o cidadão. ⛔ Sem percentual — RF-29.</summary>
public readonly record struct ResultadoAfinidade(long PessoaId, int Acordos, int Comparaveis)
{
    /// <summary>Uso interno para ordenar. ⛔ Não expor na API: a tela mostra "X de Y".</summary>
    public double Proporcao => Comparaveis == 0 ? 0 : (double)Acordos / Comparaveis;
}

/// <summary>
/// 🔴 O coração do sistema, e o lugar do bug mais perigoso dele.
///
/// Em 14% das votações nominais "Sim" significa REJEITAR (destaques). Um sinal invertido
/// não aparece na tela — aparece como um número plausível e errado. Nenhuma alteração
/// aqui entra sem o teste de regressão de polaridade (API3).
///
/// A métrica é concordância simples, de propósito: "concordou em 17 de 20" é auditável
/// por qualquer cidadão; "cosseno 0,84" não é. O cosseno fica no grafo.
/// </summary>
public static class CalculadoraAfinidade
{
    /// <summary>
    /// Posição efetiva do parlamentar na afirmação: o voto corrigido pela polaridade.
    /// </summary>
    public static short? PosicaoEfetiva(PosicaoParlamentar posicao) =>
        posicao.VotoModel is null ? null : (short)(posicao.VotoModel.Value * posicao.Polaridade);

    /// <summary>
    /// A pergunta entra na conta? Só se os dois lados se manifestaram de fato.
    /// Ausência, abstenção e "não sei" saem do denominador em vez de contarem como discordância.
    /// </summary>
    public static bool EComparavel(short respostaCidadao, PosicaoParlamentar posicao)
    {
        if (respostaCidadao == 0) return false;             // cidadão não opinou
        var efetiva = PosicaoEfetiva(posicao);
        return efetiva is not null && efetiva != 0;          // parlamentar votou e não se absteve
    }

    /// <summary>Houve acordo nesta pergunta? ⚠️ Só faz sentido se <see cref="EComparavel"/>.</summary>
    public static bool Concordam(short respostaCidadao, PosicaoParlamentar posicao) =>
        EComparavel(respostaCidadao, posicao) && PosicaoEfetiva(posicao) == respostaCidadao;

    /// <summary>
    /// Calcula a afinidade de um parlamentar. As posições vêm indexadas por pergunta.
    /// </summary>
    public static ResultadoAfinidade Calcular(
        long pessoaId,
        IReadOnlyList<RespostaCidadao> respostas,
        IReadOnlyDictionary<string, PosicaoParlamentar> posicoes)
    {
        var acordos = 0;
        var comparaveis = 0;

        foreach (var resposta in respostas)
        {
            if (!posicoes.TryGetValue(resposta.PerguntaId, out var posicao)) continue;
            if (!EComparavel(resposta.Valor, posicao)) continue;

            comparaveis++;
            if (PosicaoEfetiva(posicao) == resposta.Valor) acordos++;
        }

        return new ResultadoAfinidade(pessoaId, acordos, comparaveis);
    }

    /// <summary>
    /// 🔴 Piso de comparáveis. Quem votou em 2 perguntas e concordou nas 2 daria 100%
    /// e lideraria o ranking — por isso o corte existe.
    /// </summary>
    public static bool TemBaseSuficiente(
        ResultadoAfinidade resultado, int totalPerguntasRespondidas, double fracaoMinima = 0.60) =>
        resultado.Comparaveis >= Math.Ceiling(totalPerguntasRespondidas * fracaoMinima);
}
