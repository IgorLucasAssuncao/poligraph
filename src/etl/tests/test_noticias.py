"""Testes da coleta de notícias.

🔴 Vários destes travam decisões JURÍDICAS, não técnicas: o que pode ser guardado
(RF-38) e o que pode ser exibido (RF-40).
"""

import pytest

from poligraph_etl.noticias import (
    CONFIANCA_MINIMA,
    TRECHO_MAXIMO,
    deve_exibir,
    encontrar_mencoes,
    hash_titulo,
    ler_feed,
)

FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Câmara aprova projeto sobre licenciamento ambiental</title>
    <link>https://exemplo.com/noticia-1</link>
    <pubDate>Tue, 15 Jul 2025 10:30:00 -0300</pubDate>
    <description>&lt;p&gt;O plenário aprovou nesta terça o texto que muda as regras.&lt;/p&gt;</description>
  </item>
  <item>
    <title>Deputada Ana Ribeiro defende mudança no texto</title>
    <link>https://exemplo.com/noticia-2</link>
    <pubDate>Wed, 16 Jul 2025 08:00:00 -0300</pubDate>
    <description>Declaração foi dada em entrevista.</description>
  </item>
  <item>
    <title>Item sem link deve ser ignorado</title>
  </item>
</channel></rss>"""

PARLAMENTARES = {
    1: {"nome_civil": "Ana Ribeiro dos Santos", "nome_exibicao": "Ana Ribeiro"},
    2: {"nome_civil": "Bruno Tavares Lima", "nome_exibicao": "Bruno Tavares"},
}


# ═══════════════════════════════════════════════════════════════════
# Leitura do feed
# ═══════════════════════════════════════════════════════════════════


def test_le_itens_do_feed():
    noticias = ler_feed(FEED, "Exemplo")

    assert len(noticias) == 2          # o terceiro não tem link
    assert noticias[0].veiculo == "Exemplo"
    assert noticias[0].url == "https://exemplo.com/noticia-1"


def test_item_sem_link_ou_titulo_e_descartado():
    """Sem eles a notícia não é exibível nem deduplicável."""
    noticias = ler_feed(FEED, "Exemplo")

    assert all(n.url and n.titulo for n in noticias)


def test_html_do_trecho_e_removido():
    noticias = ler_feed(FEED, "Exemplo")

    assert "<p>" not in (noticias[0].trecho or "")
    assert "plenário aprovou" in noticias[0].trecho


# ═══════════════════════════════════════════════════════════════════
# 🔴 RF-38 — o limite do trecho é regra, não estética
# ═══════════════════════════════════════════════════════════════════


def test_trecho_longo_e_cortado():
    """🔴 Guardar o corpo da matéria seria reprodução de obra de terceiro.

    O corte existe para que não seja possível, nem por acidente, transformar o
    campo num espelho do texto integral.
    """
    corpo = "palavra " * 500
    feed = FEED.replace(
        "Declaração foi dada em entrevista.", corpo
    )

    noticias = ler_feed(feed, "Exemplo")
    trecho = next(n.trecho for n in noticias if n.url.endswith("noticia-2"))

    assert len(trecho) <= TRECHO_MAXIMO


# ═══════════════════════════════════════════════════════════════════
# Deduplicação
# ═══════════════════════════════════════════════════════════════════


def test_mesmo_titulo_com_acento_diferente_da_mesmo_hash():
    """⭐ A mesma matéria republicada com outra URL — o caso que a chave por URL não pega."""
    assert hash_titulo("Câmara aprova projeto") == hash_titulo("Camara aprova projeto")


def test_hash_ignora_pontuacao_e_espacos():
    assert hash_titulo("Câmara aprova  projeto!") == hash_titulo("Camara aprova projeto")


def test_titulos_diferentes_dao_hashes_diferentes():
    assert hash_titulo("Câmara aprova projeto") != hash_titulo("Senado aprova projeto")


# ═══════════════════════════════════════════════════════════════════
# 🔴 RF-40 — associação e confiança
# ═══════════════════════════════════════════════════════════════════


def test_nome_parlamentar_no_titulo_e_encontrado():
    mencoes = encontrar_mencoes(
        "Deputada Ana Ribeiro defende mudança", None, PARLAMENTARES
    )

    assert [m.pessoa_id for m in mencoes] == [1]
    assert mencoes[0].metodo == "NOME_PARLAMENTAR"


def test_nome_completo_tem_confianca_maior_que_nome_parlamentar():
    completo = encontrar_mencoes("Ana Ribeiro dos Santos falou", None, PARLAMENTARES)
    parlamentar = encontrar_mencoes("Ana Ribeiro falou", None, PARLAMENTARES)

    assert completo[0].confianca > parlamentar[0].confianca


def test_sobrenome_sozinho_fica_abaixo_do_limiar():
    """⛔ "Tavares" casaria com dezenas de pessoas — coletado, mas não exibido."""
    mencoes = encontrar_mencoes("Tavares comentou o caso", None, PARLAMENTARES)

    assert mencoes[0].metodo == "SOBRENOME"
    assert not deve_exibir(mencoes[0].confianca)


def test_uma_pessoa_nao_entra_duas_vezes():
    """⚠️ O método mais forte vence — senão a mesma pessoa apareceria com duas confianças."""
    mencoes = encontrar_mencoes("Ana Ribeiro dos Santos e Ana Ribeiro", None, PARLAMENTARES)

    assert len([m for m in mencoes if m.pessoa_id == 1]) == 1


def test_casamento_e_por_palavra_inteira():
    """🔴 Sem isto, "Lima" casaria dentro de "Limadas" e "Ana" dentro de "Analisou"."""
    mencoes = encontrar_mencoes("O relator analisou o texto", None, PARLAMENTARES)

    assert mencoes == []


def test_notica_sem_mencao_nao_associa_ninguem():
    mencoes = encontrar_mencoes("Câmara aprova projeto", None, PARLAMENTARES)

    assert mencoes == []


def test_trecho_tambem_e_procurado_nao_so_o_titulo():
    mencoes = encontrar_mencoes(
        "Plenário decide", "A deputada Ana Ribeiro votou contra.", PARLAMENTARES
    )

    assert [m.pessoa_id for m in mencoes] == [1]


@pytest.mark.parametrize(
    "confianca,esperado",
    [(1.0, True), (0.85, True), (CONFIANCA_MINIMA, True), (0.69, False), (0.40, False)],
)
def test_limiar_de_exibicao(confianca, esperado):
    assert deve_exibir(confianca) is esperado
