"""Contratos de entrada do Senado Federal."""

from dataclasses import dataclass

from .entrada import coluna


@dataclass(frozen=True)
class LinhaDaCotaDoSenado:
    """Uma despesa da cota do Senado (CEAPS): `www.senado.gov.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv`.

    Latin-1, ponto e vírgula, decimal com VÍRGULA, data em dd/mm/aaaa. Não há id de
    senador: o dono sai do nome, e o arquivo não publica link do documento.
    """

    nome_do_senador: str | None = coluna("SENADOR")
    ano_da_despesa: str | None = coluna("ANO")
    mes_da_despesa: str | None = coluna("MES")
    categoria: str | None = coluna("TIPO_DESPESA")
    fornecedor: str | None = coluna("FORNECEDOR")
    cnpj_ou_cpf_do_fornecedor: str | None = coluna("CNPJ_CPF")
    valor_reembolsado: str | None = coluna("VALOR_REEMBOLSADO")
    data_da_despesa: str | None = coluna("DATA")
