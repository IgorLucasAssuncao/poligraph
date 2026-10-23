"""ENTRADA — CDN de dados abertos eleitorais do TSE.

Passa pelo WAF, baixa e abre o ZIP. O que se faz com o conteúdo fica em
[`receitas.py`](../receitas.py).

RISCO: **Duas armadilhas do WAF, e as duas mentem em vez de errar:**

1. É o **conjunto** de headers que passa, não o `User-Agent` — e `Accept-Encoding` é
   a peça que faltava
2. **`HEAD` é bloqueado; `GET` na mesma URL passa.** Verificar disponibilidade com `HEAD`
   é o reflexo natural, e aqui leva a concluir que *"o TSE fechou de novo"* quando nada
   fechou. Por isso `existe()` usa `GET` com `Range`

ATENÇÃO: Frágil por natureza — daí `ErroDeAcessoAoTse`, que diz o que fazer em vez de estourar.

MEDIDO: [`docs/12-fonte-tse.md §2.0`](../../../../docs/12-fonte-tse.md)
"""

import logging
from email.utils import parsedate_to_datetime
from pathlib import Path

import requests

log = logging.getLogger("poligraph")

CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"

# RISCO: Não remova nenhuma linha "que parece inútil" — é o conjunto que passa.
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
    """Erro próprio para que o comando saiba **degradar** em vez de morrer.

    O plano B é carga manual do mesmo arquivo; a mensagem carrega a URL para que baixar
    à mão seja copiar e colar.
    """


NOMES_ANTIGOS_DA_PRESTACAO = {
    2014: "prestacao_final_2014.zip",
    2010: "prestacao_contas_2010.zip",
}
"""MEDIDO em 2026-10-02: antes de 2018 o arquivo tem outro nome, e o nome atual dá 404. O de 2006
existe (`prestacao_contas_2006.zip`), mas sem o CPF do candidato, e por isso não está aqui."""


def url_de_prestacao_de_contas(ano: int) -> str:
    """ATENÇÃO: De 2018 em diante, só este nome funciona — as outras três grafias plausíveis dão 404, testadas."""
    antigo = NOMES_ANTIGOS_DA_PRESTACAO.get(ano)
    if antigo:
        return f"{CDN}/prestacao_contas/{antigo}"
    return (
        f"{CDN}/prestacao_contas/"
        f"prestacao_de_contas_eleitorais_candidatos_{ano}.zip"
    )


def existe(url: str) -> bool:
    """Confere disponibilidade **sem** baixar o arquivo inteiro.

    RISCO: `GET` com `Range`, nunca `HEAD`: um `HEAD` devolveria 403 e faria o pipeline
    concluir o oposto da verdade.
    """
    try:
        resposta = requests.get(
            url, headers={**CABECALHOS, "Range": "bytes=0-2000"}, timeout=60
        )
    except requests.RequestException:
        return False

    return resposta.status_code in (200, 206)


def baixar(url: str, destino: Path) -> Path:
    """Baixa em fluxo — são **396 MB**, que não cabem em memória.

    Com o destino em cache, só rebaixa se o TSE publicou versão mais nova (`mudou_desde`).

    Só renomeia no fim: download interrompido não pode virar cache válido.
    """
    if destino.exists() and destino.stat().st_size > 0 and not mudou_desde(url, destino):
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
            for bloco in resposta.iter_content(chunk_size=1 << 20):
                saida.write(bloco)

    parcial.replace(destino)
    log.info("  %s — %.0f MB", destino.name, destino.stat().st_size / 1e6)

    return destino


def mudou_desde(url: str, arquivo: Path) -> bool:
    """O TSE publicou o arquivo depois do cache, ou com outro tamanho? Lê só os headers de um `GET` em fluxo.

    RISCO: o arquivo da eleição em andamento muda. MEDIDO em 2026-10-23: o `consulta_cand_2026` em cache desde
    21/10 tinha 20 governadores eleitos, e o publicado no dia 23, 21; o de 2024 também foi republicado no dia 23.
    Sem esta conferência, a rotina de novembro leria o arquivo de antes do segundo turno.

    ATENÇÃO: sem resposta do TSE, fica o cache, e o log diz. `GET`, nunca `HEAD` (ver o topo do módulo).
    """
    try:
        with requests.get(url, headers=CABECALHOS, stream=True, timeout=60) as resposta:
            publicado = resposta.headers.get("Last-Modified")
            tamanho = resposta.headers.get("Content-Length")
            if resposta.status_code != 200:
                log.warning("  o TSE respondeu %d ao conferir %s; fica o cache", resposta.status_code, arquivo.name)
                return False
    except requests.RequestException as erro:
        log.warning("  sem resposta do TSE ao conferir %s (%s); fica o cache", arquivo.name, erro)
        return False

    local = arquivo.stat()
    if tamanho is not None and tamanho.isdigit() and int(tamanho) != local.st_size:
        log.info("  o TSE publicou outra versão de %s: %s bytes, o cache tem %d", arquivo.name, tamanho, local.st_size)
        return True
    if publicado is not None and parsedate_to_datetime(publicado).timestamp() > local.st_mtime:
        log.info("  o TSE publicou %s em %s, depois do cache", arquivo.name, publicado)
        return True
    return False
