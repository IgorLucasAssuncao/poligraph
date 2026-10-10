"""Viagens a serviço do Executivo federal: quanto cada órgão gastou em diárias e passagens, e para onde foi.

## ENTRADA

| Membro do ZIP `viagens/AAAA` | Contrato | O que se lê |
|---|---|---|
| `AAAA_Pagamento.csv` | `LinhaDePagamentoDeViagem` | órgão, tipo e valor de cada pagamento |
| `AAAA_Viagem.csv` | `LinhaDeViagem` | órgão, situação e urgência de cada viagem |
| `AAAA_Trecho.csv` | `LinhaDeTrechoDeViagem` | destino e diárias de cada trecho |

## TRANSFORMAÇÃO

| Tipo no arquivo | Coluna |
|---|---|
| `DIÁRIAS` (e `DIRIAS`) | `diarias` |
| `PASSAGEM` | `passagens` |
| `RESTITUIÇÃO` (e `RESTITUIO`) | `restituicao` |
| `Serviço correlato: seguro` | `seguro` |

Nenhum pagamento fica de fora: a soma das quatro colunas é a soma do arquivo. Tipo novo derruba a
carga com `LayoutMudou`, em vez de ficar sem coluna.

O órgão de cada pagamento e de cada trecho é o da viagem, pelo identificador do processo. O
pagamento publicado com órgão `Sigiloso` vai para o órgão da viagem quando `Viagem.csv` o publica
aberto, e o valor fica também em `pago_com_orgao_sigiloso`, para a tela dizer quanto veio assim.
Trecho sem viagem no arquivo fica em `SEM_VIAGEM`.

## SAÍDA

`contratos.banco.ViagensDoOrgao` → `viagens_do_orgao`; `contratos.banco.DestinoDeViagem` →
`destinos_de_viagem`. A carga substitui o ano inteiro.

---

ATENÇÃO: hospedagem não tem valor próprio. A diária paga hospedagem, alimentação e deslocamento
urbano (Decreto 5.992/2006); a tela diz isso.

MEDIDO (2026-10-09): 2026 até setembro, R$ 1,34 bi pagos (R$ 743,7 mi em diárias, R$ 584,7 mi em
passagens). R$ 235 mi vêm com o órgão `Sigiloso`, que entra como está. 14 trechos têm destino
`Inválido` nos três campos e entram como estão, sem UF.
"""

from collections import defaultdict
from collections.abc import Iterable

from .contratos.banco import DestinoDeViagem, ViagensDoOrgao
from .contratos.entrada import LayoutMudou
from .contratos.portal import LinhaDePagamentoDeViagem, LinhaDeTrechoDeViagem, LinhaDeViagem
from .normalizacao import sem_acento_maiusculo, valor_pt_br

RECURSO = "viagens/{ano}"

MEMBROS = {"pagamento": "Pagamento", "viagem": "Viagem", "trecho": "Trecho"}

TIPOS = (("DIARIAS", "DI"), ("PASSAGENS", "PASSAG"), ("RESTITUICAO", "RESTITU"), ("SEGURO", "SERVI"))
"""O começo de cada tipo, sem acento: o arquivo também traz o tipo com a letra acentuada faltando."""

BRASIL = "Brasil"

SIGILOSO = "Sigiloso"

SEM_VIAGEM = "Sem viagem no arquivo"


def membro(ano: int, qual: str) -> str:
    """O nome do CSV dentro do ZIP do ano."""
    return f"{ano}_{MEMBROS[qual]}.csv"


def tipo_do_pagamento(bruto: str | None) -> str:
    """`"DIÁRIAS"` e `"DIRIAS"` → `"DIARIAS"`. Tipo que nenhum começo reconhece derruba a carga."""
    texto = sem_acento_maiusculo(bruto)
    for tipo, comeco in TIPOS:
        if texto.startswith(comeco):
            return tipo
    raise LayoutMudou(f"Tipo de pagamento de viagem desconhecido: {bruto!r}")


def orgao_da_viagem(viagens: Iterable[LinhaDeViagem]) -> dict[str, str]:
    """O órgão superior de cada viagem, pelo identificador do processo."""
    return {(v.identificador or "").strip(): _orgao(v.orgao_superior) for v in viagens}


def por_orgao(
    ano: int,
    pagamentos: Iterable[LinhaDePagamentoDeViagem],
    viagens: Iterable[LinhaDeViagem],
) -> list[ViagensDoOrgao]:
    """O ano por órgão superior: as contagens das viagens e os valores dos pagamentos."""
    viagens = list(viagens)
    orgaos = orgao_da_viagem(viagens)
    valores: dict[str, dict[str, float]] = defaultdict(lambda: dict.fromkeys(dict(TIPOS), 0.0))
    sigilosos: dict[str, float] = defaultdict(float)
    for pagamento in pagamentos:
        orgao = _orgao(pagamento.orgao_superior)
        valor = valor_pt_br(pagamento.valor)
        if orgao == SIGILOSO:
            da_viagem = orgaos.get((pagamento.identificador or "").strip(), SIGILOSO)
            if da_viagem not in (SIGILOSO, ""):
                orgao = da_viagem
                sigilosos[orgao] += valor
        valores[orgao][tipo_do_pagamento(pagamento.tipo)] += valor

    contagens: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
    for viagem in viagens:
        conta = contagens[_orgao(viagem.orgao_superior)]
        conta[0] += 1
        conta[1] += sem_acento_maiusculo(viagem.urgente) == "SIM"
        conta[2] += sem_acento_maiusculo(viagem.situacao).startswith("NAO")

    return [
        ViagensDoOrgao(
            ano=ano, orgao_superior=orgao,
            viagens=contagens[orgao][0], urgentes=contagens[orgao][1], nao_realizadas=contagens[orgao][2],
            diarias=round(valores[orgao]["DIARIAS"], 2), passagens=round(valores[orgao]["PASSAGENS"], 2),
            restituicao=round(valores[orgao]["RESTITUICAO"], 2), seguro=round(valores[orgao]["SEGURO"], 2),
            pago_com_orgao_sigiloso=round(sigilosos[orgao], 2),
        )
        for orgao in sorted(set(valores) | set(contagens))
    ]


def destinos(ano: int, trechos: Iterable[LinhaDeTrechoDeViagem], orgaos: dict[str, str]) -> list[DestinoDeViagem]:
    """Chegadas por órgão e cidade. A UF só vale no Brasil; fora dele o Portal não publica UF."""
    somas: dict[tuple, list] = defaultdict(lambda: [0, 0.0])
    for trecho in trechos:
        pais = trecho.pais_de_destino or ""
        orgao = orgaos.get((trecho.identificador or "").strip()) or SEM_VIAGEM
        chave = (orgao, pais, trecho.uf_de_destino if pais == BRASIL else None, trecho.cidade_de_destino or "")
        somas[chave][0] += 1
        somas[chave][1] += valor_pt_br(trecho.numero_de_diarias)

    return [
        DestinoDeViagem(ano=ano, pais=pais, uf=uf, cidade=cidade, orgao_superior=orgao, chegadas=chegadas,
                        numero_de_diarias=round(diarias, 2))
        for (orgao, pais, uf, cidade), (chegadas, diarias) in sorted(somas.items(), key=lambda item: tuple(map(str, item[0])))
    ]


def _orgao(bruto: str | None) -> str:
    return (bruto or "").strip()
