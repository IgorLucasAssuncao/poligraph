namespace Poligraph.Data;

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
