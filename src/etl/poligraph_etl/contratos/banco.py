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


@dataclass(frozen=True)
class GastoDaDefesaCivil:
    """Uma linha de `gastos_da_defesa_civil` (GastoDaDefesaCivilModel): o cartão da Defesa Civil num mês, por executor."""

    TABELA: ClassVar[str] = "gastos_da_defesa_civil"

    ano: int
    mes: int
    executor: str
    uf: str | None
    esfera: str
    cnpj_convenente: str
    valor: float
    transacoes: int


@dataclass(frozen=True)
class ViagensDoOrgao:
    """Uma linha de `viagens_do_orgao` (ViagensDoOrgaoModel): as viagens de um órgão superior num ano."""

    TABELA: ClassVar[str] = "viagens_do_orgao"

    ano: int
    orgao_superior: str
    viagens: int
    urgentes: int
    nao_realizadas: int
    diarias: float
    passagens: float
    restituicao: float
    seguro: float


@dataclass(frozen=True)
class DestinoDeViagem:
    """Uma linha de `destinos_de_viagem` (DestinoDeViagemModel): chegadas a uma cidade num ano."""

    TABELA: ClassVar[str] = "destinos_de_viagem"

    ano: int
    pais: str
    uf: str | None
    cidade: str
    chegadas: int
    numero_de_diarias: float


@dataclass(frozen=True)
class ContratacoesDoOrgao:
    """Uma linha de `contratacoes_do_orgao` (ContratacoesDoOrgaoModel): um mês, órgão e modalidade."""

    TABELA: ClassVar[str] = "contratacoes_do_orgao"

    ano: int
    mes: int
    orgao_superior: str
    modalidade: str
    contratos: int
    sigilosos: int
    valor: float
    divergentes: int
    valor_descartado: float


@dataclass(frozen=True)
class ContratadoDoGoverno:
    """Uma linha de `contratados_do_governo` (ContratadoDoGovernoModel): uma empresa num ano."""

    TABELA: ClassVar[str] = "contratados_do_governo"

    ano: int
    cnpj: str
    nome: str
    contratos: int
    valor: float


@dataclass(frozen=True)
class SancaoDeEmpresa:
    """Uma linha de `sancoes_de_empresas` (SancaoDeEmpresaModel): uma sanção a empresa, pelo CNPJ."""

    TABELA: ClassVar[str] = "sancoes_de_empresas"

    cadastro: str
    codigo_da_sancao: str
    cnpj: str
    nome: str
    categoria: str
    inicio: str | None
    fim: str | None
    orgao_sancionador: str
    esfera: str | None
    fundamentacao_legal: str | None
    valor_da_multa: float | None


@dataclass(frozen=True)
class CompraCentralizadaNoCartao:
    """Uma linha de `compras_centralizadas_no_cartao` (CompraCentralizadaNoCartaoModel): um órgão num mês."""

    TABELA: ClassVar[str] = "compras_centralizadas_no_cartao"

    ano: int
    mes: int
    orgao_superior: str
    valor: float
    transacoes: int
