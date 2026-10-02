"""PROCEDÊNCIA — a impressão digital de cada arquivo baixado (PL72, plano/10 §2).

Cada arquivo ou resposta de fonte oficial vira uma linha em `cargas`, com a URL exata,
quando foi baixado, o SHA-256 dos bytes como chegaram e a identificação que o próprio órgão
deu à versão (`ETag`, `Last-Modified`). As linhas de dado gravadas a partir dele levam o
`carga_id`.

ATENÇÃO: o hash é nosso. O TSE tem o campo de hash no catálogo e o deixa vazio; a Câmara só
manda `ETag` e `Last-Modified`, e regenera os arquivos toda madrugada. O hash prova que a
cópia guardada não mudou depois do download, e o arquivo guardado permite a qualquer um
refazer a conta. Ver https://claude.ai/artifact/Gc11fzR2MEZk85RFMuGjki.
"""

import hashlib
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

FONTES = ("CAMARA", "SENADO", "TSE", "PORTAL_TRANSPARENCIA", "RECEITA", "IBGE")


@dataclass(frozen=True)
class Baixado:
    """O que veio da fonte, com o que é preciso para provar de onde veio."""

    fonte: str
    url: str
    conteudo: bytes = field(repr=False)
    baixado_em: datetime
    etag: str | None = None
    modificado_na_fonte: datetime | None = None

    @property
    def sha256(self) -> str:
        """Hexadecimal minúsculo, como o `CHECK` do banco exige."""
        return hashlib.sha256(self.conteudo).hexdigest()


def de_resposta(fonte: str, resposta) -> Baixado:
    """Monta o `Baixado` de uma resposta do `requests`.

    A URL é a FINAL, com os parâmetros que foram de fato pedidos: `/votacao?dataInicio=…`
    sem os parâmetros não identifica o arquivo.
    """
    if fonte not in FONTES:
        raise ValueError(f"Fonte desconhecida: {fonte}")

    return Baixado(
        fonte=fonte,
        url=resposta.url,
        conteudo=resposta.content,
        baixado_em=datetime.now(timezone.utc),
        etag=resposta.headers.get("ETag"),
        modificado_na_fonte=_data_http(resposta.headers.get("Last-Modified")),
    )


def guardar(baixado: Baixado, pasta: Path) -> Path:
    """Guarda os bytes com o hash no nome, para qualquer um refazer a conta.

    O mesmo conteúdo baixado duas vezes vira um arquivo só: o nome é o hash.
    """
    destino = pasta / baixado.sha256[:2] / baixado.sha256
    if not destino.exists():
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(baixado.conteudo)
    return destino


def comando() -> str:
    """O comando do ETL que está rodando, com os argumentos."""
    return "poligraph_etl " + " ".join(sys.argv[1:])


def _data_http(valor: str | None) -> datetime | None:
    """`Last-Modified` no formato HTTP; nulo quando falta ou vem malformado."""
    if not valor:
        return None
    try:
        return parsedate_to_datetime(valor)
    except (TypeError, ValueError):
        return None
