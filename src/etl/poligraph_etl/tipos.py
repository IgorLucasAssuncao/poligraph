"""Os valores fechados das fontes, como enum (regra do `CLAUDE.md`, Pendência 91).

O código que a fonte publica é traduzido aqui, no contrato de entrada; dali em diante só o enum
circula. Valor que a fonte manda e o enum não conhece derruba a carga com `ValorDesconhecido`, como
`LayoutMudou` faz com coluna que some.

Os nomes e os valores são os mesmos dos enums C# em `Poligraph.Data/Data/Enums`.
"""

from enum import StrEnum


class ValorDesconhecido(RuntimeError):
    """A fonte publicou num campo de domínio um valor que o enum não conhece."""

    def __init__(self, campo: str, valor: object):
        super().__init__(f"{campo}: valor {valor!r} não está no enum. A fonte mudou o domínio; acrescente o valor em tipos.py e no enum C#.")


class TipoCasa(StrEnum):
    """As duas casas do Congresso (`TipoCasa` no C#)."""

    CAMARA = "CAMARA"
    SENADO = "SENADO"


class TipoCargo(StrEnum):
    """Os cargos eletivos que a base guarda (`TipoCargo` no C#). Vereador fica fora (Pendência 90)."""

    PRESIDENTE = "PRESIDENTE"
    VICE_PRESIDENTE = "VICE_PRESIDENTE"
    SENADOR = "SENADOR"
    DEPUTADO_FEDERAL = "DEPUTADO_FEDERAL"
    GOVERNADOR = "GOVERNADOR"
    VICE_GOVERNADOR = "VICE_GOVERNADOR"
    DEPUTADO_ESTADUAL = "DEPUTADO_ESTADUAL"
    DEPUTADO_DISTRITAL = "DEPUTADO_DISTRITAL"
    PREFEITO = "PREFEITO"
    VICE_PREFEITO = "VICE_PREFEITO"


CARGOS_DO_CONGRESSO = frozenset({TipoCargo.SENADOR, TipoCargo.DEPUTADO_FEDERAL})
"""Os cargos cuja pessoa nasce da Câmara e do Senado, e não do TSE."""
CARGOS_MUNICIPAIS = frozenset({TipoCargo.PREFEITO, TipoCargo.VICE_PREFEITO})
CARGOS_NACIONAIS = frozenset({TipoCargo.PRESIDENTE, TipoCargo.VICE_PRESIDENTE})

_CARGO_DO_TSE: dict[str, TipoCargo | None] = {
    "1": TipoCargo.PRESIDENTE,
    "2": TipoCargo.VICE_PRESIDENTE,
    "3": TipoCargo.GOVERNADOR,
    "4": TipoCargo.VICE_GOVERNADOR,
    "5": TipoCargo.SENADOR,
    "6": TipoCargo.DEPUTADO_FEDERAL,
    "7": TipoCargo.DEPUTADO_ESTADUAL,
    "8": TipoCargo.DEPUTADO_DISTRITAL,
    "9": None,
    "10": None,
    "11": TipoCargo.PREFEITO,
    "12": TipoCargo.VICE_PREFEITO,
    "13": None,
}
"""`CD_CARGO` do TSE. `None` é cargo conhecido e fora do escopo: suplentes de senador (9 e 10) e vereador (13)."""


def cargo_do_tse(codigo: str | None) -> TipoCargo | None:
    """O cargo de `CD_CARGO`; `None` para os cargos fora do escopo."""
    try:
        return _CARGO_DO_TSE[codigo or ""]
    except KeyError:
        raise ValorDesconhecido("CD_CARGO", codigo) from None


def anos_do_mandato(cargo: TipoCargo, ano_eleicao: int) -> tuple[int, int]:
    """O primeiro e o último ano do mandato previsto: oito anos para senador, quatro para o resto."""
    duracao = 8 if cargo is TipoCargo.SENADOR else 4
    return ano_eleicao + 1, ano_eleicao + duracao


class TipoSituacaoNoTurno(StrEnum):
    """`DS_SIT_TOT_TURNO` do TSE. Só os três primeiros são eleitos."""

    ELEITO = "ELEITO"
    ELEITO_POR_QP = "ELEITO_POR_QP"
    ELEITO_POR_MEDIA = "ELEITO_POR_MEDIA"
    SEGUNDO_TURNO = "SEGUNDO_TURNO"
    SUPLENTE = "SUPLENTE"
    NAO_ELEITO = "NAO_ELEITO"
    SEM_RESULTADO = "SEM_RESULTADO"
    FORA_DA_DISPUTA = "FORA_DA_DISPUTA"


ELEITOS = frozenset({TipoSituacaoNoTurno.ELEITO, TipoSituacaoNoTurno.ELEITO_POR_QP, TipoSituacaoNoTurno.ELEITO_POR_MEDIA})

_SITUACAO_DO_TSE: dict[str, TipoSituacaoNoTurno] = {
    "ELEITO": TipoSituacaoNoTurno.ELEITO,
    "ELEITO POR QP": TipoSituacaoNoTurno.ELEITO_POR_QP,
    "ELEITO POR MÉDIA": TipoSituacaoNoTurno.ELEITO_POR_MEDIA,
    "MÉDIA": TipoSituacaoNoTurno.ELEITO_POR_MEDIA,
    "2º TURNO": TipoSituacaoNoTurno.SEGUNDO_TURNO,
    "SUPLENTE": TipoSituacaoNoTurno.SUPLENTE,
    "NÃO ELEITO": TipoSituacaoNoTurno.NAO_ELEITO,
    "#NULO": TipoSituacaoNoTurno.SEM_RESULTADO,
    "#NULO#": TipoSituacaoNoTurno.SEM_RESULTADO,
    "REGISTRO NEGADO ANTES DA ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "REGISTRO NEGADO APÓS A ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "INDEFERIDO COM RECURSO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "CASSADO COM RECURSO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "SUBSTITUÍDO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "RENÚNCIA/FALECIMENTO COM SUBSTITUIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "RENÚNCIA/FALECIMENTO/CASSAÇÃO ANTES DA ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
    "RENÚNCIA/FALECIMENTO/CASSAÇÃO APÓS A ELEIÇÃO": TipoSituacaoNoTurno.FORA_DA_DISPUTA,
}
"""MEDIDO em 2026-10-21 nos arquivos de 2000 a 2024. `MÉDIA` é a grafia de 2010 para eleito por média."""


def situacao_do_tse(texto: str | None) -> TipoSituacaoNoTurno:
    """A situação de `DS_SIT_TOT_TURNO`, por igualdade exata: "contém ELEITO" pegaria NÃO ELEITO."""
    try:
        return _SITUACAO_DO_TSE[texto or ""]
    except KeyError:
        raise ValorDesconhecido("DS_SIT_TOT_TURNO", texto) from None


class TipoSexo(StrEnum):
    """`TipoSexo` no C#."""

    M = "M"
    F = "F"


_SEXO_DO_TSE: dict[str, TipoSexo | None] = {"2": TipoSexo.M, "4": TipoSexo.F, "-4": None, "-1": None, "0": None}
"""`CD_GENERO` do TSE; `-4` é não divulgável e `-1` e `0` (em 2000), não informado. MEDIDO em 2026-10-21."""


def sexo_do_tse(codigo: str | None) -> TipoSexo | None:
    try:
        return _SEXO_DO_TSE[codigo or ""]
    except KeyError:
        raise ValorDesconhecido("CD_GENERO", codigo) from None
