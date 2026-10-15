"""Cartão de Pagamento da Defesa Civil (CPDC): o dinheiro federal que estados e municípios gastam em desastres.

## ENTRADA

| | |
|---|---|
| Contrato | `contratos.portal.LinhaDoCartaoDaDefesaCivil` |
| Arquivo | `download-de-dados/cpdc/AAAAMM`, um ZIP por mês de extrato |
| Tamanho | de algumas dezenas a mil e poucas transações por mês |
| Decimal | vírgula |

## TRANSFORMAÇÃO

As transações do mês são somadas por executor e CNPJ do convenente. Nenhuma linha fica de
fora: estorno entra negativo, e a soma da base é a soma do arquivo.

| Executor no arquivo | Esfera |
|---|---|
| `GOVERNO DO ESTADO / RS` | `ESTADUAL` |
| `ASSIS BRASIL / AC` | `MUNICIPAL` |
| `Sem informação / -1` | `NAO_INFORMADA`, sem UF |

## SAÍDA

| | |
|---|---|
| Contrato | `contratos.banco.GastoDaDefesaCivil` → tabela `gastos_da_defesa_civil` |
| Idempotência | `DELETE` do mês antes do `INSERT` |

---

DECISÃO (2026-10-09): o CPDC entra separado do cartão corporativo. O cartão corporativo
é gasto de órgão federal; o da Defesa Civil é gasto do ente local com dinheiro federal. Somar
os dois daria um "cartão do governo" que não existe.

MEDIDO (2026-10-09): R$ 1.444,7 mi de 2023 a ago/2026, 17.934 transações, 1.242 executores. O
Portal responde 403 para os extratos de jan/2023 e nov/2025, e os meses vizinhos baixam: são
arquivos que ele não publicou. A carga segue para o mês seguinte em vez de parar.

DECISÃO: o município fica pelo CNPJ do convenente, não pelo nome: o projeto não casa cidade por
nome (ver `municipios.py`).
"""

from collections import defaultdict
from collections.abc import Iterable

from .contratos.banco import GastoDaDefesaCivil
from .contratos.entrada import LayoutMudou
from .contratos.portal import LinhaDoCartaoDaDefesaCivil
from .normalizacao import inteiro, valor_pt_br

RECURSO = "cpdc/{ano}{mes:02d}"

GOVERNO_DO_ESTADO = "GOVERNO DO ESTADO"

SEM_EXECUTOR = "Sem informação / -1"
"""MEDIDO (2026-10-09): 14 transações em ago/2019, em convênio do próprio Ministério da Integração."""

SEPARADOR_DA_UF = " / "


def arquivo_do_mes(ano: int, mes: int) -> str:
    """O CSV dentro do ZIP do mês."""
    return f"{ano}{mes:02d}_CPDC.csv"


def transformar(linhas: Iterable[LinhaDoCartaoDaDefesaCivil]) -> list[GastoDaDefesaCivil]:
    """As transações do arquivo, somadas por mês, executor e CNPJ do convenente."""
    somas: dict[tuple, list] = defaultdict(lambda: [0.0, 0])
    for linha in linhas:
        executor, uf = separar_executor(linha.executor)
        chave = (inteiro(linha.ano_do_extrato), inteiro(linha.mes_do_extrato), executor, uf, linha.cnpj_do_convenente or "")
        somas[chave][0] += valor_pt_br(linha.valor)
        somas[chave][1] += 1

    return [
        GastoDaDefesaCivil(
            ano=ano, mes=mes, executor=executor, uf=uf,
            esfera=_esfera(executor, uf),
            cnpj_convenente=cnpj, valor=round(valor, 2), transacoes=transacoes,
        )
        for (ano, mes, executor, uf, cnpj), (valor, transacoes) in sorted(somas.items())
    ]


def separar_executor(bruto: str | None) -> tuple[str, str | None]:
    """`"ASSIS BRASIL / AC"` → `("ASSIS BRASIL", "AC")`; `"Sem informação / -1"` → `("Sem informação", None)`.

    RISCO: qualquer outro executor sem a UF no fim derruba a carga. Gravar sem UF tiraria a linha
    do total por estado sem nenhum aviso; o único caso aceito é o que o Portal escreve como sem
    informação, e ele fica à vista na tela.
    """
    if (bruto or "").strip() == SEM_EXECUTOR:
        return SEM_EXECUTOR.split(SEPARADOR_DA_UF)[0], None
    nome, separador, uf = (bruto or "").rpartition(SEPARADOR_DA_UF)
    if not separador or len(uf) != 2 or not uf.isalpha() or not nome.strip():
        raise LayoutMudou(f"Executor fora do formato 'NOME / UF': {bruto!r}")
    return nome.strip(), uf.upper()


def _esfera(executor: str, uf: str | None) -> str:
    if uf is None:
        return "NAO_INFORMADA"
    return "ESTADUAL" if executor == GOVERNO_DO_ESTADO else "MUNICIPAL"
