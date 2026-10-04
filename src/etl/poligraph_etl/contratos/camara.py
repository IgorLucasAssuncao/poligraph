"""Contratos de entrada da Câmara dos Deputados."""

from dataclasses import dataclass

from .entrada import coluna


@dataclass(frozen=True)
class LinhaDaCotaDaCamara:
    """Uma nota do arquivo anual da cota parlamentar (CEAP): `www.camara.leg.br/cotas/Ano-{ano}.csv.zip`.

    CSV com ponto e vírgula, UTF-8 com BOM, decimal com PONTO. Liderança e órgão vêm sem
    `ideCadastro`: são linhas que não têm deputado.
    """

    id_deputado_na_camara: str | None = coluna("ideCadastro")
    ano_da_despesa: str | None = coluna("numAno")
    mes_da_despesa: str | None = coluna("numMes")
    categoria: str | None = coluna("txtDescricao")
    fornecedor: str | None = coluna("txtFornecedor")
    cnpj_ou_cpf_do_fornecedor: str | None = coluna("txtCNPJCPF")
    valor_liquido: str | None = coluna("vlrLiquido")
    data_de_emissao: str | None = coluna("datEmissao")
    url_do_documento: str | None = coluna("urlDocumento")
