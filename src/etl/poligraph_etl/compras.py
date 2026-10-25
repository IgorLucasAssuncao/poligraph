"""Compras e contratos do Executivo federal: quanto cada órgão contratou, de que modo e com quem.

## ENTRADA

`contratos.portal.LinhaDeCompra`, do membro `AAAAMM_Compras.csv` de `download-de-dados/compras/AAAAMM`:
os contratos publicados no Diário Oficial no mês. CSV latin-1, ponto e vírgula, decimal com vírgula.

## TRANSFORMAÇÃO

| Saída | Soma por | O que soma |
|---|---|---|
| `ContratacoesDoOrgao` | mês do arquivo, órgão superior e modalidade | contratos, sigilosos, valor, divergentes e valor descartado |
| `ContratadoDoGoverno` | ano e CNPJ do contratado | contratos e valor |

O valor de cada contrato sai de `valor_do_contrato`. Nenhum contrato fica de fora da primeira tabela.
A segunda só tem CNPJ; o contrato sigiloso (contratado `-11`) conta como sigiloso na primeira.

## SAÍDA

`contratacoes_do_orgao` e `contratados_do_governo`, substituindo o ano inteiro.

---

MEDIDO (2026-10-09): os dois valores da fonte trazem erro de digitação. Jan/2025: valor inicial de
R$ 1,96 tri num contrato de valor final R$ 1,4 mi. 2022: valor final de R$ 55,84 bi num contrato de
valor inicial R$ 1 mi; os 7 contratos acima de R$ 1 bi daquele ano somavam R$ 72 bi de R$ 139 bi.
82% dos contratos de jan/2025 vêm com modalidade `Sem Informação`. Republicação entra de novo: 17
de 3.710 contratos de fev/2025 já estavam em jan.
"""

from collections import Counter, defaultdict
from collections.abc import Iterable

from .contratos.banco import ContratacoesDoOrgao, ContratadoDoGoverno
from .contratos.portal import NOME_SIGILOSO, LinhaDeCompra
from .normalizacao import sem_cpf, valor_pt_br

RECURSO = "compras/{ano}{mes:02d}"

CONTRATADO_SIGILOSO = "-11"

SEM_INFORMACAO = "Sem Informação"

LIMITE_DE_DIVERGENCIA = 100
"""Acima de 100 vezes entre o valor inicial e o final, um dos dois é erro de digitação."""


def membro(ano: int, mes: int) -> str:
    """O CSV dos contratos dentro do ZIP do mês."""
    return f"{ano}{mes:02d}_Compras.csv"


def eh_sigiloso(linha: LinhaDeCompra) -> bool:
    """Contratado e objeto protegidos: o Portal escreve `-11` no código e `Sigiloso` no nome."""
    return linha.codigo_do_contratado == CONTRATADO_SIGILOSO or (linha.nome_do_contratado or "") == NOME_SIGILOSO


def valor_do_contrato(linha: LinhaDeCompra) -> tuple[float, float]:
    """O valor que entra e o que fica de fora, em reais.

    DECISÃO (2026-10-09): o valor final, salvo quando ele e o inicial divergem mais de
    `LIMITE_DE_DIVERGENCIA` vezes: aí um dos dois é erro de digitação, e entra o menor. O que o maior
    somaria a mais é devolvido como descartado, para ficar à vista. Aditivo de verdade raramente
    multiplica um contrato por 100; erro de vírgula multiplica por 1.000 ou mais.
    """
    inicial, final = valor_pt_br(linha.valor_inicial), valor_pt_br(linha.valor_final)
    menor, maior = sorted((abs(inicial), abs(final)))
    if menor > 0 and maior / menor > LIMITE_DE_DIVERGENCIA:
        valor = inicial if abs(inicial) == menor else final
        return valor, maior - menor
    return final, 0.0


def por_orgao(ano: int, mes: int, linhas: Iterable[LinhaDeCompra]) -> list[ContratacoesDoOrgao]:
    """Os contratos do mês por órgão superior e modalidade."""
    somas: dict[tuple[str, str], list] = defaultdict(lambda: [0, 0, 0.0, 0, 0.0])
    for linha in linhas:
        soma = somas[((linha.orgao_superior or "").strip(), linha.modalidade or SEM_INFORMACAO)]
        valor, descartado = valor_do_contrato(linha)
        soma[0] += 1
        soma[1] += eh_sigiloso(linha)
        soma[2] += valor
        soma[3] += descartado > 0
        soma[4] += descartado
    return [
        ContratacoesDoOrgao(ano=ano, mes=mes, orgao_superior=orgao, modalidade=modalidade,
                            contratos=contratos, sigilosos=sigilosos, valor=round(valor, 2),
                            divergentes=divergentes, valor_descartado=round(descartado, 2))
        for (orgao, modalidade), (contratos, sigilosos, valor, divergentes, descartado) in sorted(somas.items())
    ]


def contratados(ano: int, linhas: Iterable[LinhaDeCompra]) -> list[ContratadoDoGoverno]:
    """As empresas do ano, com o nome mais frequente do CNPJ: o mesmo CNPJ vem grafado de mais de um jeito.

    RISCO: o nome do MEI traz o CPF do dono, e sai sem ele (`sem_cpf`). MEDIDO em 2026-10-23: 1.614 contratados gravados
    com 11 dígitos no nome, e 16 com o CPF pontuado.
    """
    somas: dict[str, list] = defaultdict(lambda: [0, 0.0])
    nomes: dict[str, Counter] = defaultdict(Counter)
    for linha in linhas:
        cnpj = linha.codigo_do_contratado or ""
        if len(cnpj) != 14 or not cnpj.isdigit():
            continue
        somas[cnpj][0] += 1
        somas[cnpj][1] += valor_do_contrato(linha)[0]
        nomes[cnpj][sem_cpf(linha.nome_do_contratado) or ""] += 1
    return [
        ContratadoDoGoverno(ano=ano, cnpj=cnpj, nome=nomes[cnpj].most_common(1)[0][0], contratos=contratos,
                            valor=round(valor, 2))
        for cnpj, (contratos, valor) in sorted(somas.items())
    ]
