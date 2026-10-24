"""Contrato de entrada do Banco Central: uma observação de série do SGS (`api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}`)."""

from dataclasses import dataclass

from .entrada import coluna


@dataclass(frozen=True)
class LinhaDaSerie:
    """Um mês da série: `data` no formato `dd/mm/aaaa` e `valor` com ponto decimal, como o JSON do SGS manda."""

    data: str | None = coluna("data")
    valor: str | None = coluna("valor")
