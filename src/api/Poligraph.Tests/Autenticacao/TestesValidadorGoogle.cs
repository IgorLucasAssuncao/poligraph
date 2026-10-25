using Microsoft.Extensions.Configuration;
using Poligraph.Api.Services;

namespace Poligraph.Tests;

/// <summary>
/// O validador do id_token do Google, nos caminhos que recusam sem ir à rede. O token válido só
/// existe com o Google de verdade; esse caminho fica nos testes de autenticação, com o validador falso.
/// </summary>
[Trait("Tipo", "Unidade")]
public class TestesValidadorGoogle
{
    [Fact]
    public async Task SemClientIdConfigurado_RecusaQualquerToken()
    {
        var validador = new ValidadorGoogle(Configuracao(null));

        Assert.Null(await validador.ValidarAsync("qualquer-coisa"));
    }

    [Fact]
    public async Task TokenMalFormado_EhRecusadoAntesDeConsultarOGoogle()
    {
        var validador = new ValidadorGoogle(Configuracao("cliente.apps.googleusercontent.com"));

        Assert.Null(await validador.ValidarAsync("isto-nao-e-um-jwt"));
    }

    private static IConfiguration Configuracao(string? clientId) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(clientId is null ? [] : [new("Google:ClientId", clientId)])
            .Build();
}
