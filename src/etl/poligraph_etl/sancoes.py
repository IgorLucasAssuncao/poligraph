"""Sanções a empresas: o CEIS (inidôneas e suspensas) e o CNEP (punidas pela Lei Anticorrupção).

## ENTRADA

`contratos.portal.LinhaDeSancao`, mais `VALOR DA MULTA` no CNEP. Um ZIP por cadastro, retrato do dia:
`download-de-dados/ceis/AAAAMMDD` e `cnep/AAAAMMDD`.

## TRANSFORMAÇÃO

Só CNPJ (14 dígitos) entra. Datas `dd/mm/aaaa` viram ISO; vazia vira `None`.

## SAÍDA

`contratos.banco.SancaoDeEmpresa` → `sancoes_de_empresas`. A carga troca a tabela inteira: o
cadastro é um retrato, e sanção que saiu dele não vale mais.

---

RISCO: os dois cadastros trazem pessoa física com CPF sem máscara. MEDIDO (2026-10-09): 9.101
linhas no CEIS e 40 no CNEP. Elas são descartadas aqui, antes de qualquer gravação.

MEDIDO (2026-10-09): 14.612 sanções a empresas no CEIS e 1.788 no CNEP; 3.536 sem data final.
"""

from collections.abc import Iterable

from .contratos.banco import SancaoDeEmpresa
from .contratos.portal import LinhaDeSancao
from .normalizacao import valor_pt_br

RECURSO = "{cadastro}/{data}"

CADASTROS = ("ceis", "cnep")

ESFERAS = ("FEDERAL", "ESTADUAL", "MUNICIPAL")


def membro(cadastro: str, data: str) -> str:
    """O CSV dentro do ZIP do dia: `20261009_CEIS.csv`."""
    return f"{data}_{cadastro.upper()}.csv"


def para_empresas(linhas: Iterable[LinhaDeSancao], multas: Iterable[str | None] | None = None) -> list[SancaoDeEmpresa]:
    """As sanções a empresa. `multas` vem na mesma ordem das linhas, só no CNEP."""
    multas = list(multas) if multas is not None else None
    sancoes = []
    for indice, linha in enumerate(linhas):
        documento = linha.documento or ""
        if len(documento) != 14 or not documento.isdigit():
            continue
        multa = valor_pt_br(multas[indice]) if multas is not None and multas[indice] else None
        sancoes.append(SancaoDeEmpresa(
            cadastro=(linha.cadastro or "").upper(), codigo_da_sancao=linha.codigo_da_sancao or "", cnpj=documento,
            nome=linha.nome or "", categoria=linha.categoria or "", inicio=_data_iso(linha.inicio), fim=_data_iso(linha.fim),
            orgao_sancionador=linha.orgao_sancionador or "",
            esfera=linha.esfera if linha.esfera in ESFERAS else None,
            fundamentacao_legal=linha.fundamentacao_legal, valor_da_multa=multa,
        ))
    return sancoes


def _data_iso(bruto: str | None) -> str | None:
    """`dd/mm/aaaa` → `aaaa-mm-dd`."""
    partes = (bruto or "").split("/")
    if len(partes) != 3 or not all(parte.isdigit() for parte in partes):
        return None
    dia, mes, ano = partes
    return f"{ano}-{mes}-{dia}"
