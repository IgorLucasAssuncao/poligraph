using System.Data.Common;
using System.Diagnostics;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Poligraph.Api.Configuracao;

/// <summary>
/// Diz no cabeçalho <c>Server-Timing</c> quanto de cada resposta da API foi banco e quanto foi o resto.
/// </summary>
/// <remarks>
/// <para>DECISÃO (2026-10-10): a ficha de alguns parlamentares levava 4 s a frio sem nenhuma consulta acima de 300 ms. O cabeçalho aparece na aba Rede do navegador e separa as hipóteses: muitas consultas pequenas, espera por conexão, ou tempo fora do banco.</para>
/// <para><c>db</c> é a soma das consultas do request, com a contagem na descrição; <c>total</c> é o request inteiro. Não expõe SQL, tabela nem parâmetro.</para>
/// <para>RISCO: o interceptador acha o request pelo <c>HttpContextAccessor</c>, que só funciona com <c>AddHttpContextAccessor</c> registrado. Sem ele, todo request diz "0 consultas" calado.</para>
/// </remarks>
public static class TempoDoRequest
{
    private const string ChaveDoBanco = "poligraph.tempo-do-banco";

    /// <summary>As opções do banco que a API e os testes compartilham: snake_case e o interceptador do tempo.</summary>
    /// <remarks>
    /// <para>ATENÇÃO: um lugar só, porque a fábrica dos testes registra o contexto de novo; sem isto o teste do cabeçalho via sempre "0 consultas".</para>
    /// </remarks>
    public static DbContextOptionsBuilder ConfigurarBanco(DbContextOptionsBuilder opcoes) =>
        opcoes
            .UseSnakeCaseNamingConvention()
            .AddInterceptors(new Interceptador(new HttpContextAccessor()));

    /// <summary>Escreve o cabeçalho nos requests de <c>/api</c>.</summary>
    public static IApplicationBuilder UseTempoDoRequest(this IApplicationBuilder app) =>
        app.Use(async (http, proximo) =>
        {
            if (!http.Request.Path.StartsWithSegments("/api"))
            {
                await proximo(http);
                return;
            }

            var relogio = Stopwatch.StartNew();
            var banco = new TempoDoBanco();
            http.Items[ChaveDoBanco] = banco;
            http.Response.OnStarting(() =>
            {
                http.Response.Headers["Server-Timing"] = string.Create(
                    CultureInfo.InvariantCulture,
                    $"db;dur={banco.Milissegundos:0.0};desc=\"{banco.Consultas} consultas\", total;dur={relogio.Elapsed.TotalMilliseconds:0.0}");
                return Task.CompletedTask;
            });
            await proximo(http);
        });

    /// <summary>O tempo das consultas de um request. Consultas em paralelo somam os dois tempos.</summary>
    public sealed class TempoDoBanco
    {
        private long _ticks;
        private int _consultas;

        /// <summary>Quantas consultas o request fez.</summary>
        public int Consultas => _consultas;

        /// <summary>A soma do tempo delas.</summary>
        public double Milissegundos => TimeSpan.FromTicks(Interlocked.Read(ref _ticks)).TotalMilliseconds;

        /// <summary>Soma uma consulta.</summary>
        public void Somar(TimeSpan duracao)
        {
            Interlocked.Add(ref _ticks, duracao.Ticks);
            Interlocked.Increment(ref _consultas);
        }
    }

    /// <summary>Soma cada consulta do EF ao request que a fez. Fora de um request (aquecedor, migração), não faz nada.</summary>
    public sealed class Interceptador(IHttpContextAccessor acesso) : DbCommandInterceptor
    {
        private readonly IHttpContextAccessor _acesso = acesso;

        /// <summary>Depois de uma leitura.</summary>
        public override ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
        {
            Somar(eventData.Duration);
            return ValueTask.FromResult(result);
        }

        /// <summary>Depois de um escalar, como uma contagem.</summary>
        public override ValueTask<object?> ScalarExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, object? result, CancellationToken cancellationToken = default)
        {
            Somar(eventData.Duration);
            return ValueTask.FromResult(result);
        }

        /// <summary>Depois de um comando sem retorno.</summary>
        public override ValueTask<int> NonQueryExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            Somar(eventData.Duration);
            return ValueTask.FromResult(result);
        }

        private void Somar(TimeSpan duracao)
        {
            if (_acesso.HttpContext?.Items[ChaveDoBanco] is TempoDoBanco banco)
            {
                banco.Somar(duracao);
            }
        }
    }
}
