namespace Poligraph.Api.Services;

/// <summary>
/// O coração do sistema, e o lugar do bug mais perigoso dele.
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
        if (respostaCidadao == 0) return false;
        var efetiva = PosicaoEfetiva(posicao);
        return efetiva is not null && efetiva != 0;
    }

    /// <summary>Houve acordo nesta pergunta? Só faz sentido se <see cref="EComparavel"/>.</summary>
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
    /// Em QUAIS perguntas houve acordo, e em quais não.
    ///
    /// <para>
    /// Existe porque "concordaram em 14 de 17" não é auditável: o cidadão não tem
    /// como saber se as 14 foram as que ele considera importantes ou as de data
    /// comemorativa. Devolver a lista transforma o número em conta conferível.
    /// </para>
    ///
    /// <para>
    /// Devolve o <b>id</b> da pergunta, não o texto: o front já tem os textos, ele
    /// acabou de mostrá-los. Repetir 24 enunciados por parlamentar, para dez
    /// parlamentares, inflaria a resposta sem acrescentar informação.
    /// </para>
    ///
    /// <para>
    /// Pergunta não comparável fica fora das DUAS listas — ausência e "não sei"
    /// não são discordância, e é a mesma regra que o denominador usa.
    /// </para>
    /// </summary>
    public static DetalheDaAfinidade Detalhar(
        IReadOnlyList<RespostaCidadao> respostas,
        IReadOnlyDictionary<string, PosicaoParlamentar> posicoes)
    {
        List<string> acordou = [], discordou = [];

        foreach (var resposta in respostas)
        {
            if (!posicoes.TryGetValue(resposta.PerguntaId, out var posicao)) continue;
            if (!EComparavel(resposta.Valor, posicao)) continue;

            if (PosicaoEfetiva(posicao) == resposta.Valor) acordou.Add(resposta.PerguntaId);
            else discordou.Add(resposta.PerguntaId);
        }

        return new DetalheDaAfinidade(acordou, discordou);
    }

    /// <summary>
    /// Piso de comparáveis. Quem votou em 2 perguntas e concordou nas 2 daria 100%
    /// e lideraria o ranking — por isso o corte existe.
    /// </summary>
    public static bool TemBaseSuficiente(
        ResultadoAfinidade resultado, int totalPerguntasRespondidas, double fracaoMinima = 0.60) =>
        resultado.Comparaveis >= Math.Ceiling(totalPerguntasRespondidas * fracaoMinima);
}
