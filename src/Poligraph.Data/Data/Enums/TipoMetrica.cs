namespace Poligraph.Data;

/// <summary>
/// As duas medidas de proximidade, calculadas sobre os mesmos pares (RF-18).
///
/// Comparar as duas é resultado do trabalho, não indecisão: a concordância vai
/// para a tela porque se lê em português, o cosseno fica para a comparação.
/// </summary>
public enum TipoMetrica
{
    CONCORDANCIA,
    COSSENO,
}
