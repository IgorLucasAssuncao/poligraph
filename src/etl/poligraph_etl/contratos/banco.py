"""Contratos de saída: a linha como fica no banco.

Os campos têm o nome das colunas que o EF cria (`UseSnakeCaseNamingConvention`). `id` e
`carga_id` ficam de fora: o primeiro é do banco, o segundo é da carga, posto na gravação.
`tests/test_contratos.py` confere cada contrato contra a tabela real.
"""

from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class Despesa:
    """Uma linha de `despesas` (DespesaModel): uma nota da cota, da Câmara ou do Senado.

    RISCO: `cnpj_ou_hash` guarda o CNPJ legível ou o HMAC do CPF; `fornecedor_eh_pessoa_fisica`
    diz qual dos dois. CPF em claro nunca chega aqui.
    """

    TABELA: ClassVar[str] = "despesas"

    pessoa_id: int
    ano: int
    mes: int
    categoria: str
    fornecedor: str | None
    cnpj_ou_hash: str | None
    fornecedor_eh_pessoa_fisica: bool
    valor_liquido: float
    data_emissao: str | None
    url_documento: str | None
