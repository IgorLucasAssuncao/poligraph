namespace Poligraph.Api.Data;

/// <summary>
/// Avaliação do questionário pelo cidadão — dado de PESQUISA, não de perfil.
///
/// 🔴 A decisão que define esta tabela: ⛔ **não há `usuario_id` aqui**, de propósito.
///
/// Ela guarda autodeclaração de posição política, que é dado sensível pela LGPD art. 5º,
/// II — e no grau mais direto possível, porque a própria pessoa declara. Ligá-la à conta
/// transformaria o site num cadastro de ideologia por pessoa identificada, em ano
/// eleitoral. Desligada, é amostra de pesquisa: dá para responder "o instrumento
/// acerta?" sem responder "o que o Fulano pensa?".
///
/// ⭐ Isto é o que torna a pergunta defensável na banca — e o que permite o resultado
/// mais interessante do TCC: a correlação entre afinidade CALCULADA e posição
/// AUTODECLARADA valida o método por comportamento revelado.
/// </summary>
public class AvaliacaoQuestionarioModel
{
    public long Id { get; set; }

    /// <summary>
    /// Quantas perguntas entraram na conta. ⚠️ Sem isso não dá para separar
    /// "errou o método" de "respondeu pouco".
    /// </summary>
    public int PerguntasRespondidas { get; set; }

    /// <summary>Acordos com o primeiro colocado — o "quão forte" foi o casamento.</summary>
    public int AcordosDoPrimeiro { get; set; }
    public int ComparaveisDoPrimeiro { get; set; }

    /// <summary>
    /// "O resultado combinou com o que você esperava?"
    /// `true` acertou · `false` não acertou · `null` não respondeu.
    /// </summary>
    public bool? Acertou { get; set; }

    /// <summary>
    /// Autodeclaração numa escala de -3 (esquerda) a +3 (direita), ou `null`.
    ///
    /// ⚠️ Perguntada DEPOIS do resultado, de propósito: perguntar antes ancoraria a
    /// resposta do cidadão no rótulo que ele acabou de escolher para si.
    /// </summary>
    public short? PosicaoAutodeclarada { get; set; }

    public DateTimeOffset RegistradaEm { get; set; }
}
