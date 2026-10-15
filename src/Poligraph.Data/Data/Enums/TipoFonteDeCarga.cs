namespace Poligraph.Data;

/// <summary>
/// O órgão que publicou o arquivo de uma carga (Pendência 72).
///
/// <para>
/// Separado de <see cref="TipoFonteDeIdentificador"/>: aquele diz de onde veio o código de
/// uma pessoa; este, de onde veio um arquivo. O Portal da Transparência e a Receita
/// publicam arquivos e não identificam parlamentar.
/// </para>
/// </summary>
public enum TipoFonteDeCarga
{
    CAMARA,
    SENADO,
    TSE,
    PORTAL_TRANSPARENCIA,
    RECEITA,
    IBGE,
}
