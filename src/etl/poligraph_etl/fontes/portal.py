"""ENTRADA — downloads de dados abertos do Portal da Transparência.

Os arquivos em bloco do Portal são públicos: não pedem a chave pessoal que a API de
dados exige. O que se faz com o conteúdo fica em [`emendas.py`](../emendas.py) e
[`orcamento.py`](../orcamento.py).

| Recurso | Conteúdo | Atualização |
|---|---|---|
| `emendas-parlamentares/UNICO` | Três CSVs: emendas, favorecidos, convênios | Diária — o arquivo inteiro é regerado |
| `orcamento-despesa/{ano}` | Dotação, empenhado e pago por ação e elemento | Diária no ano corrente |

RISCO: **O servidor responde 405 depois de ~18 downloads seguidos**, e o 405 não é erro
do pedido: é limite de taxa sem o código certo. Medido em 2026-09-24 — com pausa de
20 s e nova tentativa, os 45 arquivos de transferências baixaram. Por isso `baixar`
tenta de novo antes de desistir.

ATENÇÃO: Os CSVs vêm em **Latin-1**, não UTF-8. Ler como UTF-8 estoura no primeiro "ç".
"""

import io
import logging
import time
import zipfile
from datetime import date
from pathlib import Path

import pandas as pd
import requests

log = logging.getLogger("poligraph")

BASE = "https://portaldatransparencia.gov.br/download-de-dados"

CABECALHOS = {"User-Agent": "Mozilla/5.0 (poligraph; TCC)"}

TENTATIVAS = 5
ESPERA_ENTRE_TENTATIVAS = 20
"""Segundos antes da primeira nova tentativa; dobra a cada uma (20, 40, 80, 160: uns 5 minutos).

MEDIDO em 2026-10-23: depois dos 26 arquivos do governo de 2014 (orçamento, 12 meses de execução e 12 de cartão), o Portal
respondeu 405 por uns 3 minutos. As esperas de 20, 40 e 60 s desistiam antes de ele liberar.
"""

REPETIR = (405, 429, 502, 503)
"""Respostas que o download tenta de novo: o Portal responde 405 quando limita a taxa."""


def url(recurso: str) -> str:
    """`emendas-parlamentares/UNICO` → a URL de download, que redireciona para o CDN."""
    return f"{BASE}/{recurso}"


def baixar(recurso: str, destino: Path, *, esperar=time.sleep, repetir=REPETIR) -> Path:
    """Baixa em fluxo, com nova tentativa quando o servidor limita a taxa.

    ATENÇÃO: Só renomeia no fim: download interrompido não pode virar cache válido.
    """
    if destino.exists() and destino.stat().st_size > 0:
        log.info("  já em cache: %s (%.0f MB)", destino.name, destino.stat().st_size / 1e6)
        return destino

    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")

    for tentativa in range(1, TENTATIVAS + 1):
        log.info("  baixando %s (tentativa %d)", url(recurso), tentativa)
        with requests.get(url(recurso), headers=CABECALHOS, stream=True, timeout=600) as resposta:
            if resposta.status_code in repetir and tentativa < TENTATIVAS:
                espera = ESPERA_ENTRE_TENTATIVAS * 2 ** (tentativa - 1)
                log.warning("  %d do servidor; nova tentativa em %d s", resposta.status_code, espera)
                esperar(espera)
                continue
            resposta.raise_for_status()

            with parcial.open("wb") as saida:
                for bloco in resposta.iter_content(chunk_size=1 << 20):
                    saida.write(bloco)
            break

    parcial.replace(destino)
    log.info("  %s — %.0f MB", destino.name, destino.stat().st_size / 1e6)

    return destino


TENTATIVAS_DO_403 = 4
"""Quantas vezes um 403 ou 405 é tentado de novo antes de o mês contar como não publicado."""

ESPERA_DO_403 = 30
"""Segundos de espera antes da primeira nova tentativa de um 403 ou 405; dobra a cada uma."""

AUSENCIA_OU_LIMITE = (403, 405)
"""Respostas que tanto podem ser "não publicado" quanto limite de ritmo."""


def baixar_publicado(recurso: str, destino: Path, *, esperar=time.sleep) -> Path | None:
    """O arquivo do mês, ou `None` se o Portal não o publicou.

    RISCO: o Portal responde 403 tanto para arquivo que não existe quanto quando está limitando o
    ritmo. MEDIDO (2026-10-10): `cpcc/202102` deu 403 na carga e 200 minutos depois. Tratar o primeiro
    403 como "não publicado" perdia meses calado; agora ele só vale depois de `TENTATIVAS_DO_403`
    tentativas espaçadas. 404 é ausência na hora.

    MEDIDO (2026-10-15, primeira rotina no VPS): do servidor, o CDN do Portal responde 405, e não 403,
    para o mês que ainda não saiu (`cpdc/202609`); do computador do autor, o mesmo mês dá 403. O 405
    derrubava a rotina inteira. Agora vale como o 403, e sobe direto do `baixar`, sem as quatro
    tentativas dele: somadas às daqui, cada mês ausente esperaria uns 11 minutos.
    """
    repetir = tuple(codigo for codigo in REPETIR if codigo not in AUSENCIA_OU_LIMITE)
    for tentativa in range(1, TENTATIVAS_DO_403 + 1):
        try:
            return baixar(recurso, destino, esperar=esperar, repetir=repetir)
        except requests.HTTPError as erro:
            codigo = erro.response.status_code if erro.response is not None else None
            if codigo == 404:
                return None
            if codigo not in AUSENCIA_OU_LIMITE:
                raise
            if tentativa < TENTATIVAS_DO_403:
                log.warning("  %d em %s; nova tentativa em %d s", codigo, recurso, ESPERA_DO_403 * 2 ** (tentativa - 1))
                esperar(ESPERA_DO_403 * 2 ** (tentativa - 1))
    log.info("  %s não publicado", recurso)
    return None


def ler_csv(arquivo_zip: Path, membro: str, colunas: list[str] | None = None) -> pd.DataFrame:
    """Lê um CSV de dentro do ZIP, tudo como texto.

    ATENÇÃO: `dtype=str` pelo mesmo motivo dos CSVs da Câmara: código com zero à esquerda
    (`"03101"`, `"00SJ"`) viraria número e perderia o zero.

    DECISÃO: `colunas` limita a leitura: o arquivo mensal de execução tem 80 MB e 47 colunas, e
    o que se usa dele são quatro.
    """
    with zipfile.ZipFile(arquivo_zip) as zf:
        with zf.open(membro) as bruto:
            return pd.read_csv(
                io.TextIOWrapper(bruto, encoding="latin-1"),
                sep=";",
                quotechar='"',
                dtype=str,
                keep_default_na=False,
                usecols=colunas,
            )


def gerado_em(arquivo_zip: Path, membro: str) -> date:
    """A data em que o Portal gerou o CSV, lida do próprio ZIP.

    DECISÃO: É ela, não a data do download, que diz até onde vai o dado do ano corrente.
    """
    with zipfile.ZipFile(arquivo_zip) as zf:
        ano, mes, dia, *_ = zf.getinfo(membro).date_time
    return date(ano, mes, dia)


def membros(arquivo_zip: Path) -> list[str]:
    with zipfile.ZipFile(arquivo_zip) as zf:
        return zf.namelist()
