"""Emendas parlamentares — Portal da Transparência.

Responde *"para onde este deputado mandou dinheiro público, e quanto de fato saiu?"*.

## ENTRADA

| | |
|---|---|
| Fonte | `api.portaldatransparencia.gov.br/api-de-dados/emendas?ano=&pagina=` |
| 🔑 Autenticação | Chave **pessoal**, de `PORTAL_TRANSPARENCIA_CHAVE` — ⛔ nunca do código |
| Paginação | **15 itens fixos**, ⛔ sem parâmetro para mudar. ~420 páginas por ano |
| Fim da varredura | Primeira página vazia — a API ⛔ não informa o total |
| Formato | JSON; valores em **pt-BR** (`"- 26.002,00"`) |

## TRATAMENTO

1. Extrai o **código do autor** de dentro do `codigoEmenda`, cortando pelo `numeroEmenda`
2. Descarta registro cujo código ⛔ não seja coerente — sinal de que a fonte mudou
3. Converte valores pt-BR; **negativo é cancelamento** e é mantido
4. Monta o mapa `código -> nome`, que vira a fila de reconciliação

## SAÍDA

| | |
|---|---|
| Tabelas | `emendas` · `autores_de_emenda` |
| Chave de ligação | `codigo_autor` — resolvido em passo **separado** |
| Constraint do banco | `ux_emenda_autor_codigo` · `ck_autor_metodo` · FK `SET NULL` |
| Idempotência | `DELETE` por `ano` + `ON CONFLICT DO NOTHING` |

---

🔴 **A chave é o CÓDIGO DO AUTOR, ⛔ não o nome.** O `codigoEmenda` embute um
identificador de **mandato**, estável dentro dele e válido para Câmara **e** Senado — que
é o motivo de tê-lo escolhido, já que o Senado ⛔ não publica CPF.

⭐ **`pessoa_id` sai NULO daqui.** Nada é descartado por não ter dono; o vínculo é
decisão de outro passo.

📐 [achado #24](../../../docs/achados/024-codigo-da-emenda-identifica-o-mandato.md)
"""

import logging
import os
import time

import requests

from . import normalizacao

log = logging.getLogger("poligraph")

BASE = "https://api.portaldatransparencia.gov.br/api-de-dados"

# A API devolve 15 itens por página e ⛔ não aceita parâmetro para mudar: são ~1.700
# requisições nos quatro anos, contra serviço público com limite de taxa.
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

    Para na primeira página vazia: a API ⛔ não informa o total, e pedir página além do
    fim devolve `[]` em vez de erro.
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

        202541840004
         │   │    └── numeroEmenda (tamanho VARIÁVEL)
         │   └─────── 4184 = o código do autor
         └─────────── ano

    🔴 O corte usa o `numeroEmenda` do próprio registro, ⛔ nunca posição fixa: recortar
    por índice erraria em silêncio, devolvendo o código de **outro** autor.
    """
    codigo = (emenda.get("codigoEmenda") or "").strip()
    numero = (emenda.get("numeroEmenda") or "").strip()

    if not codigo or not numero or not codigo.endswith(numero):
        return None

    miolo = codigo[4:-len(numero)]

    return miolo or None


def para_linhas(emendas: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """Converte em linhas de `emendas`, e devolve o mapa código -> nome do autor.

    ⭐ **Nada é descartado por não ter dono.** Emenda de comissão, de bancada e de
    parlamentar de outra legislatura entra com `pessoa_id` nulo, e o vínculo é resolvido
    depois — perder o registro deixaria a reconciliação futura sem o que reconciliar.
    """
    linhas: list[dict] = []
    autores: dict[str, str] = {}

    for emenda in emendas:
        codigo_autor = codigo_do_autor(emenda)
        if not codigo_autor:
            continue

        nome = (emenda.get("nomeAutor") or "").strip()
        autores.setdefault(codigo_autor, nome)

        linhas.append(
            {
                "codigo_autor": codigo_autor,
                "nome_autor": nome,
                "codigo_emenda": (emenda.get("codigoEmenda") or "").strip(),
                "ano": int(emenda.get("ano") or 0),
                "tipo": (emenda.get("tipoEmenda") or "").strip() or None,
                "localidade": (emenda.get("localidadeDoGasto") or "").strip() or None,
                "funcao": (emenda.get("funcao") or "").strip() or None,
                "subfuncao": (emenda.get("subfuncao") or "").strip() or None,
                "valor_empenhado": valor_brasileiro(emenda.get("valorEmpenhado")),
                "valor_liquidado": valor_brasileiro(emenda.get("valorLiquidado")),
                "valor_pago": valor_brasileiro(emenda.get("valorPago")),
                "valor_resto_pago": valor_brasileiro(emenda.get("valorRestoPago")),
            }
        )

    return linhas, autores


# A conversão vive em `normalizacao`, junto da do TSE: as duas usam a convenção pt-BR, e
# cópias separadas divergiriam. Apelido local porque é assim que este módulo lê melhor.
valor_brasileiro = normalizacao.valor_pt_br
