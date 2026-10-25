import json

from poligraph_etl.fontes import ibge


def test_le_o_sidra_sem_o_cabecalho_e_sem_valor_nao_numerico(tmp_path):
    """O SIDRA põe o cabeçalho como primeira linha, e marca com "-" o que não estimou."""
    arquivo = tmp_path / "pop.json"
    arquivo.write_text(json.dumps([
        {"V": "Valor", "D1C": "Município (Código)", "D3C": "Ano (Código)"},
        {"V": "22724", "D1C": "1100015", "D3C": "2025"},
        {"V": "-", "D1C": "1100023", "D3C": "2025"},
    ]), encoding="utf-8")

    assert ibge.ler(arquivo) == [{"codigo_ibge": "1100015", "populacao": 22724, "ano": 2025}]
