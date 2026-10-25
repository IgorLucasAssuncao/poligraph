"""As redes sociais que o parlamentar publicou — à Câmara, ou ao TSE na candidatura.

| Quem | Fonte | Chave |
|---|---|---|
| Deputado | `api/v2/deputados/{id}`, campo `redeSocial` — a lista atual | id da Câmara |
| Senador | `rede_social_candidato_{ano}.zip` do TSE — a da candidatura | código da candidatura → CPF → hash |

ATENÇÃO: O Senado não publica rede social nenhuma: a API dele traz página e e-mail oficiais, só.
Por isso o senador vem do TSE, e a tela diz de quando é.

MEDIDO: Medido em 2026-09-25: 16 de 20 deputados sorteados têm rede na Câmara.

RISCO: Só `http(s)`. O endereço vira link na tela; outro esquema (`javascript:`) seria porta
para script. O banco recusa também (`ck_rede_url`).
"""

import re

from .tipos import TipoRede

TIPOS = [
    (TipoRede.INSTAGRAM, ("instagram.com",)),
    (TipoRede.FACEBOOK, ("facebook.com", "fb.com")),
    (TipoRede.X, ("twitter.com", "x.com")),
    (TipoRede.YOUTUBE, ("youtube.com", "youtu.be")),
    (TipoRede.TIKTOK, ("tiktok.com",)),
    (TipoRede.LINKEDIN, ("linkedin.com",)),
]

RECURSO_TSE = "consulta_cand/rede_social_candidato_{ano}.zip"


def normalizar(bruto: str | None) -> str | None:
    """O endereço como link seguro, ou `None`.

    `instagram.com/fulano` ganha `https://`; `javascript:` e texto com espaço são recusados, e o nome de usuário
    sozinho ("@fulano.silva", que o TSE publica como endereço) também: sem a rede, não há para onde levar.

    Esquema e domínio em minúsculas — o TSE publica "HTTPS://YOUTUBE.COM/…", e o banco
    (`ck_rede_url`) exige o esquema como a tela o usa. O caminho fica como veio: ele
    diferencia maiúsculas ("youtube.com/@Fulano").
    """
    url = (bruto or "").strip()
    if not url or re.search(r"\s", url):
        return None
    if not re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I):
        url = "https://" + url.lstrip("/")
    if not re.match(r"^https?://[^/\s]+\.[^/\s]+", url, re.I):
        return None
    esquema, resto = url.split("://", 1)
    dominio, _, caminho = resto.partition("/")
    if dominio.startswith("@"):
        return None
    return f"{esquema.lower()}://{dominio.lower()}" + (f"/{caminho}" if caminho else "")


def tipo(url: str) -> TipoRede:
    """A rede pelo domínio. Casa o domínio inteiro: `max.com` não é o X."""
    dominio = re.sub(r"^https?://", "", url, flags=re.I).split("/")[0].lower()
    dominio = dominio.removeprefix("www.").removeprefix("m.").removeprefix("mobile.")
    for nome, dominios in TIPOS:
        if any(dominio == d or dominio.endswith("." + d) for d in dominios):
            return nome
    return TipoRede.OUTRA


def conta(url: str) -> str:
    """A chave do perfil: o mesmo perfil escrito de outro jeito tem a mesma chave.

    MEDIDO em 2026-10-23: 2.709 pessoas com a mesma rede duas vezes na tela, a maioria o mesmo perfil com barra no fim,
    `?igshid=` do aplicativo, `www.` ou `twitter.com` no lugar de `x.com`. Fica de fora a consulta, menos no
    `profile.php` do Facebook, que traz o id do perfil nela.
    """
    rede = tipo(url)
    if rede is TipoRede.OUTRA:
        return url.lower().rstrip("/")
    resto = re.sub(r"^https?://", "", url, flags=re.I).partition("/")[2]
    caminho, _, consulta = resto.split("#")[0].partition("?")
    caminho = caminho.strip("/").lower()
    if caminho.endswith("profile.php"):
        caminho += "?" + consulta.lower()
    return f"{rede}:{caminho}"


def para_linhas(pessoa_id: int, urls, fonte: str) -> list[dict]:
    """Uma linha por perfil válido, sem repetir (`conta`). Entre dois endereços do mesmo perfil, fica o sem consulta."""
    vistas: dict[str, dict] = {}
    for bruto in urls:
        url = normalizar(bruto)
        if not url:
            continue
        chave = conta(url)
        anterior = vistas.get(chave)
        if anterior is None or ("?" in anterior["url"] and "?" not in url):
            vistas[chave] = {"pessoa_id": pessoa_id, "url": url, "rede": tipo(url), "fonte": fonte}
    return list(vistas.values())


def url_da_linha(linha: dict) -> str | None:
    """A coluna do endereço no arquivo do TSE — o nome muda entre arquivos de UF."""
    for chave, valor in linha.items():
        if chave and "URL" in chave.upper():
            return valor
    return None
