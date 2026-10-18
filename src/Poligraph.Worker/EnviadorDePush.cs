using System.Net;
using System.Text.Json;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.Extensions.Options;
using Poligraph.Data;

namespace Poligraph.Worker;

/// <summary>
/// Entrega um aviso a um navegador pelo serviço de push do fabricante (Web Push, RFC 8030), cifrado
/// de ponta a ponta (RFC 8291): o Google, a Mozilla e a Apple entregam, mas não leem.
/// </summary>
public class EnviadorDePush
{
    private readonly PushServiceClient _cliente;

    /// <summary>
    /// O tópico junta avisos pendentes: se o navegador ficou desligado, chega só o último, não uma fila.
    /// </summary>
    public const string Topico = "novidades";

    /// <summary>Uma semana: depois disso o aviso perde o sentido, e o "O que mudou" já mostra tudo.</summary>
    public static readonly TimeSpan Validade = TimeSpan.FromDays(7);

    public EnviadorDePush(HttpClient http, IOptions<OpcoesDosAvisos> opcoes)
    {
        _cliente = new PushServiceClient(http)
        {
            DefaultAuthentication = new VapidAuthentication(opcoes.Value.ChavePublica, opcoes.Value.ChavePrivada)
            {
                Subject = opcoes.Value.Assunto,
            },
            DefaultTimeToLive = (int)Validade.TotalSeconds,
        };
    }

    /// <summary>Entrega o aviso. Devolve falso quando o fabricante diz que o navegador não existe mais (404 ou 410).</summary>
    /// <exception cref="PushServiceClientException">Qualquer outra recusa: o job falha e o Hangfire tenta de novo.</exception>
    public async Task<bool> EnviarAsync(InscricaoNoNavegadorModel inscricao, AvisoDto aviso, CancellationToken ct)
    {
        var assinatura = new PushSubscription
        {
            Endpoint = inscricao.Endereco,
            Keys = new Dictionary<string, string> { ["p256dh"] = inscricao.P256dh, ["auth"] = inscricao.Auth },
        };
        var mensagem = new PushMessage(JsonSerializer.Serialize(aviso, JsonSerializerOptions.Web))
        {
            Topic = Topico,
            Urgency = PushMessageUrgency.Normal,
        };

        try
        {
            await _cliente.RequestPushMessageDeliveryAsync(assinatura, mensagem, ct);
            return true;
        }
        catch (PushServiceClientException erro) when (erro.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
        {
            return false;
        }
    }
}

/// <summary>O que o service worker do site recebe e mostra.</summary>
/// <param name="Titulo">O título da notificação.</param>
/// <param name="Corpo">O texto, sem nome de parlamentar.</param>
/// <param name="Url">Para onde o clique leva.</param>
public record AvisoDto(string Titulo, string Corpo, string Url);
