"""Ingestão do Senado.

O que estes testes protegem, em ordem de risco:

1. `Votou` significa **votação secreta, posição não revelada** — e é o valor mais comum
   de todos. Mapeá-lo para uma posição inventaria opinião de senador, e o erro não
   apareceria na tela: apareceria como um número plausível de afinidade.
2. O mapeamento do Senado **não é o da Câmara**. Lá `Sim`+`Não` são 99,3% dos registros;
   aqui, 34%.
3. A votação secreta entra na tabela e sai da matriz. Descartá-la na ingestão apagaria a
   evidência de quanto do Senado não é analisável.
"""

import pytest

from poligraph_etl import ingestao_senado


def voto(**campos) -> dict:
    """Campos copiados do retorno real de `/votacao`."""
    base = {
        "codigoParlamentar": 5672,
        "nomeParlamentar": "Alan Rick",
        "siglaPartidoParlamentar": "REPUBLICANOS",
        "siglaUFParlamentar": "AC",
        "siglaVotoParlamentar": "Sim",
        "descricaoVotoParlamentar": None,
    }

    return {**base, **campos}


def votacao(**campos) -> dict:
    base = {
        "codigoSessaoVotacao": 6918,
        "descricaoVotacao": "Votação nominal da Emenda nº 1 ao PLP nº 22/2025",
        "ementa": "Dispõe sobre prazo para liquidação de restos a pagar",
        "identificacao": "PLP 22/2025",
        "votacaoSecreta": "N",
        "dataSessao": "2025-04-29",
        "totalVotosSim": None,
        "totalVotosNao": None,
        "votos": [voto()],
    }

    return {**base, **campos}


# ═══════════════════════════════════════════════════════════════════
# O voto secreto
# ═══════════════════════════════════════════════════════════════════


def test_votou_nao_e_posicao():
    """`Votou` é o registro de que houve voto, sem dizer qual.

    É o valor mais frequente do Senado — 3.774 de 10.368 registros em 2025. Qualquer
    mapeamento que o trate como posição inventa opinião para um terço da base.
    """
    assert ingestao_senado.normalizar_voto("Votou") is None


def test_o_dominio_util_e_so_tres_valores():
    assert ingestao_senado.normalizar_voto("Sim") == 1
    assert ingestao_senado.normalizar_voto("Não") == -1
    assert ingestao_senado.normalizar_voto("Abstenção") == 0


@pytest.mark.parametrize(
    "sigla", ["P-NRV", "AP", "MIS", "LS", "LP", "NCom", "NA", "Votou"]
)
def test_ausencia_e_sigilo_ficam_fora_do_calculo(sigla):
    """`None` significa "fora do cálculo", nunca "discordou".

    Tratar ausência como discordância faria o instrumento medir presença em vez de
    afinidade — a mesma regra da Câmara, com um domínio muito maior de ausências.
    """
    assert ingestao_senado.normalizar_voto(sigla) is None


def test_presidente_da_sessao_fica_fora_e_e_conhecido():
    """O presidente só vota em desempate, como o "Artigo 17" da Câmara.

    A sigla precisa ser reconhecida, e não apenas cair fora do cálculo: sem isso ela
    apareceria como "sigla nova" no log a cada execução — 59 vezes só em 2025 — e o
    alarme que deveria denunciar mudança de contrato viraria ruído que se aprende a
    ignorar.
    """
    assert ingestao_senado.normalizar_voto("Presidente (art. 51 RISF)") is None
    assert ingestao_senado.eh_sigla_conhecida("Presidente (art. 51 RISF)") is True

    achadas = ingestao_senado.siglas_desconhecidas(
        [votacao(votos=[voto(siglaVotoParlamentar="Presidente (art. 51 RISF)")])]
    )
    assert achadas == {}


def test_sigla_desconhecida_nao_derruba_a_ingestao():
    """O Senado já mudou o domínio uma vez.

    Uma sigla nova vira `None` e é contada; derrubar a carga inteira por causa dela seria
    pior que descartá-la, desde que o log denuncie.
    """
    assert ingestao_senado.normalizar_voto("XPTO") is None
    assert ingestao_senado.eh_sigla_conhecida("XPTO") is False
    assert ingestao_senado.eh_sigla_conhecida("Votou") is True


def test_sigla_nova_aparece_na_contagem():
    achadas = ingestao_senado.siglas_desconhecidas(
        [votacao(votos=[voto(siglaVotoParlamentar="XPTO"), voto(), voto(siglaVotoParlamentar="XPTO")])]
    )

    assert achadas == {"XPTO": 2}


def test_o_mapeamento_da_camara_nao_serve():
    """As duas casas exigem normalizações diferentes.

    `Votou` não existe na Câmara, e passá-lo pelo normalizador de lá devolveria `None`
    por acaso — não por decisão. O contrário também: `Artigo 17` é o presidente da
    Câmara; o do Senado vem como prefixo `Presidente`.

    ⚠️ O exemplo era `Obstrução`, "que não existe no Senado". Na 57ª ⛔ existia; em 2011
    aparece uma vez (achado #35). Medir uma legislatura e generalizar, de novo.
    """
    from poligraph_etl.normalizacao import normalizar_voto as normalizar_camara

    assert normalizar_camara("Artigo 17") is None
    assert ingestao_senado.eh_sigla_conhecida("Artigo 17") is False


def test_siglas_das_legislaturas_anteriores_sao_conhecidas_e_sem_posicao():
    """📐 Achado #35, com a descrição que a própria fonte publica para cada uma."""
    for sigla in ("REP", "P-OD", "LG", "LA", "Obstrução"):
        assert ingestao_senado.eh_sigla_conhecida(sigla), sigla
        assert ingestao_senado.normalizar_voto(sigla) is None, sigla


def test_presenca_das_siglas_anteriores():
    assert ingestao_senado.presenca_do_voto("REP") == "AUSENTE_JUSTIFICADO"
    assert ingestao_senado.presenca_do_voto("LG") == "AUSENTE_JUSTIFICADO"
    assert ingestao_senado.presenca_do_voto("P-OD") == "PRESENTE"


def test_merc_continua_desconhecida():
    """A fonte ⛔ descreve `MERC`. Sem descrição, ⛔ palpite: fica no log."""
    assert ingestao_senado.eh_sigla_conhecida("MERC") is False


# ═══════════════════════════════════════════════════════════════════
# A votação secreta entra na tabela
# ═══════════════════════════════════════════════════════════════════


def test_votacao_secreta_e_gravada_e_marcada():
    """Descartá-la na ingestão apagaria a evidência do achado #17.

    Quem filtra é a montagem da matriz, pelo campo `secreta`.
    """
    linhas = ingestao_senado.votacoes_para_linhas(
        [votacao(votacaoSecreta="S"), votacao(codigoSessaoVotacao=7000)]
    )

    assert len(linhas) == 2
    assert [linha["secreta"] for linha in linhas] == [True, False]


def test_id_leva_prefixo_de_casa():
    """`codigoSessaoVotacao` é um inteiro pequeno e colidiria com id da Câmara.

    Sem o prefixo, uma votação do Senado sobrescreveria uma da Câmara pelo
    `ON CONFLICT (id) DO UPDATE`.
    """
    linhas = ingestao_senado.votacoes_para_linhas([votacao()])

    assert linhas[0]["id"] == "SF-6918"
    assert linhas[0]["casa"] == "SENADO"


def test_legislatura_vem_da_data():
    linhas = ingestao_senado.votacoes_para_linhas([votacao(dataSessao="2025-04-29")])

    assert linhas[0]["legislatura"] == 57


def test_votacao_sem_data_e_descartada():
    """Sem data não há legislatura, e sem legislatura a votação não pode ser recortada."""
    assert ingestao_senado.votacoes_para_linhas([votacao(dataSessao=None)]) == []


# ═══════════════════════════════════════════════════════════════════
# Votos e senadores
# ═══════════════════════════════════════════════════════════════════


def test_voto_fora_do_de_para_e_descartado():
    assert ingestao_senado.votos_para_linhas([votacao()], {}) == []


def test_partido_gravado_e_o_do_momento_do_voto():
    """Trocar de partido é comum; guardar só a filiação atual reescreveria o passado."""
    linhas = ingestao_senado.votos_para_linhas([votacao()], {"5672": 42})

    assert linhas[0]["partido_no_voto"] == "REPUBLICANOS"
    assert linhas[0]["uf_no_voto"] == "AC"
    assert linhas[0]["valor"] == 1


def test_senador_entra_sem_cpf():
    """O Senado não publica CPF — a ponte com a Câmara depende de outro caminho."""
    linhas = ingestao_senado.senadores_para_linhas(
        [
            {
                "CodigoParlamentar": "5672",
                "CodigoPublicoNaLegAtual": "800",
                "NomeParlamentar": "Alan Rick",
                "NomeCompletoParlamentar": "Alan Rick Miranda",
                "UrlFotoParlamentar": "http://www.senado.leg.br/…/senador5672.jpg",
            }
        ]
    )

    assert len(linhas) == 1
    assert linhas[0]["cpf_hash"] is None
    assert linhas[0]["fonte"] == "SENADO"


def test_foto_do_senado_e_o_endereco_final_em_https():
    """O endereço publicado vem em `http://` e redireciona (301); o final responde direto."""
    linhas = ingestao_senado.senadores_para_linhas(
        [
            {
                "CodigoParlamentar": "5672",
                "NomeParlamentar": "Alan Rick",
                "UrlFotoParlamentar":
                    "http://www.senado.leg.br/senadores/img/fotos-oficiais/senador5672.jpg",
            }
        ]
    )

    assert linhas[0]["url_foto"] == "https://legis.senado.leg.br/senadores/fotos-oficiais/5672"


def test_senador_que_veio_pelo_voto_tambem_tem_foto():
    """📐 375 de 458 senadores ficavam sem foto: só a lista de exercício a trazia."""
    [linha] = ingestao_senado.senadores_dos_votos(
        [votacao(votos=[voto(codigoParlamentar=70, nomeParlamentar="Fulano")])], ja_conhecidos=set()
    )

    assert linha["url_foto"] == "https://legis.senado.leg.br/senadores/fotos-oficiais/70"


def test_usa_o_codigo_parlamentar_nao_o_publico():
    """São dois identificadores diferentes no mesmo objeto: 5672 e 800.

    O que aparece em `/votacao` é o `CodigoParlamentar`. Escolher o outro quebra o join
    entre senador e voto sem erro nenhum — todos os votos seriam descartados.
    """
    linhas = ingestao_senado.senadores_para_linhas(
        [
            {
                "CodigoParlamentar": "5672",
                "CodigoPublicoNaLegAtual": "800",
                "NomeParlamentar": "Alan Rick",
            }
        ]
    )

    assert linhas[0]["id_externo"] == "5672"

    # E é esse mesmo código que o voto traz
    mapa = {linhas[0]["id_externo"]: 42}
    assert ingestao_senado.votos_para_linhas([votacao()], mapa)[0]["pessoa_id"] == 42


def test_campos_vem_com_espaco_e_sao_limpos():
    """`FormaTratamento` chega como `"Senador "` — os campos não são higienizados."""
    linhas = ingestao_senado.senadores_para_linhas(
        [{"CodigoParlamentar": " 5672 ", "NomeParlamentar": "  Alan Rick  "}]
    )

    assert linhas[0]["id_externo"] == "5672"
    assert linhas[0]["nome_exibicao"] == "Alan Rick"


# ═══════════════════════════════════════════════════════════════════
# Senadores que não estão na lista de exercício
# ═══════════════════════════════════════════════════════════════════


def test_senador_fora_da_lista_e_criado_pelo_voto():
    """`/senador/lista/atual` tem 81; os votos de 2023-2026 alcançam 104 pessoas.

    A diferença são suplentes que devolveram a cadeira, licenciados e quem assumiu cargo
    no Executivo. Sem criá-los, 3.252 votos — 10,5% da base — seriam descartados por não
    encontrar dono, e o descarte apareceria como base menor, não como erro.
    """
    linhas = ingestao_senado.senadores_dos_votos(
        [
            votacao(votos=[voto(codigoParlamentar=5976, nomeParlamentar="Eduardo Girão")]),
            votacao(codigoSessaoVotacao=7000,
                    votos=[voto(codigoParlamentar=5976, nomeParlamentar="Eduardo Girão"),
                           voto(codigoParlamentar=6342, nomeParlamentar="Jorge Seif")]),
        ]
    )

    assert len(linhas) == 2, "o mesmo senador em duas votações vira UMA pessoa"
    assert {linha["id_externo"] for linha in linhas} == {"5976", "6342"}
    assert all(linha["fonte"] == "SENADO" for linha in linhas)
    assert all(linha["cpf_hash"] is None for linha in linhas)


def test_voto_sem_nome_nao_vira_pessoa():
    """Criar pessoa sem nome deixaria um registro anônimo impossível de reconciliar."""
    assert ingestao_senado.senadores_dos_votos(
        [votacao(votos=[voto(nomeParlamentar=None)])]
    ) == []


def test_licenca_paternidade_entrou_no_dominio():
    """`LAP` apareceu em 2026 e o canário a denunciou.

    É licença paternidade — ausência, portanto fora do cálculo.
    """
    assert ingestao_senado.normalizar_voto("LAP") is None
    assert ingestao_senado.eh_sigla_conhecida("LAP") is True


def test_a_descricao_da_sigla_vem_da_propria_fonte():
    """A API traz `descricaoVotoParlamentar` junto da sigla.

    Sem aproveitá-la, diagnosticar um `{'LAP': 1}` no log exigiria caçar o registro à mão.
    """
    descricoes = ingestao_senado.descricoes_de_sigla(
        [votacao(votos=[voto(siglaVotoParlamentar="LAP",
                             descricaoVotoParlamentar="Licença paternidade ou ao adotante")])]
    )

    assert descricoes["LAP"] == "Licença paternidade ou ao adotante"


# ═══════════════════════════════════════════════════════════════════
# O placar — o painel do questionário depende dele
# ═══════════════════════════════════════════════════════════════════


def test_placar_e_contado_dos_votos_nao_lido_do_campo():
    """O Senado devolve `totalVotosSim` e `totalVotosNao` como NULL — em todas.

    O painel do questionário é a assinatura visual do site: uma fileira de traços, um
    por parlamentar, cheio para quem se posicionou. Sem contar do array de votos, toda
    pergunta do Senado renderizaria o painel vazio, como se ninguém tivesse votado.
    """
    linhas = ingestao_senado.votacoes_para_linhas(
        [
            votacao(
                totalVotosSim=None,
                totalVotosNao=None,
                votos=[
                    voto(codigoParlamentar=1, siglaVotoParlamentar="Sim"),
                    voto(codigoParlamentar=2, siglaVotoParlamentar="Sim"),
                    voto(codigoParlamentar=3, siglaVotoParlamentar="Não"),
                    voto(codigoParlamentar=4, siglaVotoParlamentar="Abstenção"),
                    voto(codigoParlamentar=5, siglaVotoParlamentar="AP"),
                ],
            )
        ]
    )

    assert linhas[0]["votos_sim"] == 2
    assert linhas[0]["votos_nao"] == 1


def test_votacao_secreta_tem_placar_zero():
    """Correto, e não uma falha: em votação secreta ninguém revelou posição.

    O painel vazio ali é a informação — mas essas votações não viram pergunta, porque
    a curadoria só alcança as abertas.
    """
    linhas = ingestao_senado.votacoes_para_linhas(
        [
            votacao(
                votacaoSecreta="S",
                votos=[voto(siglaVotoParlamentar="Votou") for _ in range(60)],
            )
        ]
    )

    assert linhas[0]["votos_sim"] == 0
    assert linhas[0]["votos_nao"] == 0


def test_senador_ja_trazido_pela_lista_nao_e_recriado_pelo_voto():
    """🔴 Sem isto, `gravar_pessoas` sobrescreve o nome civil pelo nome parlamentar.

    A lista de exercício traz `NomeCompletoParlamentar`; o voto ⛔ não traz. Como o
    upsert faz `SET nome_civil = ...`, o segundo passo regredia o dado — e foi assim
    que os 104 senadores ficaram sem chave para casar com o TSE.
    """
    votacoes = [{"votos": [{"codigoParlamentar": "5540", "nomeParlamentar": "Fulano"}]}]

    assert ingestao_senado.senadores_dos_votos(votacoes, ja_conhecidos={"5540"}) == []
    assert len(ingestao_senado.senadores_dos_votos(votacoes)) == 1


# ═══════════════════════════════════════════════════════════════════
# Presença — separada da posição
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("sigla", "presenca"),
    [
        ("Sim", "PRESENTE"),
        ("Não", "PRESENTE"),
        # Votação secreta e "presente, não registrou voto": presença sem posição.
        ("Votou", "PRESENTE"),
        ("P-NRV", "PRESENTE"),
        ("Presidente (art. 51 RISF)", "PRESENTE"),
        ("LS", "AUSENTE_JUSTIFICADO"),
        ("MIS", "AUSENTE_JUSTIFICADO"),
        ("AP", "AUSENTE_JUSTIFICADO"),
        ("NCom", "AUSENTE"),
        ("NA", None),
        # ⚠️ Sigla nova ⛔ vira presença: inflaria o número sem erro.
        ("XYZ", None),
    ],
)
def test_presenca_pela_sigla(sigla, presenca):
    from poligraph_etl.ingestao_senado import presenca_do_voto

    assert presenca_do_voto(sigla) == presenca


# ═══════════════════════════════════════════════════════════════════
# Achado #35 — a lacuna da fonte em 2015 e 2016
# ═══════════════════════════════════════════════════════════════════


def test_lacuna_conhecida_passa_com_aviso(caplog):
    from poligraph_etl.fontes import senado

    with caplog.at_level("WARNING", logger="poligraph"):
        senado.conferir_volume([{}] * 13, 2016)

    assert "lacuna conhecida" in caplog.text


def test_abaixo_do_piso_da_lacuna_continua_estourando():
    """A lacuna é um piso: o canário só se cala para o volume que foi MEDIDO."""
    from poligraph_etl.fontes import senado

    with pytest.raises(RuntimeError):
        senado.conferir_volume([{}] * 5, 2016)


def test_ano_sem_lacuna_conhecida_continua_estourando():
    from poligraph_etl.fontes import senado

    with pytest.raises(RuntimeError):
        senado.conferir_volume([{}] * 13, 2021)


def test_voto_sem_uf_nem_partido_entra_vazio_e_nao_nulo():
    """📐 2002: ausência registrada sem UF (achado #35). As colunas são NOT NULL."""
    sem_uf = votacao(votos=[voto(siglaUFParlamentar=None, siglaPartidoParlamentar=None, siglaVotoParlamentar="NCom")])

    [linha] = ingestao_senado.votos_para_linhas([sem_uf], {"5672": 42})

    assert linha["uf_no_voto"] == "" and linha["partido_no_voto"] == ""
