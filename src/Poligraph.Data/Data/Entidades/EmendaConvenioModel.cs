namespace Poligraph.Data;

/// <summary>Qual emenda financia qual convênio.</summary>
public class EmendaConvenioModel
{
    public required string CodigoEmenda { get; set; }

    public required string NumeroConvenio { get; set; }

    public ConvenioModel? Convenio { get; set; }
}
