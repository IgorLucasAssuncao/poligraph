namespace Poligraph.Data;

/// <summary>RF-48 — tema da notícia, para o feed misto.</summary>
public class NoticiaTemaModel
{
    public long NoticiaId { get; set; }
    public NoticiaModel? Noticia { get; set; }

    public required string Tema { get; set; }
}
