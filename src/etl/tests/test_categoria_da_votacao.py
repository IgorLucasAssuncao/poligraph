"""Pendência A2 — o classificador de categoria, contra frases REAIS do corpus.

## RISCO: Por que isto é o ponto mais frágil do ETL

A categoria decide **duas coisas**, e as duas em silêncio:

| | |
|---|---|
| O **peso** na matriz | `DESTAQUE` entra com 0,7 em vez de 1,0 |
| O **universo da curadoria** | RN-04: só `SUBSTANTIVA` vira pergunta |

ATENÇÃO: E ela é decidida por **regex na descrição**, não por campo da fonte.

## Não Foi verificado se a fonte dá o tipo, e NÃO dá

MEDIDO: Medido em 2026-08-29 contra `votacoesObjetos-{ano}.csv`, que tem
`proposicao_siglaTipo`:

| | |
|---|---|
| Nossas votações da Câmara em 2024-25 com objeto tipado | 954 de 998 (95,6%) |
| RISCO: Tipos de objeto numa **mesma** votação | até **10** — `DTQ, EMP, PEP, PPP, PRLE, PRLP, RDF, REQ, RPD, SBT` |
| RISCO: A combinação `PRL, RPD` | **69×** como PROCEDIMENTAL e **18×** como SUBSTANTIVA |

DECISÃO: `votacoesObjetos` lista **tudo que estava em pauta na sessão**, não o que aquela
votação decidiu. Não Ele não discrimina, e por isso o regex fica.

DECISÃO: **A mitigação é o canário**, não a esperança: `descricoes_nao_reconhecidas` acusa
frase que nenhum padrão alcança, do mesmo jeito que `siglas_desconhecidas` protege o
domínio do voto do Senado.
"""

import pytest

from poligraph_etl.normalizacao import (
    classificar_categoria,
    descricoes_nao_reconhecidas,
    divergencias_de_destaque,
    sigla_do_objeto,
)

# DECISÃO: Todas são frases REAIS, tiradas do banco com a legislatura 57 ingerida.
CASOS = [
    # ── rito ────────────────────────────────────────────────────────
    ("Rejeitado o Requerimento de Retirada de Pauta.", "PROCEDIMENTAL"),
    ("Aprovado o Requerimento de Urgência (Art. 155 do RICD).", "PROCEDIMENTAL"),
    # ── destaque, sinal forte ───────────────────────────────────────
    ("Mantido o texto. Sim: 281; Não: 148; Total: 429.", "DESTAQUE"),
    ("Rejeitada a matéria destacada.", "DESTAQUE"),
    (
        "Votação nominal do §11 do art. 37 da CF, constante da Emenda nº 1 à "
        "Proposta de Emenda à Constituição nº 45.",
        "DESTAQUE",
    ),
    (
        "Votação nominal da Emenda nº 3 à Proposta de Emenda à Constituição nº 37, "
        "de 2022, destacada.",
        "DESTAQUE",
    ),
    # ── destaque, sinal fraco: "emenda" solto ───────────────────────
    ("Rejeitadas as Emendas de Plenário. Sim: 2; não: 413.", "DESTAQUE"),
    ("Aprovada a Emenda do Senado Federal nº 1. Sim: 242; Não: 117.", "DESTAQUE"),
    ("Aprovada a Emenda. Sim: 214; Não: 107.", "DESTAQUE"),
    ("Aprovadas as Emendas de Redação nºs 1, 2 e 4.", "DESTAQUE"),
    # ── mérito ──────────────────────────────────────────────────────
    ("Aprovado o Projeto de Lei nº 3.181, de 2025, ressalvados os destaques.", "SUBSTANTIVA"),
    ("Aprovado o Substitutivo Reformulado ao PL nº 5.122, ressalvado o destaque.", "SUBSTANTIVA"),
    ("Aprovada a Subemenda Substitutiva Global ao Projeto de Lei nº 1.112.", "SUBSTANTIVA"),
    ("Aprovadas as Emendas do Senado Federal ao Projeto de Lei nº 327, de 2021.", "SUBSTANTIVA"),
    ("Votação nominal da Proposta de Emenda à Constituição nº 43, de 2022.", "SUBSTANTIVA"),
    ("Aprovada, em primeiro turno, a Proposta de Emenda à Constituição nº 45.", "SUBSTANTIVA"),
    ("Votação, em segundo turno, da PEC nº 72/2023.", "SUBSTANTIVA"),
    (
        "Aprovada a Medida Provisória, na forma da Emenda Aglutinativa nº 1, "
        "ressalvados os destaques.",
        "SUBSTANTIVA",
    ),
    ("Aprovado o parecer da CCJ à Sustação de Andamento de Ação Penal nº 2.", "SUBSTANTIVA"),
]


@pytest.mark.parametrize("descricao,esperado", CASOS)
def test_frases_reais_do_corpus(descricao, esperado):
    assert classificar_categoria(descricao) == esperado


# ═══════════════════════════════════════════════════════════════════
# RISCO: Os quatro defeitos que estas frases travam
# ═══════════════════════════════════════════════════════════════════


def test_pec_nao_e_destaque():
    """RISCO: O pior deles: **73 votações de PEC** eram DESTAQUE.

    "Proposta de **Emenda** à Constituição" contém "emenda", e o padrão casava. O voto
    mais substantivo que existe entrava na matriz com peso 0,7 e ficava **fora** do
    universo de curadoria — sem erro, só um resultado menor.
    """
    assert classificar_categoria(
        "Aprovada, em segundo turno, a Proposta de Emenda à Constituição nº 31."
    ) == "SUBSTANTIVA"


def test_ressalvado_no_singular():
    """ATENÇÃO: O lookbehind cobria só `ressalvados os` — **38 votações** diziam no singular."""
    assert classificar_categoria(
        "Aprovado o Substitutivo, ressalvado o destaque."
    ) == "SUBSTANTIVA"
    assert classificar_categoria(
        "Aprovado o Substitutivo, ressalvados os destaques."
    ) == "SUBSTANTIVA"


def test_subemenda_global_troca_o_texto_inteiro():
    """DECISÃO: Subemenda **Substitutiva Global** não é recorte: substitui tudo."""
    assert classificar_categoria(
        "Aprovada a Subemenda Substitutiva Global ao PL nº 7.082."
    ) == "SUBSTANTIVA"


def test_emenda_do_senado_no_singular_continua_destaque():
    """RISCO: A distinção que a primeira tentativa de conserto perdeu.

    ATENÇÃO: **Plural** é mérito — votar o conjunto das mudanças da outra casa. **Singular** é
    destaque — votar UMA emenda separadamente.
    """
    assert classificar_categoria("Aprovadas as Emendas do Senado Federal ao PL nº 327.") == "SUBSTANTIVA"
    assert classificar_categoria("Aprovada a Emenda do Senado Federal nº 1.") == "DESTAQUE"


# ═══════════════════════════════════════════════════════════════════
# RISCO: O canário
# ═══════════════════════════════════════════════════════════════════


def test_canario_acusa_frase_que_ninguem_reconhece():
    """RISCO: O default silencioso é o risco de todo classificador por texto.

    ATENÇÃO: Se a fonte mudar a redação, tudo vira `SUBSTANTIVA` e nada avisa. O canário
    não impede — ele **conta**, como `siglas_desconhecidas` faz com o voto do Senado.

    `"Resultado. Sim: 182; Não: 182; Abstenção: 2.",`: Não não diz o que foi votado

    `"Aprovado o Projeto de Lei nº 1.",`: reconhecida

    `"Rejeitado o Requerimento.",`: reconhecida
    """
    orfas = descricoes_nao_reconhecidas(
        [
            "Resultado. Sim: 182; Não: 182; Abstenção: 2.",
            "Aprovado o Projeto de Lei nº 1.",
            "Rejeitado o Requerimento.",
        ]
    )

    assert orfas == ["Resultado. Sim: 182; Não: 182; Abstenção: 2."]


def test_canario_ignora_vazio():
    assert descricoes_nao_reconhecidas([None, "", "   "]) == []


def test_o_canario_achou_o_que_a_leitura_humana_tinha_achado():
    """MEDIDO: Na primeira execução: **4 órfãs em 2.015 descrições**.

    DECISÃO: Uma delas é a votação do `q-preco-abusivo`, que a curadoria já havia marcado **à
    mão** como "precisa de conferência" — justamente porque a descrição não diz o que
    foi votado. O canário chegou sozinho à mesma conclusão.
    """
    assert descricoes_nao_reconhecidas(["Resultado. Sim: 182; Não: 182; Abstenção: 2; Total: 366."])


# ═══════════════════════════════════════════════════════════════════
# RISCO: O cruzamento com a sigla da fonte
# ═══════════════════════════════════════════════════════════════════


def test_extrai_a_sigla_do_objeto():
    """DECISÃO: `DTQ` é código CONTROLADO da Câmara — o único sinal estruturado sobre o tipo."""
    assert sigla_do_objeto(
        "Votação do DTQ 2 (PL): Destaque de Emenda de Plenário n. 2. (161, II)."
    ) == "DTQ"


def test_sem_sigla_devolve_nulo():
    """Não É o caso mais COMUM — 682 de 996 —, e não é erro."""
    assert sigla_do_objeto("Votação em turno único.") is None
    assert sigla_do_objeto(None) is None
    assert sigla_do_objeto("") is None


def test_divergencia_aparece_quando_a_fonte_diz_destaque_e_nos_nao():
    """RISCO: O caso real que motivou isto.

    A votação `2613731-65` tinha descrição *"Resultado. Sim: 182; Não: 182"* — que não
    diz nada — e virou a pergunta `q-preco-abusivo`. A abertura dizia *"Votação do DTQ 2:
    Destaque de Emenda de Plenário n. 2"*: voto num **destaque**, não no projeto.

    ATENÇÃO: A pergunta foi removida da curadoria.
    """
    divergentes = divergencias_de_destaque([
        {"id": "2613731-65", "categoria": "SUBSTANTIVA",
         "abertura": "Votação do DTQ 2 (PL): Destaque de Emenda de Plenário n. 2."},
    ])

    assert [d[0] for d in divergentes] == ["2613731-65"]


def test_concordancia_nao_vira_divergencia():
    assert divergencias_de_destaque([
        {"id": "x", "categoria": "DESTAQUE", "abertura": "Votação do DTQ 3: Destaque."},
        {"id": "y", "categoria": "SUBSTANTIVA", "abertura": "Votação em turno único."},
    ]) == []


# ═══════════════════════════════════════════════════════════════════
# Achado #35 — o vocabulário das legislaturas anteriores
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "descricao",
    [
        # MEDIDO: Frases REAIS de 2011 a 2016: o destaque supressivo descrito pelo resultado.
        "Suprimido o artigo: Sim: 156; não: 220; abstenção: 04; total: 380.",
        "Suprimida expressão. Sim: 8; não: 344; total: 352.",
        "Suprimidos o texto. Sim: 36; Não: 392; Total: 428.",
        "Restabelecido o texto da Câmara dos Deputados. Sim: 360; não: 96; abstenção: 1; total: 457.",
    ],
)
def test_destaque_supressivo_antigo_e_destaque(descricao):
    assert classificar_categoria(descricao) == "DESTAQUE"


def test_destaque_supressivo_antigo_e_reconhecido_pelo_canario():
    assert descricoes_nao_reconhecidas(["Suprimida expressão. Sim: 8; não: 344."]) == []


@pytest.mark.parametrize("vazio", [float("nan"), None, "", "   "])
def test_abertura_vazia_nao_derruba_a_ingestao(vazio):
    """MEDIDO: Em 2003 a célula vem vazia, e o pandas a entrega como NaN — float, e verdadeiro."""
    assert sigla_do_objeto(vazio) is None


def test_divergencia_com_abertura_nan_nao_estoura():
    votacoes = [{"id": "1", "categoria": "SUBSTANTIVA", "descricao": "x", "abertura": float("nan")}]

    assert divergencias_de_destaque(votacoes) == []


@pytest.mark.parametrize(
    "descricao",
    [
        "Escolha do Sr. Haroldo Borges Rodrigues Lima para exercer o cargo de Diretor da Agência Nacional do Petróleo - ANP.",
        "Escolha do Dr. Pedro Paulo Teixeira Manus para compor o Tribunal Superior do Trabalho.",
        "Votação do Sr. Raul Araújo Filho, para exercer o cargo de Ministro do Superior Tribunal de Justiça.",
        "Votação nominal do Ofício nº 1, de 2026 - Kátia Magalhães Arruda (CNJ).",
    ],
)
def test_sabatina_do_senado_sem_mensagem_e_autoridade(descricao):
    """MEDIDO: A2, amostra de 60 votações (2026-10-03): eram SUBSTANTIVA, e 396 no Senado inteiro."""
    assert classificar_categoria(descricao) == "AUTORIDADE"


@pytest.mark.parametrize(
    "descricao",
    [
        "Aprovado o Projeto de Lei nº 2.695, de 2021. Sim: 390; não: 20; abstenção: 1; total: 411.",
        "Votação da Medida Provisória nº 330, de 2006.",
        "Votação da PEC 96-A, de 2003 (1º turno).",
    ],
)
def test_regra_de_sabatina_nao_alcanca_o_merito(descricao):
    assert classificar_categoria(descricao) == "SUBSTANTIVA"
