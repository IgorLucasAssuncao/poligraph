"""Quem está em exercício hoje, pela lista oficial de cada casa (decisão do autor, 2026-10-18).

| | |
|---|---|
| Fontes | Câmara: `api/v2/deputados` · Senado: `senador/lista/atual` |
| Tabela | `em_exercicio`, trocada inteira por casa a cada carga |
| Quem usa | O botão de seguir (só quem está em exercício pode ser seguido) e o worker, que tira da lista de seguidos quem deixou o mandato |

RISCO: uma lista curta tiraria gente demais da lista de seguidos de todo mundo. O canário de volume
para a carga antes de gravar: a Câmara tem 513 cadeiras e o Senado 81, e licença ou vaga só troca o
ocupante. MEDIDO em 2026-10-19: 513 e 81.

ATENÇÃO: quem a lista traz e ainda não está em `pessoas` (deputado novo, antes de votar) fica de
fora e é contado no log; entra na carga seguinte, depois que `ingerir` o cria.
"""

from dataclasses import dataclass

from .contratos import entrada
from .contratos.banco import EmExercicio
from .contratos.camara import DeputadoEmExercicio
from .contratos.senado import SenadorEmExercicio

MINIMO_POR_CASA = {"CAMARA": 500, "SENADO": 78}
"""Abaixo disso a lista está cortada: a fonte falhou ou mudou de formato."""


@dataclass(frozen=True)
class Resultado:
    """As linhas da casa e quantos da lista oficial não têm pessoa no banco."""

    linhas: list[EmExercicio]
    sem_pessoa: int


def da_camara(registros: list[dict], pessoa_por_id: dict[str, int]) -> Resultado:
    """Os deputados da lista, com a pessoa do banco e a legislatura que a Câmara informa."""
    deputados = entrada.ler(DeputadoEmExercicio, registros)
    _conferir_volume("CAMARA", len(deputados))
    linhas, sem_pessoa = [], 0
    for deputado in deputados:
        pessoa = pessoa_por_id.get(deputado.id_na_camara or "")
        if pessoa is None:
            sem_pessoa += 1
            continue
        legislatura = int(deputado.legislatura) if deputado.legislatura and deputado.legislatura.isdigit() else None
        linhas.append(EmExercicio(pessoa_id=pessoa, casa="CAMARA", legislatura=legislatura))
    return Resultado(_sem_repetir(linhas), sem_pessoa)


def do_senado(registros: list[dict], pessoa_por_codigo: dict[str, int]) -> Resultado:
    """Os senadores da lista, com a pessoa do banco. O Senado não informa uma legislatura só."""
    senadores = entrada.ler(SenadorEmExercicio, registros)
    _conferir_volume("SENADO", len(senadores))
    linhas, sem_pessoa = [], 0
    for senador in senadores:
        pessoa = pessoa_por_codigo.get(senador.codigo_no_senado or "")
        if pessoa is None:
            sem_pessoa += 1
            continue
        linhas.append(EmExercicio(pessoa_id=pessoa, casa="SENADO", legislatura=None))
    return Resultado(_sem_repetir(linhas), sem_pessoa)


def _conferir_volume(casa: str, quantos: int) -> None:
    """Para a carga se a lista vier curta, antes de gravar qualquer coisa."""
    if quantos < MINIMO_POR_CASA[casa]:
        raise RuntimeError(
            f"Só {quantos} em exercício na lista de {casa}, esperado ao menos {MINIMO_POR_CASA[casa]}. "
            "A fonte falhou ou mudou de formato; nada foi gravado."
        )


def _sem_repetir(linhas: list[EmExercicio]) -> list[EmExercicio]:
    """A mesma pessoa uma vez só: a chave da tabela é a pessoa."""
    vistas: dict[int, EmExercicio] = {}
    for linha in linhas:
        vistas.setdefault(linha.pessoa_id, linha)
    return list(vistas.values())
