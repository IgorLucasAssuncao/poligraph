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

TIPOS = [
    ("INSTAGRAM", ("instagram.com",)),
    ("FACEBOOK", ("facebook.com", "fb.com")),
    ("X", ("twitter.com", "x.com")),
    ("YOUTUBE", ("youtube.com", "youtu.be")),
    ("TIKTOK", ("tiktok.com",)),
    ("LINKEDIN", ("linkedin.com",)),
]

RECURSO_TSE = "consulta_cand/rede_social_candidato_{ano}.zip"


def normalizar(bruto: str | None) -> str | None:
    """O endereço como link seguro, ou `None`.

    `instagram.com/fulano` ganha `https://`; `javascript:` e texto com espaço são recusados.
    """
    url = (bruto or "").strip()
    if not url or re.search(r"\s", url):
        return None
    if not re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I):
        url = "https://" + url.lstrip("/")
    if not re.match(r"^https?://[^/\s]+\.[^/\s]+", url, re.I):
        return None
    # Esquema e domínio em minúsculas — o TSE publica "HTTPS://YOUTUBE.COM/…", e o banco
    # (`ck_rede_url`) exige o esquema como a tela o usa. O caminho fica como veio: ele
    # diferencia maiúsculas ("youtube.com/@Fulano").
    esquema, resto = url.split("://", 1)
    dominio, _, caminho = resto.partition("/")
    return f"{esquema.lower()}://{dominio.lower()}" + (f"/{caminho}" if caminho else "")


def tipo(url: str) -> str:
    """A rede pelo domínio. Casa o domínio inteiro: `max.com` não é o X."""
    dominio = re.sub(r"^https?://", "", url, flags=re.I).split("/")[0].lower()
    dominio = dominio.removeprefix("www.").removeprefix("m.").removeprefix("mobile.")
    for nome, dominios in TIPOS:
        if any(dominio == d or dominio.endswith("." + d) for d in dominios):
            return nome
    return "OUTRA"


def para_linhas(pessoa_id: int, urls, fonte: str) -> list[dict]:
    """Uma linha por endereço válido, sem repetir."""
    vistas = {}
    for bruto in urls:
        url = normalizar(bruto)
        if url and url.lower() not in vistas:
            vistas[url.lower()] = {"pessoa_id": pessoa_id, "url": url, "rede": tipo(url), "fonte": fonte}
    return list(vistas.values())


def url_da_linha(linha: dict) -> str | None:
    """A coluna do endereço no arquivo do TSE — o nome muda entre arquivos de UF."""
    for chave, valor in linha.items():
        if chave and "URL" in chave.upper():
            return valor
    return None
