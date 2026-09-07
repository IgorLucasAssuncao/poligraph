namespace Poligraph.Data;

/// <summary>Aresta do grafo. Três tipos em CAMADAS — ⛔ não somar os pesos.</summary>
public class ArestaGrafoModel
{
    public long ExecucaoId { get; set; }
    public long PessoaA { get; set; }
    public long PessoaB { get; set; }

    public TipoDeAresta Tipo { get; set; }

    public float Peso { get; set; }
}
