"""LIMPEZA — o que sai do cache da ETL no fim de cada rotina (2026-10-15).

No VPS o cache é um volume que só cresce: muitos downloads levam a data no nome, a Câmara
regenera os arquivos toda madrugada, e cada versão nova vira mais uma cópia de procedência.
MEDIDO no computador do autor, 2026-10-15: 16 GB de cache, dos quais 4,1 GB de downloads na
raiz, 6,9 GB de cópias de procedência e 5,1 GB do cadastro da Receita.

| Onde | Regra | O que se perde |
|---|---|---|
| raiz (downloads) | sai com mais de `DIAS_DOWNLOADS` | nada: a rotina baixa de novo o que precisa |
| `procedencia/`, `respostas/` | saem com mais de `DIAS_PROCEDENCIA` | a cópia de cargas antigas; o hash e a URL ficam em `cargas` |
| `receita/` | fica só o mês mais recente | nada: o cadastro do mês substitui o anterior |
| `brasilapi/`, `ibge/`, `indices/` | ficam | somam poucos MB, e `indices/` é a origem dos gastos sigilosos |

DECISÃO (2026-10-15, do autor): 35 dias para downloads e 180 para procedência. A idade é a
da última gravação do arquivo, não a data no nome: o mesmo arquivo baixado de novo
rejuvenesce.

ATENÇÃO: roda dentro da rotina, que segura a trava contra duas cargas ao mesmo tempo; nada
apaga um arquivo que outra carga esteja lendo.
"""

import logging
import shutil
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger("poligraph")

DIAS_DOWNLOADS = 35
DIAS_PROCEDENCIA = 180
PASTAS_DE_PROCEDENCIA = ("procedencia", "respostas")
PASTA_DA_RECEITA = "receita"
SEGUNDOS_POR_DIA = 86_400


@dataclass(frozen=True)
class Limpeza:
    """O que saiu do cache: quantos itens e quantos bytes."""

    itens: int
    bytes: int


def vencidos(cache: Path, agora: float) -> list[Path]:
    """Os arquivos e pastas que a limpeza apaga, pelas regras do módulo. Não apaga nada."""
    if not cache.is_dir():
        return []

    saem = [
        item for item in cache.iterdir()
        if item.is_file() and _idade_em_dias(item, agora) > DIAS_DOWNLOADS
    ]
    for nome in PASTAS_DE_PROCEDENCIA:
        pasta = cache / nome
        if pasta.is_dir():
            saem += [
                arquivo for arquivo in pasta.rglob("*")
                if arquivo.is_file() and _idade_em_dias(arquivo, agora) > DIAS_PROCEDENCIA
            ]
    receita = cache / PASTA_DA_RECEITA
    if receita.is_dir():
        meses = sorted(pasta for pasta in receita.iterdir() if pasta.is_dir())
        saem += meses[:-1]
    return saem


def limpar(cache: Path, agora: float) -> Limpeza:
    """Apaga o que `vencidos` aponta e diz quanto saiu."""
    itens = vencidos(cache, agora)
    total = 0
    for item in itens:
        total += _tamanho(item)
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
    log.info("  cache: %d itens apagados, %d MB", len(itens), total >> 20)
    return Limpeza(len(itens), total)


def _idade_em_dias(arquivo: Path, agora: float) -> float:
    return (agora - arquivo.stat().st_mtime) / SEGUNDOS_POR_DIA


def _tamanho(item: Path) -> int:
    if item.is_file():
        return item.stat().st_size
    return sum(arquivo.stat().st_size for arquivo in item.rglob("*") if arquivo.is_file())
