"""TSE — CDN de dados abertos eleitorais.

Este módulo cuida **só do acesso**: passar pelo WAF, baixar e abrir o ZIP. O que se faz
com o conteúdo fica em [`receitas.py`](../receitas.py).

🔴 **O WAF do TSE tem duas armadilhas, e as duas mentem em vez de errar.**

**1. É o CONJUNTO de headers que passa, ⛔ não o `User-Agent`.** Isolado em
`consulta_cand_2022.zip`:

| Tentativa | |
|---|---|
| `curl` padrão | ⛔ 403 |
| Só `User-Agent` de navegador | ⛔ 403 |
| Conjunto completo **sem** `Accept-Encoding` | ⛔ 403 |
| **Conjunto completo COM `Accept-Encoding`** | ✅ 200 |

**2. `HEAD` é bloqueado; `GET` na mesma URL passa.** Verificar disponibilidade com
`HEAD` é o reflexo natural — é a requisição barata. E aqui ela **mente**: leva a concluir
que *"o TSE fechou de novo"* quando nada fechou. Por isso `existe()` usa `GET` com
`Range`.

⚠️ **Isto é frágil por natureza.** O TSE pode endurecer a regra a qualquer momento — daí
`ErroDeAcessoAoTse`, que diz o que fazer em vez de só estourar.

📐 Medições e histórico: [`docs/12-fonte-tse.md §2.0`](../../../../docs/12-fonte-tse.md).
"""

import logging
from pathlib import Path

import requests

log = logging.getLogger("poligraph")

CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"

# 🔴 A receita inteira. ⛔ Não remova nenhuma linha "que parece inútil" — foi medido que
#    o conjunto é que passa, e `Accept-Encoding` foi a peça que faltava.
CABECALHOS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}


class ErroDeAcessoAoTse(RuntimeError):
    """⭐ Erro próprio para que o comando saiba **degradar** em vez de morrer.

    ⚠️ O plano B é carga manual do mesmo arquivo — está em `docs/12-fonte-tse.md §2.2`.
    A mensagem carrega a URL para que baixar à mão seja copiar e colar.
    """


def url_de_prestacao_de_contas(ano: int) -> str:
    """⚠️ **Só este nome funciona.** `prestacao_de_contas_2022`, `prestacao_contas_2022`
    e `prestacao_de_contas_eleitorais_2022` dão 404 — todos testados.
    """
    return (
        f"{CDN}/prestacao_contas/"
        f"prestacao_de_contas_eleitorais_candidatos_{ano}.zip"
    )


def existe(url: str) -> bool:
    """Confere disponibilidade **sem** baixar o arquivo inteiro.

    🔴 `GET` com `Range`, ⛔ nunca `HEAD` — ver o cabeçalho do módulo. Um `HEAD` aqui
    devolveria 403 e faria o pipeline concluir o oposto da verdade.
    """
    try:
        resposta = requests.get(
            url, headers={**CABECALHOS, "Range": "bytes=0-2000"}, timeout=60
        )
    except requests.RequestException:
        return False

    return resposta.status_code in (200, 206)


def baixar(url: str, destino: Path) -> Path:
    """Baixa em fluxo — o arquivo de 2022 tem **396 MB** medidos, e ⛔ não cabe em memória.

    ⭐ Se o destino já existe, ⛔ não rebaixa. São 396 MB por execução, e o arquivo de
    uma eleição passada nunca muda.
    """
    if destino.exists() and destino.stat().st_size > 0:
        log.info("  já em cache: %s (%.0f MB)", destino.name,
                 destino.stat().st_size / 1e6)
        return destino

    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")

    log.info("  baixando %s", url)
    with requests.get(url, headers=CABECALHOS, stream=True, timeout=600) as resposta:
        if resposta.status_code == 403:
            raise ErroDeAcessoAoTse(
                f"O WAF do TSE recusou o download ({url}). A receita de headers pode "
                "ter deixado de funcionar. Baixe o arquivo à mão e aponte --arquivo "
                "para ele — ver docs/12-fonte-tse.md §2.2."
            )
        resposta.raise_for_status()

        with parcial.open("wb") as saida:
            for pedaco in resposta.iter_content(chunk_size=1 << 20):
                saida.write(pedaco)

    # ⚠️ Só renomeia no fim. Download interrompido ⛔ não pode virar "cache válido" —
    #    seria um ZIP truncado que o próximo `--arquivo` aceitaria como pronto.
    parcial.replace(destino)
    log.info("  %s — %.0f MB", destino.name, destino.stat().st_size / 1e6)

    return destino
