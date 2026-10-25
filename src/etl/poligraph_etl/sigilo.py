"""O gasto que o Portal da Transparência publica sem detalhe, por sigilo.

Responde *"quanto o governo gastou sem dizer em quê?"* — até onde o próprio Portal marca.

## Duas origens

| Origem | O que aparece | O que não | De onde |
|---|---|---|---|
| Cartão corporativo (CPGF) | valor e órgão | portador, favorecido e data | `cpgf/AAAAMM` |
| Ação de caráter sigiloso | valor, órgão e a ação | a finalidade | `despesas-execucao/AAAAMM` |

MEDIDO: Medido em 2026-09-25, meses de 2023 a ago/2026:

| Ano | Cartão sigiloso | Cartão total | Ação sigilosa (pago + restos) |
|---|---:|---:|---:|
| 2023 | R$ 44,8 mi | R$ 90,7 mi | R$ 8,3 mi |
| 2024 | R$ 55,5 mi | R$ 111,8 mi | R$ 10,3 mi |
| 2025 | R$ 50,6 mi | R$ 122,3 mi | R$ 7,7 mi |

No cartão, o sigiloso é quase só da Presidência e do Ministério da Justiça. A ação é a
2866, quase toda do Ministério da Defesa.

---

ATENÇÃO: **É só o que o Portal MARCA.** Órgão de inteligência também gasta em ação de nome
comum, e esse gasto não entra aqui. A tela diz isso.

ATENÇÃO: No cartão o ano é o do **extrato**: a data da compra é justamente o que o sigilo
esconde.

RISCO: O arquivo do cartão traz o CPF do portador, mascarado. Não É lido: `COLUNAS_DO_CARTAO`
deixa a coluna de fora.
"""

import pandas as pd

from . import normalizacao
from .contratos.portal import NOME_SIGILOSO

RECURSO_DO_CARTAO = "cpgf/{ano}{mes:02d}"

COLUNAS_DO_CARTAO = ["NOME ÓRGÃO SUPERIOR", "NOME PORTADOR", "VALOR TRANSAÇÃO"]

# O Portal escreve "Sigiloso" no nome do portador e do favorecido da transação protegida.
MARCA_DO_CARTAO = NOME_SIGILOSO

COLUNAS_DA_ACAO = ["Nome Órgão Superior", "Código Ação", "Nome Ação"]

# DECISÃO: Pelo NOME da ação, não pelo código: a pergunta é "o que o orçamento declara
#    sigiloso", e uma ação sigilosa nova entraria sem mudar código. Hoje é só a 2866.
MARCA_DA_ACAO = "SIGILOS"


def arquivo_do_cartao(ano: int, mes: int) -> str:
    return f"{ano}{mes:02d}_CPGF.csv"


def cartao_do_mes(df: pd.DataFrame) -> dict[str, dict]:
    """Órgão superior → total gasto no cartão, a parte sigilosa e quantas transações sigilosas."""
    valor = df["VALOR TRANSAÇÃO"].map(normalizacao.valor_pt_br)
    sigiloso = df["NOME PORTADOR"].str.strip() == MARCA_DO_CARTAO

    por_orgao: dict[str, dict] = {}
    for orgao, grupo in valor.groupby(df["NOME ÓRGÃO SUPERIOR"].str.strip()):
        marcas = sigiloso[grupo.index]
        por_orgao[orgao] = {
            "total": float(grupo.sum()),
            "sigiloso": float(grupo[marcas].sum()),
            "lancamentos": int(marcas.sum()),
        }
    return por_orgao


def acoes_do_mes(df: pd.DataFrame) -> dict[str, float]:
    """Órgão superior → pago no mês em ação sigilosa, somando o do exercício e os restos a pagar."""
    sigilosa = df["Nome Ação"].str.upper().str.contains(MARCA_DA_ACAO, na=False)
    if not sigilosa.any():
        return {}

    linhas = df[sigilosa]
    pago = linhas["Valor Pago (R$)"].map(normalizacao.valor_pt_br) + linhas[
        "Valor Restos a Pagar Pagos (R$)"
    ].map(normalizacao.valor_pt_br)
    return {orgao: float(v) for orgao, v in pago.groupby(linhas["Nome Órgão Superior"].str.strip()).sum().items()}


def nomes_de_orgao(df: pd.DataFrame) -> set[str]:
    """Os nomes de órgão superior do arquivo anual do orçamento, que vêm completos.

    MEDIDO em 2026-10-03: o arquivo do cartão e o mensal de execução cortam o nome em 42
    caracteres; o anual do orçamento (`NOME ÓRGÃO SUPERIOR`) traz o nome inteiro.
    """
    return set(df["NOME ÓRGÃO SUPERIOR"].dropna().str.strip())


def nome_completo(nome: str, completos: set[str]) -> str:
    """O nome do órgão sem o corte do arquivo do cartão (Pendência 85).

    MEDIDO em 2026-10-03: o arquivo do cartão corporativo corta o nome do órgão superior em 42
    caracteres ("Ministério da Integração e do Desenvolvime"). O arquivo anual do orçamento, do
    mesmo Portal, traz o nome inteiro. Completa só quando um único nome completo começa pelo
    cortado; havendo nenhum ou mais de um, fica o do cartão.
    """
    if nome in completos:
        return nome
    candidatos = [c for c in completos if c.startswith(nome)]
    return candidatos[0] if len(candidatos) == 1 else nome


def somar_cartao(meses: list[dict[str, dict]]) -> dict[str, dict]:
    total: dict[str, dict] = {}
    for mes in meses:
        for orgao, valores in mes.items():
            acumulado = total.setdefault(orgao, {"total": 0.0, "sigiloso": 0.0, "lancamentos": 0})
            for chave in acumulado:
                acumulado[chave] += valores[chave]
    return total


def somar_acoes(meses: list[dict[str, float]]) -> dict[str, float]:
    total: dict[str, float] = {}
    for mes in meses:
        for orgao, valor in mes.items():
            total[orgao] = total.get(orgao, 0.0) + valor
    return total


def para_linhas(ano: int, cartao: dict[str, dict], meses_do_cartao: int,
                acoes: dict[str, float], meses_da_acao: int, completos: set[str] | None = None) -> list[dict]:
    """As linhas de `gastos_sigilosos` de um ano.

    ATENÇÃO: A ação entra só com valor positivo: o órgão "Sem informação" soma estorno de
    centavos, e uma linha negativa afirmaria gasto sigiloso negativo.
    """
    linhas = [
        {"ano": ano, "origem": "CARTAO_CORPORATIVO", "orgao_superior": nome_completo(orgao, completos or set()),
         "sigiloso": round(v["sigiloso"], 2), "total": round(v["total"], 2),
         "lancamentos": v["lancamentos"], "meses": meses_do_cartao}
        for orgao, v in cartao.items()
    ]
    linhas += [
        {"ano": ano, "origem": "ACAO_SIGILOSA", "orgao_superior": orgao,
         "sigiloso": round(valor, 2), "total": round(valor, 2),
         "lancamentos": None, "meses": meses_da_acao}
        for orgao, valor in acoes.items()
        if round(valor, 2) > 0
    ]
    return linhas
