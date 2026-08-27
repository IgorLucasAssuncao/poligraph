"""Emendas parlamentares — Portal da Transparência.

⭐ **O instrumento de poder orçamentário do parlamentar.** Responde *"para onde este
deputado mandou dinheiro público, e quanto de fato saiu?"* — com `valorEmpenhado` ×
`valorPago` e o município de destino.

🔴 **A chave é o CÓDIGO DO AUTOR, ⛔ não o nome.** Decisão do autor do projeto, e a
medição a sustenta:

    202541840004
     │   │    └── numeroEmenda
     │   └─────── 4184 ← código do autor
     └─────────── ano

| Medido | |
|---|---|
| Autores com código estável dentro de 2025 | **173 de 173** |
| Códigos com mais de um autor | **0** |
| Estáveis entre 2023 e 2025 | 31 de 33 — ⭐ os 2 viraram **senadores** |

⚠️ Ou seja: o código identifica o **mandato**, e por isso é estável dentro dele. Serve
para Câmara **e** Senado, que é o motivo de tê-lo escolhido.

⛔ **Exige chave de API** — pessoal, atrelada ao CPF de quem a pediu. Vem de
`PORTAL_TRANSPARENCIA_CHAVE`, ⛔ nunca do código.
"""

import logging
import os
import time

import requests

from . import normalizacao

log = logging.getLogger("poligraph")

BASE = "https://api.portaldatransparencia.gov.br/api-de-dados"

# ⚠️ Medido: 15 itens por página, ⛔ sem parâmetro para mudar. Em 2025 a última página
#    com dado foi a 421 — ~6.315 emendas no ano.
POR_PAGINA = 15

# ⚠️ Pausa entre chamadas. São centenas contra serviço público com limite de taxa.
PAUSA = 0.12


def chave() -> str:
    """🔴 A chave vem do ambiente. ⛔ Nunca do código, nunca versionada."""
    valor = os.environ.get("PORTAL_TRANSPARENCIA_CHAVE", "").strip()
    if not valor:
        raise RuntimeError(
            "Defina PORTAL_TRANSPARENCIA_CHAVE. Obtenha em "
            "https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email "
            "(exige conta gov.br nível Prata ou Ouro)."
        )

    return valor


def baixar_ano(ano: int, maximo_de_paginas: int = 600) -> list[dict]:
    """Varre todas as páginas de um ano.

    ⚠️ Para na primeira página vazia — a API ⛔ não informa o total, e pedir página além
    do fim devolve `[]` em vez de erro.
    """
    cabecalho = {"chave-api-dados": chave(), "Accept": "application/json"}
    tudo: list[dict] = []

    for pagina in range(1, maximo_de_paginas + 1):
        resposta = requests.get(
            f"{BASE}/emendas", params={"ano": ano, "pagina": pagina},
            headers=cabecalho, timeout=60,
        )
        resposta.raise_for_status()

        lote = resposta.json()
        if not lote:
            break

        tudo.extend(lote)
        time.sleep(PAUSA)

        if pagina % 100 == 0:
            log.info("    página %d — %d emendas até aqui", pagina, len(tudo))

    return tudo


def codigo_do_autor(emenda: dict) -> str | None:
    """Extrai o código do autor de dentro do `codigoEmenda`.

    ⚠️ O corte usa o `numeroEmenda` do próprio registro, ⛔ não uma posição fixa: o
    número tem tamanho variável, e recortar por índice erraria em silêncio.
    """
    codigo = (emenda.get("codigoEmenda") or "").strip()
    numero = (emenda.get("numeroEmenda") or "").strip()

    if not codigo or not numero or not codigo.endswith(numero):
        return None

    miolo = codigo[4:-len(numero)]

    return miolo or None


def para_linhas(emendas: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """Converte em linhas de `emendas`, e devolve o mapa código → nome do autor.

    ⭐ **Nada é descartado por não ter dono.** Emenda de bancada, senador e parlamentar
    de outra legislatura entram com `pessoa_id` nulo — o vínculo é resolvido depois.
    Perder o registro por não saber ligar seria pior: a reconciliação futura ⛔ não teria
    o que reconciliar.
    """
    linhas: list[dict] = []
    autores: dict[str, str] = {}

    for e in emendas:
        codigo_autor = codigo_do_autor(e)
        if not codigo_autor:
            continue

        nome = (e.get("nomeAutor") or "").strip()
        autores.setdefault(codigo_autor, nome)

        linhas.append(
            {
                "codigo_autor": codigo_autor,
                "nome_autor": nome,
                "codigo_emenda": (e.get("codigoEmenda") or "").strip(),
                "ano": int(e.get("ano") or 0),
                "tipo": (e.get("tipoEmenda") or "").strip() or None,
                "localidade": (e.get("localidadeDoGasto") or "").strip() or None,
                "funcao": (e.get("funcao") or "").strip() or None,
                "subfuncao": (e.get("subfuncao") or "").strip() or None,
                "valor_empenhado": valor_brasileiro(e.get("valorEmpenhado")),
                "valor_liquidado": valor_brasileiro(e.get("valorLiquidado")),
                "valor_pago": valor_brasileiro(e.get("valorPago")),
                "valor_resto_pago": valor_brasileiro(e.get("valorRestoPago")),
            }
        )

    return linhas, autores


# ⭐ A conversão vive em `normalizacao`, junto da do TSE — as duas usam a mesma
#   convenção pt-BR, e mantê-las em cópias separadas era esperar que divergissem.
#   O nome local fica como apelido porque é assim que este módulo lê melhor.
valor_brasileiro = normalizacao.valor_pt_br
