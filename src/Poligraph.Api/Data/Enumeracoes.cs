namespace Poligraph.Api.Data;

/// <summary>
/// <para>
/// Os conjuntos fechados do schema. Cada um destes valores já vivia como texto numa
/// coluna e como <c>CHECK</c> no banco; aqui ele ganha um tipo.
/// </para>
///
/// <para>
/// 🔴 <b>O <c>CHECK</c> continua sendo a garantia, e o enum ⛔ não o substitui.</b> Quem
/// escreve a maior parte destas linhas é o ETL Python, e nenhum tipo de C# alcança o
/// Python. O que o enum acrescenta é do lado de cá: erro de compilação onde antes
/// existia comparação de string, e <c>400</c> na borda onde antes uma consulta apenas
/// não casava com nada.
/// </para>
///
/// <para>
/// ⚠️ <b>Os membros são MAIÚSCULOS de propósito</b>, contra o PascalCase do resto do
/// projeto. Eles não são um nome que escolhemos: são o <i>token</i> que já está gravado
/// no banco. Com o nome igual ao token, a conversão é a identidade em três lugares —
/// coluna, JSON e parâmetro de consulta — e ⛔ não há três traduções paralelas para
/// divergirem em silêncio.
/// </para>
///
/// <para>
/// 🔴 Todos são persistidos com <c>HasConversion&lt;string&gt;()</c>. Sem isso o EF
/// grava o <b>ordinal</b>: <c>'CAMARA'</c> viraria <c>0</c>, a restrição recusaria toda
/// inserção e o ETL pararia de escrever sem que nada em C# quebrasse.
/// </para>
/// </summary>
internal static class SobreAsEnumeracoes;

#pragma warning disable CA1717 // plural em enum não-flags: são os valores possíveis, não uma combinação

/// <summary>As duas casas do Congresso. ⛔ Nunca há um terceiro valor.</summary>
public enum Casa
{
    CAMARA,
    SENADO,
}

/// <summary>
/// De onde veio o identificador externo de uma pessoa.
///
/// ⚠️ <c>TSE</c> aparece aqui e ⛔ não em <see cref="Casa"/>: o Tribunal é fonte de
/// dado, não casa legislativa. Eram a mesma coluna de texto e nada impedia confundir.
/// </summary>
public enum FonteDeIdentificador
{
    CAMARA,
    SENADO,
    TSE,
}

/// <summary>Como uma pessoa foi ligada ao identificador de uma fonte.</summary>
public enum MetodoDeVinculo
{
    /// <summary>⭐ Hash de CPF — determinístico.</summary>
    CPF,

    /// <summary>⚠️ Semelhança de nome. Carrega <c>confianca</c> menor que 1.</summary>
    FUZZY,

    MANUAL,
}

/// <summary>
/// O que a votação decidia — o que dita o peso dela na matriz.
///
/// 🔴 <c>DESTAQUE</c> é a categoria perigosa: em 14% das votações nominais votar "Sim"
/// significa <b>rejeitar</b>. Ver o teste de regressão de polaridade.
/// </summary>
public enum CategoriaDeVotacao
{
    /// <summary>Rito. Peso 0 — mede obstrução, não posição.</summary>
    PROCEDIMENTAL,

    /// <summary>Mérito de um trecho. Peso 0,7.</summary>
    DESTAQUE,

    /// <summary>Mérito da matéria. Peso 1,0 — o sinal mais forte.</summary>
    SUBSTANTIVA,

    /// <summary>VotoModel em pessoa, não em política. Peso 0,3.</summary>
    AUTORIDADE,
}

/// <summary>Como o autor de uma emenda foi resolvido para uma pessoa.</summary>
public enum MetodoDeAutor
{
    AUTOMATICO,
    MANUAL,

    /// <summary>⚠️ Registrado, ⛔ não descartado: a lacuna é resultado, não sujeira.</summary>
    NAO_RESOLVIDO,
}

/// <summary>O ciclo de vida de uma execução do ETL analítico.</summary>
public enum StatusDaExecucao
{
    EM_ANDAMENTO,
    CONCLUIDA,
    FALHOU,
}

/// <summary>
/// As duas medidas de proximidade, calculadas sobre os mesmos pares (RF-18).
///
/// ⚠️ Comparar as duas é resultado do trabalho, ⛔ não indecisão: a concordância vai
/// para a tela porque se lê em português, o cosseno fica para a comparação.
/// </summary>
public enum Metrica
{
    CONCORDANCIA,
    COSSENO,
}

/// <summary>
/// A camada de uma aresta.
///
/// ⚠️ São naturezas diferentes e ⛔ nunca se somam num desenho só: comissão comum mede
/// convivência, coautoria mede colaboração. Só a primeira é o grafo do título.
/// </summary>
public enum TipoDeAresta
{
    SIMILARIDADE_VOTO,

    /// <summary>⚠️ Prevista no schema; ainda sem origem de dado.</summary>
    COMISSAO_COMUM,

    /// <summary>⚠️ Prevista no schema; ainda sem origem de dado.</summary>
    COAUTORIA,
}

/// <summary>
/// 🔴 LGPD — a finalidade específica de um consentimento (RNF-12b).
///
/// ⚠️ Um valor só, e é isso que o torna auditável: consentimento genérico ⛔ não
/// atende ao art. 8º, §4º.
/// </summary>
public enum FinalidadeDeConsentimento
{
    EMAIL_NOTICIAS,
}

/// <summary>
/// Para que serve um token de e-mail.
///
/// ⛔ <c>CONFIRMACAO</c> ⛔ não existe: o Google já verifica o endereço.
/// </summary>
public enum PropositoDeToken
{
    DESCADASTRO,
}

/// <summary>Como o nome do parlamentar foi reconhecido no texto da notícia.</summary>
public enum MetodoDeCitacao
{
    NOME_COMPLETO,
    NOME_PARLAMENTAR,

    /// <summary>⚠️ O mais frágil — carrega a menor <c>confianca</c>.</summary>
    SOBRENOME,
}

/// <summary>
/// O sexo como a fonte publica.
///
/// ⚠️ É transcrição do cadastro da casa, ⛔ não uma afirmação do projeto — e é anulável
/// porque o Senado não publica o campo.
/// </summary>
public enum Sexo
{
    M,
    F,
}

#pragma warning restore CA1717

/// <summary>Pontes entre enumerações que compartilham tokens mas ⛔ não são a mesma coisa.</summary>
public static class Enumeracoes
{
    /// <summary>
    /// A fonte de identificador correspondente a uma casa.
    ///
    /// <para>
    /// ⚠️ <see cref="Casa"/> e <see cref="FonteDeIdentificador"/> compartilham os
    /// tokens <c>CAMARA</c> e <c>SENADO</c>, e enquanto as duas eram <c>string</c> o
    /// código as comparava diretamente — o que funcionava por coincidência de texto.
    /// São conceitos diferentes: <c>TSE</c> é fonte e ⛔ não é casa. A tradução agora é
    /// explícita, e ⛔ não existe caminho de volta: nem toda fonte tem casa.
    /// </para>
    /// </summary>
    public static FonteDeIdentificador ComoFonte(this Casa casa) => casa switch
    {
        Casa.CAMARA => FonteDeIdentificador.CAMARA,
        Casa.SENADO => FonteDeIdentificador.SENADO,
        _ => throw new ArgumentOutOfRangeException(nameof(casa)),
    };
}
