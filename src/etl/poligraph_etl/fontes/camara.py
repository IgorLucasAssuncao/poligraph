"""ENTRADA — os arquivos abertos da Câmara dos Deputados.

Baixa e lê. Não interpreta e não descarta: isso é `ingestao`.

## O que entrega

| Recurso | Forma |
|---|---|
| `votacoes-{ano}` · `votacoesVotos-{ano}` | CSV anual, `;`, aspas, `utf-8-sig` |
| ATENÇÃO: `deputados` | **Arquivo único**, não anual — todas as legislaturas juntas |
| `api/v2/deputados/{id}` | JSON, uma requisição por deputado — é onde o **CPF** existe |
| ATENÇÃO: `cotas/Ano-{ano}.csv.zip` | ZIP, e em **outro host** — `www.camara.leg.br`, fora de `dadosabertos` |

RISCO: **O ponto perigoso são os PARÂMETROS de leitura, não a lógica.** Os CSVs têm quebra
de linha **dentro** de campos entre aspas: ler por linha infla a contagem entre 15% e 26%,
dependendo do ano — e não **sem exceção nenhuma**, produzindo registros inválidos calados.

DECISÃO: Por isso `conferir_volume` é canário obrigatório: compara a contagem lida com a medida
e **estoura** se divergir.

MEDIDO: [`docs/04-contratos.md`](../../../../docs/04-contratos.md) ·
[achado #22](../../../../docs/achados/022-deputados-nao-e-arquivo-anual.md)
"""

import csv
import io
import zipfile
from pathlib import Path

import pandas as pd
import requests

from .. import procedencia

BASE = "https://dadosabertos.camara.leg.br/arquivos"

# Medido em 2026-08-26 com parser RFC 4180 próprio (infra/analise/csv.awk).
# Serve de canário: se a leitura devolver muito mais que isto, os parâmetros
# de parsing regrediram.
REGISTROS_ESPERADOS = {2023: 10_832, 2024: 10_371, 2025: 13_825}

TOLERANCIA = 0.05


def ler_csv(caminho: Path | str) -> pd.DataFrame:
    """Lê um CSV da Câmara com os três parâmetros que evitam as armadilhas medidas.

    ATENÇÃO: Nenhum deles é opcional:

    - `sep=';'`        — o separador é ponto e vírgula, não vírgula
    - `encoding='utf-8-sig'` — os arquivos têm BOM; sem isso a PRIMEIRA coluna vem
      com `\\ufeff` grudado no nome e o acesso por nome falha
    - `dtype=str`      — RISCO: sem isto o pandas infere número e o CPF `01234567890`
      vira `1234567890`, perdendo o zero à esquerda. O join com o TSE falha em
      silêncio, sem erro nenhum
    - `quotechar='"'`  — é o que faz a quebra de linha dentro do campo ser tratada
      como conteúdo, e não como novo registro
    """
    return pd.read_csv(
        caminho,
        sep=";",
        encoding="utf-8-sig",
        quotechar='"',
        dtype=str,
        na_values=["", "#NULO#", "#NE#"],
        keep_default_na=False,
    )


# RISCO: Nem todo recurso da Câmara é anual.
#
# `votacoes` e `votacoesVotos` saem um arquivo por ano; `deputados` é UM arquivo só,
# com todos os deputados de todas as legislaturas. Pedir `deputados-2025.csv` devolve
# 404 — verificado em 2026-08-26 contra o servidor.
SEM_ANO = {"deputados"}


def url_do_arquivo(recurso: str, ano: int) -> str:
    """DECISÃO: Separada de `baixar` para poder ser testada sem rede."""
    sufixo = "" if recurso in SEM_ANO else f"-{ano}"

    return f"{BASE}/{recurso}/csv/{recurso}{sufixo}.csv"


def baixar(recurso: str, ano: int, destino: Path) -> Path:
    """Baixa um arquivo da Câmara.

    ATENÇÃO: Os arquivos são reconstruídos toda madrugada, TODOS os anos — inclusive os
    fechados (achado #19). Não dá para supor que o de 2023 nunca muda.
    """
    baixar_com_procedencia(recurso, ano, destino)
    return destino


def baixar_com_procedencia(recurso: str, ano: int, destino: Path) -> procedencia.Baixado:
    """Como `baixar`, devolvendo também a impressão digital do que veio (PL72)."""
    destino.parent.mkdir(parents=True, exist_ok=True)

    resposta = requests.get(url_do_arquivo(recurso, ano), timeout=120)
    resposta.raise_for_status()
    destino.write_bytes(resposta.content)

    return procedencia.de_resposta("CAMARA", resposta)


def conferir_volume(df: pd.DataFrame, ano: int) -> None:
    """Canário contra regressão de parsing.

    DECISÃO: Se alguém remover `quotechar` ou trocar o encoding, a contagem estoura e o
    ETL para aqui — em vez de gravar milhares de linhas quebradas no banco.
    """
    esperado = REGISTROS_ESPERADOS.get(ano)
    if esperado is None:
        return

    desvio = abs(len(df) - esperado) / esperado
    if desvio > TOLERANCIA:
        raise ValueError(
            f"votacoes-{ano}: {len(df)} registros, esperado ~{esperado} "
            f"(desvio de {desvio:.1%}). "
            "Parsing regrediu, ou a Câmara mudou o arquivo — confira antes de ingerir."
        )


# ═══════════════════════════════════════════════════════════════════
# Cota parlamentar (CEAP) — ATENÇÃO: FORA de `dadosabertos`
# ═══════════════════════════════════════════════════════════════════

# ATENÇÃO: Outro host e outro formato: ZIP em vez de CSV solto. É a mesma casa, então a
#    ENTRADA mora aqui; o tratamento vive em `cota.py`.
#
# Não `GET /deputados/{id}/despesas` responde 200 com `"dados": []` — a API REST não
#    serve, e é por isso que o arquivo em bloco é o único caminho.
URL_COTA = "https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip"

# Medido: ~233 mil linhas por ano, 99,6% com `ideCadastro`.
MINIMO_DE_COTA = 50_000


def baixar_cota(ano: int, destino: Path) -> Path:
    """ATENÇÃO: ~6,6 MB compactado. Vale cachear entre execuções."""
    destino.parent.mkdir(parents=True, exist_ok=True)

    resposta = requests.get(URL_COTA.format(ano=ano), timeout=300)
    resposta.raise_for_status()
    destino.write_bytes(resposta.content)

    return destino


def ler_cota(caminho: Path) -> list[dict]:
    """Lê o CSV de dentro do ZIP.

    Não reutiliza `ler_csv`: aqui a fonte é ZIP, e carregar 233 mil linhas num
    DataFrame para depois iterar seria desperdício.
    """
    with zipfile.ZipFile(caminho) as arquivo:
        nome = arquivo.namelist()[0]
        with arquivo.open(nome) as fluxo:
            texto = io.TextIOWrapper(fluxo, encoding="utf-8-sig")

            return list(csv.DictReader(texto, delimiter=";", quotechar='"'))


def conferir_volume_de_cota(registros: list[dict], ano: int) -> None:
    """Canário: arquivo muito menor que o medido significa layout mudado."""
    if len(registros) < MINIMO_DE_COTA:
        raise RuntimeError(
            f"Só {len(registros)} linhas em Ano-{ano}.csv — esperado ao menos "
            f"{MINIMO_DE_COTA}. O layout do arquivo mudou?"
        )


# ═══════════════════════════════════════════════════════════════════
# RISCO: CPF — só existe na API REST, um deputado por chamada
# ═══════════════════════════════════════════════════════════════════

# ATENÇÃO: Aqui NÃO dá para usar o arquivo em bloco: a coluna `cpf` de `deputados.csv` vem
#    VAZIA — 0 de 7.889 preenchidos. O valor só existe em `/api/v2/deputados/{id}`.
#
# DECISÃO: E vale a requisição: no teste contra a prestação de contas do TSE, o CPF casou
#    15 de 15, contra 14 de 15 do nome civil. Errar um em quinze, em escala nacional,
#    são dezenas de conciliações manuais.
API = "https://dadosabertos.camara.leg.br/api/v2"


def redes_do_deputado(id_camara: str) -> list[str] | None:
    """Os endereços em `redeSocial`. `None` quando a requisição falha — não lista vazia, que
    afirmaria que o deputado não tem rede e apagaria a que já estava gravada."""
    try:
        resposta = requests.get(f"{API}/deputados/{id_camara}", headers={"Accept": "application/json"}, timeout=30)
        resposta.raise_for_status()
        return list((resposta.json().get("dados") or {}).get("redeSocial") or [])
    except (requests.RequestException, ValueError):
        return None


def cpf_do_deputado(id_camara: str) -> str | None:
    """Busca o CPF de um deputado. `None` quando não há.

    RISCO: `id_camara` é o id da CÂMARA, não o `pessoas.id` do projeto — que é sintético
    (RF-11). Passar o errado devolve **404**, e o erro é silencioso na leitura do
    código: os dois são número, e nada avisa. O de-para vive em `pessoa_fonte_ids`.

    ATENÇÃO: Devolve `None` em qualquer falha, de propósito. Uma requisição que cai não pode
    derrubar a ingestão inteira — o deputado fica sem CPF e a próxima execução tenta de
    novo.
    """
    try:
        resposta = requests.get(f"{API}/deputados/{id_camara}", timeout=30)
        resposta.raise_for_status()

        return (resposta.json().get("dados") or {}).get("cpf") or None
    except (requests.RequestException, ValueError):
        return None
