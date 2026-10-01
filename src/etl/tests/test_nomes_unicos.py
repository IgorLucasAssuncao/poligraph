"""Nenhum módulo do ETL define a mesma função duas vezes.

🔴 Em Python a segunda definição substitui a primeira sem aviso. Aconteceu em
`persistencia.py`: a `gravar_receitas` da arrecadação federal apagou a do financiamento
de campanha, e o comando `fundo` passaria a gravar na tabela errada.
"""

import ast
from collections import Counter
from pathlib import Path

import pytest

PACOTE = Path(__file__).resolve().parents[1] / "poligraph_etl"


@pytest.mark.parametrize("modulo", sorted(PACOTE.rglob("*.py")), ids=lambda p: p.name)
def test_nenhuma_funcao_de_modulo_repete_o_nome(modulo: Path):
    arvore = ast.parse(modulo.read_text(encoding="utf-8"))
    nomes = Counter(
        no.name for no in arvore.body if isinstance(no, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
    )

    assert [n for n, vezes in nomes.items() if vezes > 1] == []
