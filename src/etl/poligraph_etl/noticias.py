"""TRATAMENTO — coleta de notícias por RSS e associação a parlamentares.

🔴 RF-38 — guardamos APENAS url, título, veículo, data e um trecho curto.
⛔ Nunca o texto integral: é reprodução de obra de terceiro, e o projeto não tem
licença. ⛔ Nunca conteúdo atrás de paywall — nem é preciso: o RSS é público.

⚠️ Só feeds RSS declarados. Não há varredura de site, não há burla de robots.txt.
"""

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from xml.etree import ElementTree

from .normalizacao import sem_acento

log = logging.getLogger("poligraph")

TRECHO_MAXIMO = 500

# ⚠️ Limiar do RF-40: abaixo disso a associação NÃO é exibida.
# Notícia errada na página de quem a pessoa segue é falha visível.
CONFIANCA_MINIMA = 0.70

CONFIANCA = {
    "NOME_COMPLETO": 1.0,
    "NOME_PARLAMENTAR": 0.85,
    "SOBRENOME": 0.40,        # ⛔ abaixo do limiar: coletado, mas não exibido
}


@dataclass(frozen=True)
class NoticiaColetada:
    url: str
    titulo: str
    veiculo: str
    publicada_em: datetime
    trecho: str | None
    hash_titulo: str


@dataclass(frozen=True)
class Mencao:
    pessoa_id: int
    confianca: float
    metodo: str


def ler_feed(xml: str, veiculo: str) -> list[NoticiaColetada]:
    """Extrai itens de um feed RSS 2.0.

    ⚠️ Item sem link ou sem título é descartado: sem eles a notícia não é exibível
    nem deduplicável.

    🔴 **XML malformado devolve lista vazia, ⛔ não exceção.** ⛔ Não é defensividade
    genérica: medido em 2026-08-29, o feed
    `www12.senado.leg.br/noticias/ultimas/rss` responde **200 com XML quebrado**
    (`mismatched tag`). Um veículo servindo lixo ⛔ não pode derrubar a coleta dos
    outros — quem chama vê pelo canário de volume.
    """
    try:
        raiz = ElementTree.fromstring(xml)
    except ElementTree.ParseError as erro:
        log.warning("feed de %s veio com XML inválido: %s", veiculo, erro)
        return []

    coletadas: list[NoticiaColetada] = []

    for item in raiz.iter("item"):
        url = _texto(item, "link")
        titulo = _texto(item, "title")
        if not url or not titulo:
            continue

        coletadas.append(
            NoticiaColetada(
                url=url,
                titulo=titulo,
                veiculo=veiculo,
                publicada_em=_data(_texto(item, "pubDate")),
                trecho=_trecho(_texto(item, "description")),
                hash_titulo=hash_titulo(titulo),
            )
        )

    return coletadas


def hash_titulo(titulo: str) -> str:
    """Hash do título normalizado.

    ⭐ Pega a mesma matéria republicada com outra URL — o caso mais comum de
    duplicata, que a chave por URL sozinha não resolve.
    """
    normalizado = re.sub(r"[^a-z0-9 ]", "", sem_acento(titulo.lower()))
    normalizado = re.sub(r"\s+", " ", normalizado).strip()

    return hashlib.sha256(normalizado.encode()).hexdigest()


def encontrar_mencoes(
    titulo: str, trecho: str | None, parlamentares: dict[int, dict]
) -> list[Mencao]:
    """Associa a notícia a parlamentares mencionados.

    `parlamentares` mapeia id → {"nome_civil": ..., "nome_exibicao": ...}.

    ⚠️ O método mais forte vence: se o nome completo aparece, não se registra também
    o sobrenome — senão a mesma pessoa entraria duas vezes com confianças diferentes.
    """
    texto = sem_acento(f"{titulo} {trecho or ''}".lower())
    mencoes: list[Mencao] = []

    for pessoa_id, nomes in parlamentares.items():
        metodo = _metodo_do_casamento(texto, nomes)
        if metodo is None:
            continue

        mencoes.append(Mencao(pessoa_id, CONFIANCA[metodo], metodo))

    return mencoes


def deve_exibir(confianca: float) -> bool:
    """RF-40 — abaixo do limiar, a associação existe no banco mas não vai à tela."""
    return confianca >= CONFIANCA_MINIMA


# ═══════════════════════════════════════════════════════════════════


def _metodo_do_casamento(texto: str, nomes: dict) -> str | None:
    completo = sem_acento((nomes.get("nome_civil") or "").lower())
    parlamentar = sem_acento((nomes.get("nome_exibicao") or "").lower())

    if completo and _palavra_inteira(texto, completo):
        return "NOME_COMPLETO"

    if parlamentar and _palavra_inteira(texto, parlamentar):
        return "NOME_PARLAMENTAR"

    # ⚠️ Sobrenome sozinho é fraco de propósito: "Silva" casaria com dezenas.
    sobrenome = parlamentar.split()[-1] if parlamentar else ""
    if len(sobrenome) >= 4 and _palavra_inteira(texto, sobrenome):
        return "SOBRENOME"

    return None


def _palavra_inteira(texto: str, alvo: str) -> bool:
    """⚠️ Sem isto, "Lira" casaria dentro de "Liradas" e "Ana" dentro de "Analise"."""
    return re.search(rf"\b{re.escape(alvo)}\b", texto) is not None


def _trecho(bruto: str | None) -> str | None:
    """Tira HTML e corta. 🔴 O corte não é estético: é a regra do RF-38."""
    if not bruto:
        return None

    limpo = re.sub(r"<[^>]+>", "", bruto)
    limpo = re.sub(r"\s+", " ", limpo).strip()

    return limpo[:TRECHO_MAXIMO] if limpo else None


def _data(bruto: str | None) -> datetime:
    if bruto:
        for formato in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
            try:
                return datetime.strptime(bruto.strip(), formato)
            except ValueError:
                continue

    return datetime.now(timezone.utc)


def _texto(item, tag: str) -> str | None:
    elemento = item.find(tag)
    return elemento.text.strip() if elemento is not None and elemento.text else None


