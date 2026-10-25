using Poligraph.Api.Services;
using Poligraph.Data;

namespace Poligraph.Tests;

/// <summary>
/// Os endereços das fontes oficiais.
/// </summary>
/// <remarks>
/// <para>
/// Cada formato foi aberto em 2026-09-25 e devolveu a página certa. Estes testes fixam o
/// formato: se alguém trocar a casa ou o identificador, o link vai para outra pessoa, e
/// nada na tela avisa.
/// </para>
/// </remarks>
[Trait("Tipo", "Unidade")]
public class TestesFontesOficiais
{
    [Theory]
    [InlineData(TipoCasa.CAMARA, "160575", "https://www.camara.leg.br/deputados/160575")]
    [InlineData(TipoCasa.SENADO, "5979", "https://www25.senado.leg.br/web/senadores/senador/-/perfil/5979")]
    public void Parlamentar_ApontaParaACasaCerta(TipoCasa casa, string id, string esperado) =>
        Assert.Equal(esperado, FontesOficiais.Parlamentar(casa, id));

    [Fact]
    public void Parlamentar_SemIdentificadorNaoInventaLink() =>
        Assert.Null(FontesOficiais.Parlamentar(TipoCasa.CAMARA, null));

    [Theory]
    [InlineData(TipoCasa.CAMARA, 2618177L, "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2618177")]
    [InlineData(TipoCasa.SENADO, 171682L, "https://www25.senado.leg.br/web/atividade/materias/-/materia/171682")]
    public void Proposicao_ApontaParaACasaCerta(TipoCasa casa, long id, string esperado) =>
        Assert.Equal(esperado, FontesOficiais.Proposicao(casa, id));

    /// <summary>O Senado não publica a votação em endereço estável: sem link, e não um link errado.</summary>
    [Fact]
    public void RegistroDaVotacao_SoNaCamara()
    {
        Assert.Equal(
            "https://dadosabertos.camara.leg.br/api/v2/votacoes/2618177-71",
            FontesOficiais.RegistroDaVotacao(TipoCasa.CAMARA, "2618177-71"));
        Assert.Null(FontesOficiais.RegistroDaVotacao(TipoCasa.SENADO, "SF-7101"));
    }

    [Fact]
    public void EmendaEConvenio_VaoAoPortal()
    {
        Assert.Equal(
            "https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda=202541840004",
            FontesOficiais.Emenda("202541840004"));
        Assert.Equal("https://portaldatransparencia.gov.br/convenios/1AAQKR", FontesOficiais.Convenio("1AAQKR"));
    }
}
