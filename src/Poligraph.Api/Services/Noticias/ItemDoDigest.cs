using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Endpoints;
using Poligraph.Data;

namespace Poligraph.Api.Services;

public record ItemDoDigest(string Titulo, string Veiculo, string Url, string PorCausaDe);
