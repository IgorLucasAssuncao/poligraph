"""A limpeza do cache no fim da rotina: o que sai, o que fica."""

import os
from pathlib import Path

from poligraph_etl.nucleo import limpeza

AGORA = 2_000_000_000.0
DIA = limpeza.SEGUNDOS_POR_DIA


def _arquivo(caminho: Path, dias: float, tamanho: int = 10) -> Path:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_bytes(b"x" * tamanho)
    momento = AGORA - dias * DIA
    os.utime(caminho, (momento, momento))
    return caminho


def test_download_velho_sai_e_o_novo_fica(tmp_path):
    velho = _arquivo(tmp_path / "viagens-2025-20260801.zip", 40)
    novo = _arquivo(tmp_path / "viagens-2025-20261009.zip", 6)

    saem = limpeza.vencidos(tmp_path, AGORA)

    assert velho in saem
    assert novo not in saem


def test_procedencia_tem_prazo_proprio(tmp_path):
    de_dois_meses = _arquivo(tmp_path / "procedencia" / "ab" / "abcdef", 60)
    de_um_ano = _arquivo(tmp_path / "procedencia" / "cd" / "cdef01", 365)
    resposta_velha = _arquivo(tmp_path / "respostas" / "materias-20250101.json", 200)

    saem = limpeza.vencidos(tmp_path, AGORA)

    assert de_dois_meses not in saem
    assert de_um_ano in saem
    assert resposta_velha in saem


def test_receita_fica_so_o_mes_mais_recente(tmp_path):
    _arquivo(tmp_path / "receita" / "2026-07" / "Estabelecimentos0.zip", 90)
    _arquivo(tmp_path / "receita" / "2026-10" / "Estabelecimentos0.zip", 1)

    saem = limpeza.vencidos(tmp_path, AGORA)

    assert tmp_path / "receita" / "2026-07" in saem
    assert tmp_path / "receita" / "2026-10" not in saem


def test_pastas_pequenas_e_indices_ficam(tmp_path):
    indice = _arquivo(tmp_path / "indices" / "cpgf-2019.json", 900)
    sede = _arquivo(tmp_path / "brasilapi" / "sedes-20250101-000.jsonl", 900)

    saem = limpeza.vencidos(tmp_path, AGORA)

    assert indice not in saem
    assert sede not in saem


def test_limpar_apaga_e_conta(tmp_path):
    _arquivo(tmp_path / "votacoesVotos-2025.csv", 50, tamanho=1000)
    _arquivo(tmp_path / "receita" / "2026-07" / "Empresas0.zip", 90, tamanho=500)
    _arquivo(tmp_path / "receita" / "2026-10" / "Empresas0.zip", 1)

    resultado = limpeza.limpar(tmp_path, AGORA)

    assert resultado == limpeza.Limpeza(itens=2, bytes=1500)
    assert not (tmp_path / "votacoesVotos-2025.csv").exists()
    assert not (tmp_path / "receita" / "2026-07").exists()
    assert (tmp_path / "receita" / "2026-10" / "Empresas0.zip").exists()


def test_cache_inexistente_nao_e_erro(tmp_path):
    assert limpeza.vencidos(tmp_path / "nao-existe", AGORA) == []
