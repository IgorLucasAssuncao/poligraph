"""O que mais de um comando usa: o cache, o registro de procedência de cada arquivo baixado e o registro do que não fecha com a fonte."""

import hashlib
import json
import logging
import os
from pathlib import Path

import psycopg

from ..fontes import camara
from ..nucleo import persistencia, procedencia

log = logging.getLogger("poligraph")

CACHE = Path(os.environ.get("POLIGRAPH_CACHE", ".cache"))


def baixar_da_camara(conexao: psycopg.Connection, recurso: str, ano: int):
    """Baixa um arquivo da Câmara e registra a carga (Pendência 72): devolve o caminho e o id.

    O arquivo também fica guardado em `procedencia/`, com o hash no nome: é o que deixa
    qualquer pessoa refazer a conta a partir do mesmo arquivo.
    """
    destino = CACHE / f"{recurso}-{ano}.csv"
    baixado = camara.baixar_com_procedencia(recurso, ano, destino)
    procedencia.guardar(baixado, CACHE / "procedencia")
    return destino, persistencia.registrar_carga(conexao, baixado, procedencia.comando())


def carga_de_varios(
    conexao: psycopg.Connection, fonte: str, url: str, arquivos: list[tuple[str, Path]], indice: Path
) -> int | None:
    """Registra cada arquivo e um índice que lista todos, e devolve o id da carga do índice.

    DECISÃO (2026-10-10): para linha que soma vários arquivos, como o gasto sigiloso de um ano, que
    junta 12 extratos mensais. Cada arquivo entra em `cargas` com o próprio hash; o índice guarda a
    URL, o hash e a carga de cada um, e é para ele que a linha aponta. Sem arquivo, não há carga.
    """
    if not arquivos:
        return None
    partes = []
    for url_do_arquivo, arquivo in arquivos:
        partes.append({
            "url": url_do_arquivo,
            "sha256": hashlib.sha256(arquivo.read_bytes()).hexdigest(),
            "carga_id": carga_do_arquivo(conexao, fonte, url_do_arquivo, arquivo),
        })
    indice.parent.mkdir(parents=True, exist_ok=True)
    indice.write_text(json.dumps({"url": url, "arquivos": partes}, ensure_ascii=False, indent=1), encoding="utf-8")
    return carga_do_arquivo(conexao, fonte, url, indice)


def carga_de_resposta(conexao: psycopg.Connection, fonte: str, url: str, conteudo, arquivo: Path) -> int:
    """Grava em arquivo o que uma API devolveu e registra esse arquivo, com o hash dele.

    Para o dado que não vem de arquivo publicado, como os senadores em exercício ou a rede de cada
    deputado: sem isto, a linha não teria de onde dizer que veio.
    """
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    arquivo.write_text(json.dumps(conteudo, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return carga_do_arquivo(conexao, fonte, url, arquivo)


def carga_do_arquivo(conexao: psycopg.Connection, fonte: str, url: str, arquivo: Path) -> int:
    """Registra a carga de um arquivo que já está no cache (Pendência 72) e devolve o id.

    Mesmo papel de `baixar_da_camara`, para as cargas que baixam em fluxo: o hash sai do
    arquivo, e a cópia vai para `procedencia/` quando cabe em `LIMITE_PARA_GUARDAR`.
    """
    baixado = procedencia.de_arquivo(fonte, url, arquivo, CACHE)
    procedencia.guardar(baixado, CACHE / "procedencia")
    return persistencia.registrar_carga(conexao, baixado, procedencia.comando())


def registrar_o_que_nao_fecha(contas: list[dict]) -> None:
    """Diz no log, por ano, quanto do total do Portal ficou fora da base e por quê (Pendência 81)."""
    for conta in contas:
        fora = conta["total_na_fonte"] - conta["total_na_base"]
        if abs(fora) < 0.01:
            continue
        motivos = ", ".join(f"{m} {reais(v)}" for m, v in sorted(conta["motivos"].items(), key=lambda i: -i[1]))
        log.info("  %s %s %d: %s da fonte fora da base — %s",
                 conta["conjunto"], conta["medida"], conta["ano"], reais(fora), motivos)


def reais(valor: float) -> str:
    """Em bi a partir de um bilhão, em mi abaixo: "R$ 0,00 bi" escondia os milhões da cota."""
    return f"R$ {valor / 1e9:.2f} bi" if abs(valor) >= 1e9 else f"R$ {valor / 1e6:.2f} mi"
