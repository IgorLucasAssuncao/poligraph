"""Contratos de entrada do Portal da Transparência."""

from dataclasses import dataclass

from .entrada import coluna


@dataclass(frozen=True)
class LinhaDoCartaoDaDefesaCivil:
    """Uma transação do Cartão de Pagamento da Defesa Civil: `download-de-dados/cpdc/AAAAMM`.

    CSV com ponto e vírgula, latin-1, decimal com vírgula, dentro de um ZIP com `AAAAMM_CPDC.csv`.
    O executor vem como `"ASSIS BRASIL / AC"` ou `"GOVERNO DO ESTADO / RS"`.

    RISCO: o arquivo traz o CPF do portador (mascarado) e o CPF ou CNPJ do favorecido. Nenhum
    dos dois está aqui, e por isso nenhum dos dois é lido.
    """

    ano_do_extrato: str | None = coluna("ANO EXTRATO")
    mes_do_extrato: str | None = coluna("MÊS EXTRATO")
    executor: str | None = coluna("EXECUTOR DESPESA")
    cnpj_do_convenente: str | None = coluna("CÓDIGO CONVENENTE")
    valor: str | None = coluna("VALOR TRANSAÇÃO")
