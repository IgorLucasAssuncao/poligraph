"""Quem está em exercício hoje, pela lista oficial de cada casa (decisão do autor, 2026-10-18).

| | |
|---|---|
| Fontes | Câmara: `api/v2/deputados` (em exercício, e os da legislatura com a situação de cada um fora dele) · Senado: `senador/lista/atual` e `senador/afastados` |
| Tabela | `em_exercicio`, trocada inteira por casa a cada carga |
| Quem usa | O botão de seguir (só quem está em exercício ou licenciado pode ser seguido) e o worker, que tira da lista de seguidos quem deixou o mandato |

RISCO: uma lista curta tiraria gente demais da lista de seguidos de todo mundo. O canário de volume
para a carga antes de gravar: a Câmara tem 513 cadeiras e o Senado 81, e licença ou vaga só troca o
ocupante. MEDIDO em 2026-10-19: 513 e 81.

DECISÃO do autor (2026-10-19): licenciado também é seguível. Na Câmara, a situação "Licença" ou
"Afastado" de quem exerceu mandato na legislatura; no Senado, o afastado cujo último exercício terminou
em licença com suplente (LCS) ou em cargo de ministro ou secretário (AFO). Vacância, renúncia, morte e
suplente que devolveu a cadeira não entram.

ATENÇÃO: quem a lista traz e ainda não está em `pessoas` (deputado novo, antes de votar) fica de
fora e é contado no log; entra na carga seguinte, depois que `ingerir` o cria.
"""

from dataclasses import dataclass

from .contratos import entrada
from .contratos.banco import EmExercicio
from .contratos.camara import DeputadoEmExercicio
from .contratos.senado import SenadorEmExercicio
from .tipos import TipoCasa

MINIMO_POR_CASA = {TipoCasa.CAMARA: 500, TipoCasa.SENADO: 78}
"""Abaixo disso a lista está cortada: a fonte falhou ou mudou de formato. Conta só quem está em exercício."""

SITUACOES_DE_LICENCA_NA_CAMARA = {"Licença", "Afastado"}
"""A situação de `ultimoStatus` de quem tem mandato e está fora da cadeira por um tempo."""

CAUSAS_DE_LICENCA_NO_SENADO = {"LCS", "AFO"}
"""Licença com convocação de suplente; afastado para ocupar cargo de ministro ou secretário."""


@dataclass(frozen=True)
class Resultado:
    """As linhas da casa e quantos da lista oficial não têm pessoa no banco."""

    linhas: list[EmExercicio]
    sem_pessoa: int


def da_camara(registros: list[dict], pessoa_por_id: dict[str, int]) -> Resultado:
    """Os deputados da lista, com a pessoa do banco e a legislatura que a Câmara informa."""
    deputados = entrada.ler(DeputadoEmExercicio, registros)
    _conferir_volume(TipoCasa.CAMARA, len(deputados))
    linhas, sem_pessoa = [], 0
    for deputado in deputados:
        pessoa = pessoa_por_id.get(deputado.id_na_camara or "")
        if pessoa is None:
            sem_pessoa += 1
            continue
        legislatura = int(deputado.legislatura) if deputado.legislatura and deputado.legislatura.isdigit() else None
        linhas.append(EmExercicio(pessoa_id=pessoa, casa=TipoCasa.CAMARA, legislatura=legislatura))
    return Resultado(_sem_repetir(linhas), sem_pessoa)


def do_senado(registros: list[dict], pessoa_por_codigo: dict[str, int]) -> Resultado:
    """Os senadores da lista, com a pessoa do banco. O Senado não informa uma legislatura só."""
    senadores = entrada.ler(SenadorEmExercicio, registros)
    _conferir_volume(TipoCasa.SENADO, len(senadores))
    linhas, sem_pessoa = [], 0
    for senador in senadores:
        pessoa = pessoa_por_codigo.get(senador.codigo_no_senado or "")
        if pessoa is None:
            sem_pessoa += 1
            continue
        linhas.append(EmExercicio(pessoa_id=pessoa, casa=TipoCasa.SENADO, legislatura=None))
    return Resultado(_sem_repetir(linhas), sem_pessoa)


def licenciados_da_camara(situacao_por_id: dict[str, str | None], pessoa_por_id: dict[str, int],
                          legislatura: int | None) -> list[EmExercicio]:
    """Os deputados da legislatura em licença, a partir da situação de cada um fora do exercício."""
    return [
        EmExercicio(pessoa_id=pessoa_por_id[id_camara], casa=TipoCasa.CAMARA, legislatura=legislatura, licenciado=True)
        for id_camara, situacao in situacao_por_id.items()
        if situacao in SITUACOES_DE_LICENCA_NA_CAMARA and id_camara in pessoa_por_id
    ]


def licenciados_do_senado(afastados: list[dict], pessoa_por_codigo: dict[str, int]) -> list[EmExercicio]:
    """Os senadores afastados cujo último exercício terminou em licença ou em cargo de ministro ou secretário."""
    licenciados = []
    for afastado in afastados:
        codigo = str((afastado.get("IdentificacaoParlamentar") or {}).get("CodigoParlamentar") or "")
        if codigo in pessoa_por_codigo and _causa_do_ultimo_afastamento(afastado) in CAUSAS_DE_LICENCA_NO_SENADO:
            licenciados.append(EmExercicio(pessoa_id=pessoa_por_codigo[codigo], casa=TipoCasa.SENADO, legislatura=None, licenciado=True))
    return licenciados


def juntar(em_exercicio: list[EmExercicio], licenciados: list[EmExercicio]) -> list[EmExercicio]:
    """A lista da casa: quem está em exercício e, sem repetir, os licenciados."""
    return _sem_repetir([*em_exercicio, *licenciados])


def _causa_do_ultimo_afastamento(afastado: dict) -> str | None:
    """A sigla da causa no exercício mais recente do mandato, pela data de início."""
    exercicios = ((afastado.get("Mandato") or {}).get("Exercicios") or {}).get("Exercicio") or []
    exercicios = exercicios if isinstance(exercicios, list) else [exercicios]
    if not exercicios:
        return None
    ultimo = max(exercicios, key=lambda e: e.get("DataInicio") or "")
    return ultimo.get("SiglaCausaAfastamento")


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
