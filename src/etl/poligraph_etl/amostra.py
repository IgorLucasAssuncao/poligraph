"""AMOSTRA — conferir votações sorteadas contra um segundo canal oficial (Pendência 67).

A ETL lê o voto de um canal só: o arquivo anual em bloco da Câmara e o `/votacao` do Senado.
Este módulo sorteia votações e as confere, voto a voto, contra outro serviço da mesma casa:

| Casa | Canal da carga | Canal da conferência |
|---|---|---|
| Câmara | `votacoesVotos-{ano}.csv` | `/api/v2/votacoes/{id}/votos` |
| Senado | `/votacao?dataInicio&dataFim` | `/plenario/lista/votacao/{data}` |

DECISÃO: Sorteio com semente fixa, por casa e legislatura: a mesma semente dá a mesma
amostra, e qualquer um refaz a conferência. É a versão repetível da "amostra manual" do
plano/09 §5.3; a conferência no site, a olho, continua possível com a mesma lista.

ATENÇÃO: No Senado os dois serviços leem o mesmo acervo (achado #37): a conferência pega erro
nosso de leitura e de ligação de pessoa, não erro do acervo.
"""

import random
from dataclasses import dataclass

POR_GRUPO_PADRAO = 20
SEMENTE_PADRAO = 2026


@dataclass(frozen=True)
class Resultado:
    """O que a conferência de uma votação achou."""

    iguais: int
    divergentes: int
    so_na_base: int
    so_na_fonte: int

    @property
    def confere(self) -> bool:
        return self.divergentes == self.so_na_base == self.so_na_fonte == 0


def sortear(ids: list[str], quantos: int, semente: int, grupo: str) -> list[str]:
    """`quantos` ids do grupo, sempre os mesmos para a mesma semente e o mesmo conjunto."""
    ordenados = sorted(ids)
    if len(ordenados) <= quantos:
        return ordenados
    return sorted(random.Random(f"{semente}:{grupo}").sample(ordenados, quantos))


def comparar(base: dict[str, int | None], fonte: dict[str, int | None]) -> Resultado:
    """Voto a voto, pelo id da pessoa na casa. `None` é presença sem posição, e conta como valor."""
    comuns = base.keys() & fonte.keys()
    divergentes = sum(1 for chave in comuns if base[chave] != fonte[chave])
    return Resultado(
        iguais=len(comuns) - divergentes,
        divergentes=divergentes,
        so_na_base=len(base.keys() - fonte.keys()),
        so_na_fonte=len(fonte.keys() - base.keys()),
    )
