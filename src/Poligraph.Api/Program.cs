using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Poligraph.Data;
using Poligraph.Api.Endpoints;
using Poligraph.Api.Services;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddOpenApi();

// 🔴 Enum vai para o JSON como TEXTO. O padrão de System.Text.Json é o ordinal: sem
// esta linha `"casa": "CAMARA"` viraria `"casa": 0`, o front compararia com a string e
// nenhuma comparação daria certo — sem erro em lugar nenhum.
builder.Services.ConfigureHttpJsonOptions(opcoes =>
    opcoes.SerializerOptions.Converters.Add(
        new System.Text.Json.Serialization.JsonStringEnumConverter()));

// 🔴 UseSnakeCaseNamingConvention não é estilo: o ETL Python lê estas mesmas tabelas.
// Removê-lo quebra o ETL sem erro de compilação.
builder.AddNpgsqlDbContext<PoligraphDb>(
    connectionName: "poligraph",
    configureDbContextOptions: opcoes => opcoes.UseSnakeCaseNamingConvention());

// 🔴 Sem persistir as chaves, TODO redeploy desloga todo mundo — e o sintoma é péssimo
// de diagnosticar: funciona local, funciona em produção, e quebra sozinho depois de um
// deploy que não mexeu em autenticação. (PL30)
var pastaChaves = builder.Configuration["DataProtection:Pasta"];
if (!string.IsNullOrWhiteSpace(pastaChaves))
{
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(pastaChaves))
        .SetApplicationName("poligraph");
}

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opcoes =>
    {
        opcoes.Cookie.Name = "sid";
        opcoes.Cookie.HttpOnly = true;              // ⭐ JavaScript não lê
        opcoes.Cookie.SameSite = SameSiteMode.Lax;
        opcoes.ExpireTimeSpan = TimeSpan.FromDays(7);
        opcoes.SlidingExpiration = true;
        opcoes.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest      // ⚠️ Always quebra em http://localhost
            : CookieSecurePolicy.Always;

        // 🔴 É uma API: responder 401/403, não redirecionar para uma tela que não existe.
        // Sem isto, chamada sem cookie devolve 302 e o front recebe HTML onde esperava
        // JSON — o bug de uma hora perdida.
        opcoes.Events.OnRedirectToLogin = c =>
        {
            c.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        opcoes.Events.OnRedirectToAccessDenied = c =>
        {
            c.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };

        // ⭐ A 4ª conferência: a sessão foi revogada?
        opcoes.Events.OnValidatePrincipal = async contexto =>
        {
            var principal = contexto.Principal;
            var idBruto = principal?.FindFirst(EndpointsAutenticacao.ClaimUsuario)?.Value;
            var versaoBruta = principal?.FindFirst(EndpointsAutenticacao.ClaimSessao)?.Value;

            if (!long.TryParse(idBruto, out var id) || !short.TryParse(versaoBruta, out var versao))
            {
                contexto.RejectPrincipal();
                return;
            }

            var db = contexto.HttpContext.RequestServices.GetRequiredService<PoligraphDb>();
            var atual = await db.Usuarios.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => (short?)u.SessaoVersao)
                .FirstOrDefaultAsync();

            if (atual != versao)
            {
                contexto.RejectPrincipal();
                await contexto.HttpContext.SignOutAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<IValidadorGoogle, ValidadorGoogle>();
builder.Services.AddScoped<ServicoDigest>();

var app = builder.Build();

app.MapDefaultEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // ⭐ `/scalar` — a documentação navegável, com "experimente" em cada rota.
    //
    // ⚠️ Só em desenvolvimento. Em produção ela expõe a superfície inteira da API a
    // quem passar, incluindo as rotas de conta e de exclusão (LGPD art. 18).
    //
    // 🔴 Ela lê o MESMO documento que o teste de contrato confere
    // (`TestesContratoOpenApi`): se a documentação e o front discordarem, o teste
    // quebra antes de alguém abrir a página.
    app.MapScalarApiReference(opcoes => opcoes
        .WithTitle("Registro Aberto — API")
        .WithTheme(ScalarTheme.BluePlanet));
}

app.UseAuthentication();
app.UseAuthorization();

app.MapearParlamentares()
   .MapearPanorama()
   .MapearAfinidade()
   .MapearAutenticacao()
   .MapearSeguir()
   .MapearGrafo()
   .MapearNoticias()
   .MapearAvaliacao();

// ⚠️ Diz na subida se o login está ligado.
//
// Sem isto, a única evidência seria um 401 no endpoint de login — que é exatamente o
// mesmo código devolvido para token inválido. Um Client ID ausente ficaria
// indistinguível de um token forjado, e a investigação começaria pelo lugar errado.
{
    var clientId = app.Configuration["Google:ClientId"];
    var log = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Poligraph");

    if (string.IsNullOrWhiteSpace(clientId))
    {
        log.LogWarning(
            "Login com Google DESLIGADO: Google:ClientId não configurado. "
            + "O site funciona; entrar não. Ver docs/plano/08-obter-as-chaves.md");
    }
    else
    {
        // ⛔ Só o final: o Client ID é público, mas log não é lugar de despejar
        //    configuração inteira por hábito.
        log.LogInformation(
            "Login com Google ligado (Client ID …{Final}).",
            clientId[^24..]);
    }
}

app.Run();

/// <summary>
/// Marcador para o `WebApplicationFactory` dos testes de integração.
/// ⚠️ Não use `Program`: o projeto de migrations também tem um, no namespace global,
/// e a referência dupla no projeto de testes torna o nome ambíguo.
/// </summary>
public sealed class MarcadorApi;
