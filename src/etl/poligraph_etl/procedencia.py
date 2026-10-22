"""PROCEDÊNCIA — a impressão digital de cada arquivo baixado (Pendência 72, plano/10 §2).

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
import logging
import shutil
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from .tipos import TipoFonteDeCarga

FONTES = tuple(TipoFonteDeCarga)

LIMITE_PARA_GUARDAR = 600 * 1024 * 1024
"""Acima disto o arquivo não é copiado para `procedencia/`: fica o hash e a URL.

DECISÃO: cobre o maior ZIP do TSE (~400 MB). Os cadastros da Receita passam de 1 GB cada,
são publicados em pastas mensais que continuam no ar, e copiá-los todo mês encheria o disco
do VPS com dado que a própria fonte guarda.
"""

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Baixado:
    """O que veio da fonte, com o que é preciso para provar de onde veio.

    Os bytes estão em `conteudo` (resposta pequena, em memória) ou em `arquivo` (o que foi
    baixado em fluxo para o cache); nunca nos dois. `sha256` é hexadecimal minúsculo, como
    o `CHECK` do banco exige.
    """

    fonte: str
    url: str
    sha256: str
    tamanho: int
    baixado_em: datetime
    etag: str | None = None
    modificado_na_fonte: datetime | None = None
    conteudo: bytes | None = field(default=None, repr=False)
    arquivo: Path | None = None


def de_resposta(fonte: str, resposta) -> Baixado:
    """Monta o `Baixado` de uma resposta do `requests`.

    A URL é a FINAL, com os parâmetros que foram de fato pedidos: `/votacao?dataInicio=…`
    sem os parâmetros não identifica o arquivo.
    """
    _conferir_fonte(fonte)
    return Baixado(
        fonte=fonte,
        url=resposta.url,
        sha256=hashlib.sha256(resposta.content).hexdigest(),
        tamanho=len(resposta.content),
        baixado_em=datetime.now(timezone.utc),
        etag=resposta.headers.get("ETag"),
        modificado_na_fonte=_data_http(resposta.headers.get("Last-Modified")),
        conteudo=resposta.content,
    )


def de_arquivo(fonte: str, url: str, caminho: Path, pasta_permitida: Path) -> Baixado:
    """Monta o `Baixado` de um arquivo que já está no cache.

    As cargas de dinheiro baixam em fluxo e reaproveitam o cache, então não há resposta
    HTTP na mão. A data é a de quando o arquivo chegou ao disco (`mtime`), não a da
    leitura: é ela que diz qual versão da fonte está ali.

    O hash é calculado em blocos de 1 MB: o ZIP de prestação de contas do TSE tem ~400 MB.
    """
    _conferir_fonte(fonte)
    caminho = dentro_da_pasta(caminho, pasta_permitida)
    resumo = hashlib.sha256()
    with caminho.open("rb") as entrada:
        for bloco in iter(lambda: entrada.read(1 << 20), b""):
            resumo.update(bloco)

    estado = caminho.stat()
    return Baixado(
        fonte=fonte,
        url=url,
        sha256=resumo.hexdigest(),
        tamanho=estado.st_size,
        baixado_em=datetime.fromtimestamp(estado.st_mtime, timezone.utc),
        arquivo=caminho,
    )


def dentro_da_pasta(caminho: Path, pasta: Path) -> Path:
    """O caminho resolvido, só se for um arquivo que existe dentro da pasta.

    RISCO: `--arquivo` e `--diretorio` chegam da linha de comando. Sem esta conferência, um
    caminho com `..` ou um link levaria a carga a ler, guardar e registrar um arquivo de
    qualquer lugar do disco como se fosse da fonte.
    """
    resolvido = caminho.resolve(strict=True)
    if not resolvido.is_relative_to(pasta.resolve()) or not resolvido.is_file():
        raise ValueError(f"{caminho} não é um arquivo dentro de {pasta}: as cargas só leem a pasta de cache.")
    return resolvido


def guardar(baixado: Baixado, pasta: Path) -> Path | None:
    """Guarda os bytes com o hash no nome, para qualquer um refazer a conta.

    O mesmo conteúdo baixado duas vezes vira um arquivo só: o nome é o hash.

    RISCO: copia, nunca cria link: os downloads regravam o arquivo do cache no mesmo lugar,
    e um link faria a cópia guardada mudar junto, com o hash antigo no nome.

    Devolve `None` quando o arquivo passa de `LIMITE_PARA_GUARDAR`.
    """
    destino = pasta / baixado.sha256[:2] / baixado.sha256
    if destino.exists():
        return destino
    if baixado.tamanho > LIMITE_PARA_GUARDAR:
        log.info("  %s tem %d MB: fica só o hash, a cópia é a da fonte", baixado.url,
                 baixado.tamanho >> 20)
        return None

    destino.parent.mkdir(parents=True, exist_ok=True)
    if baixado.conteudo is not None:
        destino.write_bytes(baixado.conteudo)
    else:
        shutil.copyfile(baixado.arquivo, destino)
    return destino


def comando() -> str:
    """O comando do ETL que está rodando, com os argumentos."""
    return "poligraph_etl " + " ".join(sys.argv[1:])


def versao_do_codigo() -> str:
    """`etl-` e os 12 primeiros dígitos do SHA-256 dos fontes da ETL (Pendência 73).

    A imagem não leva o repositório, então não há commit para ler. O hash cobre o caminho e
    o conteúdo de cada `.py`, em ordem: muda a cada mudança de código, e não muda por
    ordem de listagem do disco nem por `__pycache__`.
    """
    raiz = Path(__file__).resolve().parent
    resumo = hashlib.sha256()
    for arquivo in sorted(raiz.rglob("*.py")):
        resumo.update(arquivo.relative_to(raiz).as_posix().encode())
        resumo.update(b"\0")
        resumo.update(arquivo.read_bytes().replace(b"\r\n", b"\n"))
    return "etl-" + resumo.hexdigest()[:12]


def _conferir_fonte(fonte: str) -> None:
    """Fonte fora da lista é recusada aqui, antes de o `CHECK` do banco recusar."""
    if fonte not in FONTES:
        raise ValueError(f"Fonte desconhecida: {fonte}")


def _data_http(valor: str | None) -> datetime | None:
    """`Last-Modified` no formato HTTP; nulo quando falta ou vem malformado."""
    if not valor:
        return None
    try:
        return parsedate_to_datetime(valor)
    except (TypeError, ValueError):
        return None
