"""O contrato de entrada: cada campo diz de que coluna do arquivo veio."""

from dataclasses import Field, field, fields, is_dataclass
from typing import Any, Iterable, TypeVar

Contrato = TypeVar("Contrato")


class LayoutMudou(RuntimeError):
    """A fonte deixou de publicar uma coluna que o contrato lê."""


def coluna(nome_na_fonte: str) -> Any:
    """O campo do contrato e o nome da coluna dele no arquivo da fonte."""
    return field(metadata={"coluna": nome_na_fonte})


def colunas_da_fonte(contrato: type) -> dict[str, str]:
    """Campo do contrato → coluna no arquivo, na ordem em que o contrato declara."""
    if not is_dataclass(contrato):
        raise TypeError(f"{contrato!r} não é um contrato: precisa ser dataclass.")
    campos: tuple[Field, ...] = fields(contrato)
    return {c.name: c.metadata["coluna"] for c in campos}


def ler(contrato: type[Contrato], registros: Iterable[dict]) -> list[Contrato]:
    """Os registros crus do arquivo, como linhas do contrato.

    A conferência das colunas é feita no primeiro registro: o cabeçalho é o mesmo para o
    arquivo inteiro. Arquivo vazio devolve lista vazia, e quem decide se isso é erro é o
    canário de volume da fonte.
    """
    mapa = colunas_da_fonte(contrato)
    linhas: list[Contrato] = []
    for registro in registros:
        if not linhas:
            faltam = sorted(nome for nome in mapa.values() if nome not in registro)
            if faltam:
                raise LayoutMudou(f"{contrato.__name__}: a fonte não traz mais {', '.join(faltam)}.")
        linhas.append(contrato(**{campo: _limpo(registro.get(nome)) for campo, nome in mapa.items()}))
    return linhas


def _limpo(valor: object) -> str | None:
    """Texto sem espaço nas pontas; vazio vira `None`."""
    texto = "" if valor is None else str(valor).strip()
    return texto or None
