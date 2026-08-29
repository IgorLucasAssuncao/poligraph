"""ENTRADA — os feeds RSS de onde as notícias vêm.

## FONTES

| Veículo | Feed |
|---|---|
| Agência Câmara | `camara.leg.br/noticias/rss/ultimas-noticias` |
| Agência Senado | `www12.senado.leg.br/noticias/rss` |
| Agência Brasil | `agenciabrasil.ebc.com.br/rss/politica/feed.xml` |

🔴 **Os três são públicos — duas agências do próprio Legislativo e a EBC, empresa
pública.** ⛔ Não é acaso nem falta de ambição: a RF-38 já proíbe guardar o texto
integral, e usar veículo comercial acrescentaria a discussão de termos de uso a um
projeto que ⛔ não precisa dela para demonstrar o método.

⚠️ **⛔ Não há varredura de site nem burla de `robots.txt`.** Só feed declarado, e só o
que o feed publica: url, título, veículo, data e o `description` curto.

## ⚠️ Achados da fonte, medidos em 2026-08-29

| Tentativa | Resultado |
|---|---|
| `camara.leg.br/rss/ultimas-noticias.xml` | **404** — o caminho ⛔ não existe |
| `camara.leg.br/noticias/rss` | 200, mas devolve **HTML** |
| 🔴 `www12.senado.leg.br/noticias/ultimas/rss` | 200 e **XML malformado** (`mismatched tag`, linha 185) |
| ⭐ `www12.senado.leg.br/noticias/rss` | 200 e válido — é este que usamos |

🔴 **Um feed oficial servir XML quebrado ⛔ não é hipótese: é o caso medido.** Por isso
`baixar` devolve `None` em vez de estourar — um veículo fora do ar ⛔ não pode derrubar
a coleta dos outros dois. O canário está em `conferir_volume`.
"""

import logging

import requests

log = logging.getLogger("poligraph")

CABECALHOS = {"User-Agent": "poligraph-tcc/1.0 (pesquisa academica)"}

FEEDS: tuple[tuple[str, str], ...] = (
    ("Agência Câmara", "https://www.camara.leg.br/noticias/rss/ultimas-noticias"),
    ("Agência Senado", "https://www12.senado.leg.br/noticias/rss"),
    ("Agência Brasil", "https://agenciabrasil.ebc.com.br/rss/politica/feed.xml"),
)

# ⚠️ Medido: os três feeds trazem de 10 a 20 itens por carga. Menos que isto em TODOS
#    significa contrato mudado, ⛔ não notícia escassa.
MINIMO_NO_TOTAL = 10


def baixar(url: str) -> str | None:
    """O XML do feed, ou `None` se ⛔ não deu.

    ⛔ **⛔ Não levanta.** A coleta roda sobre vários veículos, e derrubar tudo porque um
    respondeu 500 seria trocar dois feeds bons por nenhum. Quem chama registra e segue.
    """
    try:
        resposta = requests.get(url, headers=CABECALHOS, timeout=60)
        resposta.raise_for_status()
    except requests.RequestException as erro:
        log.warning("feed %s não respondeu: %s", url, erro)
        return None

    if not resposta.content.strip():
        log.warning("feed %s veio vazio", url)
        return None

    return resposta.text


def conferir_volume(total: int) -> None:
    """Canário: coleta muito abaixo do medido indica contrato alterado.

    ⚠️ Olha o TOTAL, ⛔ não cada feed. Um veículo sozinho pode legitimamente ⛔ não
    publicar nada num dia; os três juntos, ⛔ não.
    """
    if total < MINIMO_NO_TOTAL:
        log.warning(
            "só %d notícias nos %d feeds (esperado >= %d) — confira se algum mudou de "
            "formato ou de endereço",
            total,
            len(FEEDS),
            MINIMO_NO_TOTAL,
        )
