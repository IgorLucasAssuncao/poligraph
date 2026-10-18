namespace Poligraph.Api.Dtos;

/// <summary>O que o navegador entrega ao aceitar avisos (<c>PushSubscription</c>): o endereço e as duas chaves.</summary>
/// <param name="Endereco">O <c>endpoint</c> do serviço de push do fabricante.</param>
/// <param name="P256dh">A chave pública do navegador, em base64url.</param>
/// <param name="Auth">O segredo de autenticação, em base64url.</param>
public record InscricaoNoNavegadorDto(string Endereco, string P256dh, string Auth);

/// <summary>O navegador que sai da lista de avisos.</summary>
public record SaidaDoNavegadorDto(string Endereco);

/// <summary>Os avisos da pessoa, para a página da conta e o sininho.</summary>
/// <param name="Consentimento">Se há consentimento vivo para avisos no navegador.</param>
/// <param name="Navegadores">Quantos navegadores dela recebem avisos.</param>
/// <param name="EsteNavegador">Se o navegador que perguntou é um deles.</param>
public record EstadoDosAvisosDto(bool Consentimento, int Navegadores, bool EsteNavegador);

/// <summary>A chave pública VAPID, que o navegador precisa para se inscrever. Nula quando o servidor não tem chave: a tela esconde os avisos.</summary>
public record ChaveDosAvisosDto(string? ChavePublica);
