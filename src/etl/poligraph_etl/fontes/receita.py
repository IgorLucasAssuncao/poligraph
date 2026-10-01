"""ENTRADA — dados abertos da Receita Federal: cadastro de CNPJ e tabela de municípios.

| Recurso | Onde | Tamanho |
|---|---|---|
| Tabela de municípios (TOM ↔ IBGE) | `www.gov.br/receitafederal/dados/municipios.csv` | 234 KB, 5.571 municípios |
| Cadastro de estabelecimentos | Nextcloud público da Receita, pasta mensal `AAAA-MM` | 10 ZIPs, ~6 GB |

⚠️ O cadastro saiu do servidor de arquivos simples para um Nextcloud. A listagem da página
precisa de JavaScript; o que funciona sem navegador é o **WebDAV público** do
compartilhamento, com o token do link como usuário e senha vazia. Conferido em
2026-09-25: pastas de `2026-06` a `2026-09`.

⚠️ Tudo em **Latin-1**, ⛔ UTF-8.
"""

import csv
import io
import logging
import re
import zipfile
from pathlib import Path

import requests

log = logging.getLogger("poligraph")

TABELA_TOM = "https://www.gov.br/receitafederal/dados/municipios.csv"

WEBDAV = "https://arquivos.receitafederal.gov.br/public.php/webdav"

# O token do link público de compartilhamento (index.php/s/<token>), que o WebDAV
# aceita como usuário. Não é segredo: é o link que a própria Receita divulga.
TOKEN = "YggdBLfdninEJX9"

ARQUIVOS_DE_ESTABELECIMENTOS = [f"Estabelecimentos{i}.zip" for i in range(10)]

CABECALHOS = {"User-Agent": "Mozilla/5.0 (poligraph; TCC)"}


def ultima_pasta() -> str:
    """A pasta mensal mais recente do cadastro, `AAAA-MM`."""
    resposta = requests.request(
        "PROPFIND", f"{WEBDAV}/", auth=(TOKEN, ""), headers={**CABECALHOS, "Depth": "1"}, timeout=60
    )
    resposta.raise_for_status()
    pastas = sorted(set(re.findall(r"/public\.php/webdav/(\d{4}-\d{2})/", resposta.text)))
    if not pastas:
        raise RuntimeError("Nenhuma pasta AAAA-MM no compartilhamento da Receita — o formato mudou?")
    return pastas[-1]


def baixar(pasta: str, arquivo: str, destino: Path) -> Path:
    """Baixa um arquivo da pasta mensal, em fluxo. Não rebaixa o que já está no cache."""
    if destino.exists() and destino.stat().st_size > 0:
        return destino

    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")
    log.info("  baixando %s/%s", pasta, arquivo)
    with requests.get(
        f"{WEBDAV}/{pasta}/{arquivo}", auth=(TOKEN, ""), headers=CABECALHOS, stream=True, timeout=1800
    ) as resposta:
        resposta.raise_for_status()
        with parcial.open("wb") as saida:
            for bloco in resposta.iter_content(chunk_size=1 << 20):
                saida.write(bloco)

    parcial.replace(destino)
    return destino


def baixar_tabela_tom(destino: Path) -> Path:
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    resposta = requests.get(TABELA_TOM, headers=CABECALHOS, timeout=120)
    resposta.raise_for_status()
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(resposta.content)
    return destino


def ler_tabela_tom(caminho: Path) -> list[dict]:
    with open(caminho, encoding="latin-1", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def sedes(arquivos: list[Path], alvos: set[str]) -> dict[str, str]:
    """CNPJ → código TOM do município da sede, só para os CNPJs pedidos.

    ⚠️ São ~70 milhões de linhas; ler tudo em pandas estouraria a memória. Lê em fluxo e
    guarda só o que interessa. Colunas do layout da Receita: 0-2 = CNPJ básico, ordem e
    dígito; 20 = município (código TOM).
    """
    achados: dict[str, str] = {}
    for arquivo in arquivos:
        with zipfile.ZipFile(arquivo) as zf:
            with zf.open(zf.namelist()[0]) as bruto:
                leitor = csv.reader(
                    io.TextIOWrapper(bruto, encoding="latin-1", newline=""), delimiter=";", quotechar='"'
                )
                for linha in leitor:
                    cnpj = linha[0] + linha[1] + linha[2]
                    if cnpj in alvos:
                        achados[cnpj] = linha[20]
        log.info("  %s: %d de %d CNPJs achados até aqui", arquivo.name, len(achados), len(alvos))
    return achados
