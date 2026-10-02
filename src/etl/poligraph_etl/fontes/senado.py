"""ENTRADA — dados abertos do Senado Federal.

Baixa e lê. Não interpreta e não descarta: isso é `ingestao_senado`.

## O que entrega

| Recurso | Forma |
|---|---|
| `votacao?dataInicio=&dataFim=` | JSON, o **ano inteiro em uma chamada** — 1 a 3 MB |
| `senador/lista/atual` | JSON dentro de envelope, 81 senadores em exercício |

O endpoint de votação devolve um array de objetos de votação, cada um com um array
aninhado `votos[]`. Não é um array plano de votos — a versão 1.0 da documentação afirmava
o contrário e estava errada.

## Duas armadilhas medidas

`?data=YYYYMMDD` responde 200 e devolve **dados de outra data**. Use `dataInicio`/`dataFim`.

`CodigoParlamentar` e `CodigoPublicoNaLegAtual` são identificadores diferentes no mesmo
objeto (5672 e 800). O que aparece em `/votacao` é o `CodigoParlamentar`; escolher o outro
quebra o join sem erro.

Os campos vêm sem higienização — `FormaTratamento` chega como `"Senador "`, com espaço à
direita. Tudo passa por `strip()`.

Documentação: [`docs/11-api-senado.md`](../../../../docs/11-api-senado.md)
"""

import csv
import logging
from pathlib import Path

import requests

log = logging.getLogger("poligraph")

BASE = "https://legis.senado.leg.br/dadosabertos"
CABECALHOS = {"Accept": "application/json"}

# Medido na legislatura 57: 57 votações em 2026 (ano parcial) a 141 em 2023. Um ano com
# menos que isto significa recorte errado ou mudança de contrato, não Senado parado.
MINIMO_POR_ANO = 20

# MEDIDO: Lacunas DA FONTE, medidas em 2026-10-02 (achados #35 e #37), contadas DEPOIS do
#    descarte das votações fora de época: 2015 tem zero e 2016 tem 6, contra 100 a 225
#    nos vizinhos — e 2016 é o ano do impeachment, não um Senado parado. Pela sequência do
#    código, faltam ~230 votações entre a última de 2014 (5329) e a primeira de 2016 (5560).
#
# ATENÇÃO: Eram 17 e 13 — mas as 17 de 2015 e 7 das 13 de 2016 eram votações de 1998 e 1999 com
#    a data errada. O ano entra com o que a fonte tem, e o log diz que é lacuna.
#
# ATENÇÃO: É um PISO, não um valor exato: se o Senado completar o arquivo, o ano passa a cruzar
#    o mínimo normal e sai daqui sozinho. Abaixo do piso, o canário volta a estourar.
LACUNAS_CONHECIDAS = {2015: 0, 2016: 6}


def baixar_votacoes(ano: int) -> list[dict]:
    """As votações de um ano inteiro, em uma requisição.

    Devolve o array como veio, incluindo as secretas: filtrar é decisão do tratamento,
    e a contagem de secretas é o próprio achado #17.
    """
    resposta = requests.get(
        f"{BASE}/votacao",
        params={"dataInicio": f"{ano}-01-01", "dataFim": f"{ano}-12-31"},
        headers=CABECALHOS,
        timeout=300,
    )
    resposta.raise_for_status()

    if not resposta.content.strip():
        return []

    dados = resposta.json() or []
    _registrar_descontinuacao(dados)

    return dados


def baixar_senadores() -> list[dict]:
    """Os senadores em exercício, já desembrulhados do envelope.

    O Senado aninha a resposta em `ListaParlamentarEmExercicio.Parlamentares.Parlamentar`,
    e cada item ainda embrulha os campos em `IdentificacaoParlamentar`. Esta função
    devolve a lista de identificações, que é o que interessa.
    """
    resposta = requests.get(
        f"{BASE}/senador/lista/atual", headers=CABECALHOS, timeout=120
    )
    resposta.raise_for_status()

    envelope = resposta.json().get("ListaParlamentarEmExercicio", {})
    _registrar_descontinuacao(envelope)

    parlamentares = (envelope.get("Parlamentares") or {}).get("Parlamentar") or []

    return [
        item["IdentificacaoParlamentar"]
        for item in parlamentares
        if "IdentificacaoParlamentar" in item
    ]


CEAPS = "https://www.senado.gov.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv"

# O CSV NAO aceita os CABECALHOS do modulo: eles pedem `application/json`, e o portal da
# transparencia responde 406 Not Acceptable. Medido em 2026-09-08.
CABECALHOS_CSV = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/csv,application/octet-stream,*/*",
}


def baixar_ceaps(ano: int, destino: Path) -> Path:
    """A cota do Senado (CEAPS) do ano, em CSV. Reaproveita o cache."""
    if destino.exists():
        log.info("  ja em cache: %s", destino.name)
        return destino

    url = CEAPS.format(ano=ano)
    log.info("  baixando %s", url)

    resposta = requests.get(url, headers=CABECALHOS_CSV, timeout=300)
    resposta.raise_for_status()

    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(resposta.content)

    return destino


def ler_ceaps(caminho: Path) -> list[dict]:
    """As linhas da CEAPS, ja sem a linha de metadado do topo.

    O arquivo NAO comeca pelo cabecalho: a primeira linha e
    `"ULTIMA ATUALIZACAO";"07/09/2026 02:02"`. Um `DictReader` direto tomaria isso como
    cabecalho, nenhuma coluna casaria e a leitura devolveria zero despesa sem erro.

    Latin-1, como o TSE e ao contrario da Camara.
    """
    with caminho.open(encoding="latin-1", errors="replace") as arquivo:
        primeira = arquivo.readline()
        if "ULTIMA ATUALIZACAO" not in primeira.upper():
            # O layout mudou: voltar ao inicio e deixar o cabecalho ser lido de la.
            arquivo.seek(0)

        return list(csv.DictReader(arquivo, delimiter=";", quotechar='"'))


def baixar_senador(codigo: str) -> dict | None:
    """A identificação de UM senador, que é onde vive o nome civil.

    A lista de exercício traz `NomeCompletoParlamentar`, mas só dos 81 de hoje. Os
    suplentes que devolveram a cadeira aparecem nos votos e não naquela lista, e o
    registro de voto não tem nome completo — sem isto, ficam sem chave para o TSE.

    Devolve `None` quando o código não existe, para o chamador registrar e seguir em vez
    de derrubar o lote inteiro por um senador.
    """
    resposta = requests.get(
        f"{BASE}/senador/{codigo}", headers=CABECALHOS, timeout=120
    )
    if resposta.status_code == 404:
        return None
    resposta.raise_for_status()

    detalhe = (resposta.json() or {}).get("DetalheParlamentar") or {}
    _registrar_descontinuacao(detalhe)

    return ((detalhe.get("Parlamentar") or {}).get("IdentificacaoParlamentar")) or None


def baixar_materia(codigo_materia: str) -> dict | None:
    """A matéria inteira: ementa, identificação e indexação.

    ## RISCO: Por que isto existe

    A descrição da votação do Senado não **não diz sobre o que ela é**:

    > *"Votação nominal do Substitutivo da Câmara dos Deputados ao Projeto de Lei
    > Complementar nº 124, de 2022, na forma do texto consolidado apresentado pelo
    > parecer."*

    Isso diz o **número**. A matéria diz o assunto:

    > *"Altera o Código Tributário Nacional, a fim de estabelecer normas gerais sobre
    > solução de controvérsias, consensualidade e processo administrativo em matéria
    > tributária e aduaneira."*

    DECISÃO: **`IndexacaoMateria` é o vocabulário controlado do Senado** e a Câmara não tem
    equivalente no CSV — aqui o Senado publica **mais**, não menos.

    ## O que devolve

    | Chave | De onde vem |
    |---|---|
    | `sigla_tipo` · `numero` · `ano` | `IdentificacaoMateria` |
    | `ementa` | `DadosBasicosMateria.EmentaMateria` |
    | `indexacao` | `DadosBasicosMateria.IndexacaoMateria` |

    Não **Devolve `None` em qualquer falha.** São ~360 chamadas por carga; derrubar a
    ingestão inteira porque uma matéria não respondeu seria trocar 359 boas por zero.
    """
    try:
        resposta = requests.get(
            f"{BASE}/materia/{codigo_materia}", headers=CABECALHOS, timeout=60
        )
        resposta.raise_for_status()
        materia = resposta.json().get("DetalheMateria", {}).get("Materia", {})
    except (requests.RequestException, ValueError, AttributeError) as erro:
        log.warning("matéria %s não respondeu: %s", codigo_materia, erro)
        return None

    identificacao = materia.get("IdentificacaoMateria") or {}
    basicos = materia.get("DadosBasicosMateria") or {}

    return {
        "codigo": _texto(identificacao.get("CodigoMateria")),
        "sigla_tipo": _texto(identificacao.get("SiglaSubtipoMateria")),
        # ATENÇÃO: Vem com zeros à esquerda: "00124". `int` cuida disso; guardar o texto
        #    faria "PLP 00124/2022" aparecer na tela.
        "numero": _texto(identificacao.get("NumeroMateria")),
        "ano": _texto(identificacao.get("AnoMateria")),
        "ementa": _texto(basicos.get("EmentaMateria")),
        "indexacao": _texto(basicos.get("IndexacaoMateria")),
    }


def _texto(valor) -> str:
    """ATENÇÃO: Colapsa espaço: a ementa vem com quebra de linha DENTRO do campo."""
    return "" if valor is None else " ".join(str(valor).split())


def conferir_volume(votacoes: list[dict], ano: int) -> None:
    """Canário: ano com volume muito abaixo do medido indica contrato alterado.

    O endpoint de plenário já foi descontinuado uma vez (achado #4) e o substituto respondeu
    200 o tempo todo. Um sucessor que passe a devolver vazio faria a ingestão registrar
    zero votações sem erro.
    """
    if len(votacoes) >= MINIMO_POR_ANO:
        return

    if len(votacoes) >= LACUNAS_CONHECIDAS.get(ano, MINIMO_POR_ANO):
        log.warning(
            "  só %d votações em %d: lacuna conhecida da fonte (achado #35), não contrato "
            "alterado. A legislatura fica com menos dado nesses anos.",
            len(votacoes), ano,
        )
        return

    raise RuntimeError(
        f"Só {len(votacoes)} votações em {ano} — esperado ao menos {MINIMO_POR_ANO}. "
        "O contrato do endpoint mudou?"
    )


# ═══════════════════════════════════════════════════════════════════


def _registrar_descontinuacao(dados) -> None:
    """RNF-11: o bloco `Descontinuacao` vai para o log.

    O endpoint anterior respondia 200 e só avisava da depreciação nos metadados. Sem
    registrar, o próximo a ser descontinuado morre em silêncio.
    """
    metadados = dados.get("Metadados") if isinstance(dados, dict) else None
    aviso = (metadados or {}).get("Descontinuacao")

    if aviso:
        log.warning("Senado sinaliza DESCONTINUACAO deste endpoint: %s", aviso)
