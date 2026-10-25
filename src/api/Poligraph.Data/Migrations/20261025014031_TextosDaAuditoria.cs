using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Poligraph.Data.Migrations
{
    /// <summary>
    /// O que a auditoria coluna por coluna de 2026-10-24 achou, corrigido antes das checagens que o impedem de voltar:
    /// a origem da receita de campanha nas 10 origens (17 grafias no banco), "OUTROS BENS E DIREITOS" na grafia dos outros
    /// anos, espaço duplo nos textos que a tela mostra, 10 datas de nascimento com ano impossível e o nome de Coronel
    /// Sapucaia, que a tabela da Receita trouxe só na coluna do TOM.
    /// </summary>
    public partial class TextosDaAuditoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE receitas_de_campanha SET origem_receita = CASE upper(origem_receita)
                    WHEN 'RECURSOS DE PARTIDO POLÍTICO' THEN 'Recursos de partido político'
                    WHEN 'RECURSOS DE PESSOAS FÍSICAS' THEN 'Recursos de pessoas físicas'
                    WHEN 'RECURSOS DE PESSOAS JURÍDICAS' THEN 'Recursos de pessoas jurídicas'
                    WHEN 'RECURSOS PRÓPRIOS' THEN 'Recursos próprios'
                    WHEN 'RECURSOS DE OUTROS CANDIDATOS' THEN 'Recursos de outros candidatos'
                    WHEN 'RECURSOS DE OUTROS CANDIDATOS/COMITÊS' THEN 'Recursos de outros candidatos'
                    WHEN 'RECURSOS DE FINANCIAMENTO COLETIVO' THEN 'Recursos de financiamento coletivo'
                    WHEN 'DOAÇÕES PELA INTERNET' THEN 'Doações pela internet'
                    WHEN 'COMERCIALIZAÇÃO DE BENS OU REALIZAÇÃO DE EVENTOS' THEN 'Comercialização de bens ou realização de eventos'
                    WHEN 'COMERCIALIZAÇÃO DE BENS COM OR' THEN 'Comercialização de bens ou realização de eventos'
                    WHEN 'COMERCIALIZAÇÃO DE BENS COM FEFC' THEN 'Comercialização de bens ou realização de eventos'
                    WHEN 'DESCRIÇÃO DAS DOAÇÕES RELATIVAS À COMERCIALIZAÇÃO' THEN 'Comercialização de bens ou realização de eventos'
                    WHEN 'RENDIMENTOS DE APLICAÇÕES FINANCEIRAS' THEN 'Rendimentos de aplicações financeiras'
                    WHEN 'RECURSOS DE ORIGENS NÃO IDENTIFICADAS' THEN 'Recursos de origens não identificadas'
                    ELSE origem_receita END
                WHERE origem_receita IS NOT NULL;
                UPDATE patrimonios SET tipo_bem = 'Outros bens e direitos' WHERE tipo_bem = 'OUTROS BENS E DIREITOS';
                UPDATE pessoas SET data_nascimento = NULL
                    WHERE data_nascimento < '1900-01-01' OR data_nascimento > '2100-12-31';
                UPDATE municipios SET nome = 'Coronel Sapucaia' WHERE codigo_ibge = '5003157' AND nome = '';
                """);

            foreach (var (tabela, coluna) in TextosDeExibicao)
            {
                migrationBuilder.Sql(
                    $"UPDATE {tabela} SET {coluna} = btrim(regexp_replace({coluna}, '[[:space:]]+', ' ', 'g')) "
                    + $"WHERE {coluna} <> btrim(regexp_replace({coluna}, '[[:space:]]+', ' ', 'g'));");
            }

            migrationBuilder.AddCheckConstraint(
                name: "ck_receita_origem",
                table: "receitas_de_campanha",
                sql: "origem_receita IS NULL OR origem_receita IN ('Recursos de partido político','Recursos de pessoas físicas','Recursos de pessoas jurídicas','Recursos próprios','Recursos de outros candidatos','Recursos de financiamento coletivo','Doações pela internet','Comercialização de bens ou realização de eventos','Rendimentos de aplicações financeiras','Recursos de origens não identificadas')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_pessoa_nascimento",
                table: "pessoas",
                sql: "data_nascimento IS NULL OR data_nascimento BETWEEN '1900-01-01' AND '2100-12-31'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_municipio_nome",
                table: "municipios",
                sql: "nome <> ''");
        }

        /// <summary>As colunas que a ETL grava com um espaço só (<c>CAMPOS_DE_EXIBICAO</c> em <c>persistencia.py</c>).</summary>
        private static readonly (string Tabela, string Coluna)[] TextosDeExibicao =
        [
            ("pessoas", "nome_civil"), ("pessoas", "nome_exibicao"), ("mandatos", "nome_de_urna"), ("mandatos", "coligacao"),
            ("contratados_do_governo", "nome"), ("convenios", "convenente"), ("convenios", "objeto"),
            ("despesas", "categoria"), ("despesas", "fornecedor"), ("emendas_favorecidos", "nome"),
            ("sancoes_de_empresas", "nome"), ("sancoes_de_empresas", "fundamentacao_legal"), ("votacoes", "descricao"),
            ("receitas_de_campanha", "doador"),
        ];

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_receita_origem",
                table: "receitas_de_campanha");

            migrationBuilder.DropCheckConstraint(
                name: "ck_pessoa_nascimento",
                table: "pessoas");

            migrationBuilder.DropCheckConstraint(
                name: "ck_municipio_nome",
                table: "municipios");
        }
    }
}
