"""Contrato de entrada da DCA do Siconfi: só as colunas lidas."""

from dataclasses import dataclass

from .entrada import coluna


@dataclass(frozen=True)
class LinhaDaDca:
    """Uma linha da DCA: um valor de uma conta, numa coluna (realizado, empenhado, pago...)."""

    ano: str | None = coluna("exercicio")
    codigo_ibge: str | None = coluna("cod_ibge")
    coluna_da_dca: str | None = coluna("coluna")
    cod_conta: str | None = coluna("cod_conta")
    valor: str | None = coluna("valor")
