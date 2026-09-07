using Poligraph.Data;

namespace Poligraph.Api.Dtos;

public record EmendaPorDestinoDto(string Localidade, decimal Empenhado, decimal Pago, int Quantidade);
