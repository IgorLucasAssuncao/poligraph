"""Testes de integração da gravação, contra Postgres real.

RISCO: O que estes testes provam e nenhum unitário provaria: que a carga é IDEMPOTENTE.

O ETL roda todo dia sobre os mesmos arquivos — a Câmara os reconstrói toda madrugada,
inclusive os anos fechados (achado #19). Sem idempotência o banco dobraria de tamanho
por dia, e ninguém perceberia até o disco encher.

ATENÇÃO: Exigem Docker. Sem ele, são PULADOS — teste vermelho por falta de ambiente treina
a pessoa a ignorar vermelho.
"""

import pytest

# Marca o módulo inteiro: é o único do ETL que exige Docker, e o CI o desmarca
# com `-m "not integracao"`.
pytestmark = pytest.mark.integracao

# Ainda usado nos testes de CheckViolation; a fixture `conexao` mora no conftest.
psycopg = pytest.importorskip("psycopg")

from poligraph_etl import persistencia  # noqa: E402
from poligraph_etl.similaridade import ParSimilar  # noqa: E402

# RISCO: Schema mínimo espelhando o que o EF cria. NÃO é a fonte da verdade.
#
# ATENÇÃO: Escrever este DDL à mão já custou caro: durante todo o desenvolvimento ele usou os
#    nomes NO SINGULAR (`votacao`, `voto`, `pessoa`) enquanto o EF criava no plural. Os
#    testes passavam contra um banco que este arquivo inventava, e o ETL nunca havia
#    conseguido falar com o banco de verdade.
#
# DECISÃO: `test_contrato_schema.py` agora lê o `PoligraphDb.cs` e trava os NOMES. O que
#    continua sem proteção aqui são as COLUNAS — ver PL37.


@pytest.fixture(autouse=True)
def limpar(conexao):
    conexao.execute(
        "TRUNCATE noticia_pessoas, noticias, similaridades, execucoes, votos, votacoes, "
        "pessoa_fonte_ids, pessoas RESTART IDENTITY CASCADE"
    )


# ═══════════════════════════════════════════════════════════════════
# RISCO: RF-09 — idempotência
# ═══════════════════════════════════════════════════════════════════


def test_pessoa_reingerida_nao_duplica(conexao):
    pessoas = [_pessoa("204528", "Ana Ribeiro")]

    persistencia.gravar_pessoas(conexao, pessoas)
    persistencia.gravar_pessoas(conexao, pessoas)
    persistencia.gravar_pessoas(conexao, pessoas)

    total = conexao.execute("SELECT count(*) FROM pessoas").fetchone()[0]
    assert total == 1


def test_pessoa_reingerida_com_nome_novo_atualiza(conexao):
    """A Câmara corrige nome retroativamente — o ETL tem de acompanhar."""
    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Ana Ribeiro")])
    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Ana Ribeiro Sobrinho")])

    nome = conexao.execute("SELECT nome_exibicao FROM pessoas").fetchone()[0]
    assert nome == "Ana Ribeiro Sobrinho"


def test_fonte_sem_foto_nao_apaga_a_foto_ja_gravada(conexao):
    """RISCO: A regressão que deixou os 104 senadores sem rosto no banco.

    `ingerir_senado` grava DUAS vezes a mesma pessoa: primeiro pela lista de exercício,
    que traz `UrlFotoParlamentar`, e depois por `senadores_dos_votos`, que devolve os
    mesmos senadores com `url_foto` nula — porque o registro de voto não tem foto.

    Com atribuição direta a segunda passada apagava a primeira, sem erro e sem log.
    """
    com_foto = _pessoa("5672", "Alan Rick")
    com_foto["url_foto"] = "https://www.senado.leg.br/senadores/img/senador5672.jpg"
    persistencia.gravar_pessoas(conexao, [com_foto])

    persistencia.gravar_pessoas(conexao, [_pessoa("5672", "Alan Rick")])

    foto = conexao.execute("SELECT url_foto FROM pessoas").fetchone()[0]
    assert foto == com_foto["url_foto"]


def test_foto_nova_substitui_a_antiga(conexao):
    """ATENÇÃO: O COALESCE preserva, não congela: foto nova continua entrando."""
    antiga = _pessoa("204528", "Ana Ribeiro")
    antiga["url_foto"] = "https://camara.leg.br/bandep/antiga.jpg"
    persistencia.gravar_pessoas(conexao, [antiga])

    nova = _pessoa("204528", "Ana Ribeiro")
    nova["url_foto"] = "https://camara.leg.br/bandep/nova.jpg"
    persistencia.gravar_pessoas(conexao, [nova])

    foto = conexao.execute("SELECT url_foto FROM pessoas").fetchone()[0]
    assert foto == "https://camara.leg.br/bandep/nova.jpg"


def test_votacao_reingerida_nao_duplica(conexao):
    votacoes = [_votacao("2358548-89")]

    persistencia.gravar_votacoes(conexao, votacoes)
    persistencia.gravar_votacoes(conexao, votacoes)

    total = conexao.execute("SELECT count(*) FROM votacoes").fetchone()[0]
    assert total == 1


def test_voto_reingerido_nao_duplica(conexao):
    pessoa_id = _preparar_pessoa_e_votacao(conexao)
    votos = [_voto("2358548-89", pessoa_id, 1)]

    persistencia.gravar_votos(conexao, votos)
    persistencia.gravar_votos(conexao, votos)

    total = conexao.execute("SELECT count(*) FROM votos").fetchone()[0]
    assert total == 1


def test_voto_corrigido_pela_camara_e_atualizado(conexao):
    """ATENÇÃO: Sem o DO UPDATE, uma correção da Câmara seria ignorada em silêncio."""
    pessoa_id = _preparar_pessoa_e_votacao(conexao)

    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, 1)])
    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, -1)])

    valor = conexao.execute("SELECT valor FROM votos").fetchone()[0]
    assert valor == -1


def test_partido_no_voto_e_historico_e_acompanha_correcao(conexao):
    """DECISÃO: 14 deputados trocaram de partido só em 2025 — o campo é registro do momento."""
    pessoa_id = _preparar_pessoa_e_votacao(conexao)

    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, 1, partido="PARTIDO-A")])
    persistencia.gravar_votos(conexao, [_voto("2358548-89", pessoa_id, 1, partido="PARTIDO-B")])

    partido = conexao.execute("SELECT partido_no_voto FROM votos").fetchone()[0]
    assert partido == "PARTIDO-B"


# ═══════════════════════════════════════════════════════════════════
# Execução e similaridade
# ═══════════════════════════════════════════════════════════════════


def test_execucao_abre_em_andamento_e_fecha_concluida(conexao):
    execucao_id = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v1")

    status = conexao.execute(
        "SELECT status FROM execucoes WHERE id = %s", (execucao_id,)
    ).fetchone()[0]
    assert status == "EM_ANDAMENTO"

    persistencia.fechar_execucao(conexao, execucao_id, sucesso=True)

    status, concluida = conexao.execute(
        "SELECT status, concluida_em FROM execucoes WHERE id = %s", (execucao_id,)
    ).fetchone()
    assert status == "CONCLUIDA"
    assert concluida is not None


def test_similaridade_abaixo_do_minimo_e_rejeitada_pelo_banco(conexao):
    """RISCO: RN-02 no banco. O Python pode ter bug; o CHECK não deixa passar."""
    pessoa_id = _preparar_pessoa_e_votacao(conexao)
    outro = persistencia.gravar_pessoas(conexao, [_pessoa("204529", "Bruno Tavares")])
    ids = [r[0] for r in conexao.execute("SELECT id FROM pessoas ORDER BY id").fetchall()]
    execucao_id = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v1")

    par = ParSimilar(min(ids), max(ids), "CONCORDANCIA", 0.9, 19)

    with pytest.raises(psycopg.errors.CheckViolation):
        persistencia.gravar_similaridades(conexao, execucao_id, [par])


def test_duas_execucoes_convivem_sem_conflito(conexao):
    """DECISÃO: Cada execução é um retrato independente — é o que dá reprodutibilidade."""
    _preparar_pessoa_e_votacao(conexao)
    persistencia.gravar_pessoas(conexao, [_pessoa("204529", "Bruno Tavares")])
    ids = [r[0] for r in conexao.execute("SELECT id FROM pessoas ORDER BY id").fetchall()]

    par = ParSimilar(min(ids), max(ids), "CONCORDANCIA", 0.9, 30)

    primeira = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v1")
    segunda = persistencia.abrir_execucao(conexao, "CAMARA", 57, 10, "v2")

    persistencia.gravar_similaridades(conexao, primeira, [par])
    persistencia.gravar_similaridades(conexao, segunda, [par])

    total = conexao.execute("SELECT count(*) FROM similaridades").fetchone()[0]
    assert total == 2


# ═══════════════════════════════════════════════════════════════════


def _pessoa(id_externo: str, nome: str) -> dict:
    return {
        "nome_civil": nome, "nome_exibicao": nome, "cpf_hash": None,
        "url_foto": None,
        "fonte": "CAMARA", "id_externo": id_externo,
        "metodo": "MANUAL", "confianca": 1.0,
    }


def _votacao(id_votacao: str) -> dict:
    return {
        "id": id_votacao, "casa": "CAMARA", "legislatura": 57,
        "data": "2025-12-09", "orgao": "PLEN", "descricao": "Aprovado o Projeto",
        "proposicao_id": None, "categoria": "SUBSTANTIVA",
        "secreta": False, "plenario": True, "votos_sim": 291, "votos_nao": 148,
    }


def _voto(votacao_id: str, pessoa_id: int, valor: int, partido: str = "PARTIDO-A") -> dict:
    return {
        "votacao_id": votacao_id, "pessoa_id": pessoa_id, "valor": valor,
        "partido_no_voto": partido, "uf_no_voto": "SP",
    }


def _preparar_pessoa_e_votacao(conexao) -> int:
    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Ana Ribeiro")])
    persistencia.gravar_votacoes(conexao, [_votacao("2358548-89")])

    return conexao.execute("SELECT id FROM pessoas LIMIT 1").fetchone()[0]


# ═══════════════════════════════════════════════════════════════════
# O recorte por casa — achado #7
# ═══════════════════════════════════════════════════════════════════


def test_matriz_de_uma_casa_ignora_o_voto_da_outra(conexao):
    """A pessoa que atua nas duas casas entra nas duas matrizes, com os votos de cada uma.

    É o caso do deputado que virou senador: 43 nomes aparecem nas duas casas na base. Se
    a ponte do achado #18 for construída, ele vira **uma** pessoa — e a partir daí a
    matriz precisa recortar por casa, senão o voto de senador entraria na comparação
    entre deputados.

    Aresta cruzando as casas nunca é legítima, nem para essa pessoa: aresta significa
    "estes dois votam parecido", e ela é um nó só, não dois ligados.
    """
    from poligraph_etl.__main__ import _montar_matriz

    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Ana Ribeiro")])
    pessoa_id = conexao.execute("SELECT id FROM pessoas LIMIT 1").fetchone()[0]

    # A mesma pessoa com id nas duas casas — o estado que a ponte produziria
    conexao.execute(
        """INSERT INTO pessoa_fonte_ids (pessoa_id, fonte, id_externo, metodo, confianca)
           VALUES (%s, 'SENADO', '5672', 'MANUAL', 1.0)""",
        (pessoa_id,),
    )

    da_camara = _votacao("2358548-89")
    do_senado = {**_votacao("SF-6918"), "casa": "SENADO"}
    persistencia.gravar_votacoes(conexao, [da_camara, do_senado])
    persistencia.gravar_votos(
        conexao,
        [_voto("2358548-89", pessoa_id, 1), _voto("SF-6918", pessoa_id, -1)],
    )

    _, votacoes_camara, matriz_camara, _ = _montar_matriz(conexao, 57, "CAMARA")
    _, votacoes_senado, matriz_senado, _ = _montar_matriz(conexao, 57, "SENADO")

    assert [v[0] for v in votacoes_camara] == ["2358548-89"]
    assert [v[0] for v in votacoes_senado] == ["SF-6918"]

    # Cada matriz tem só o voto da própria casa, e o valor é o daquela casa
    assert matriz_camara.shape == (1, 1) and matriz_camara[0, 0] == 1
    assert matriz_senado.shape == (1, 1) and matriz_senado[0, 0] == -1


def test_quem_so_vota_numa_casa_nao_entra_na_matriz_da_outra(conexao):
    """Sem o recorte, analisar o Senado montaria 643 linhas vazias de deputado.

    A consequência não seria erro: seria o kNN comparando quem não tem uma votação em
    comum sequer, e o grafo do Senado nascendo com vizinhos falsos.
    """
    from poligraph_etl.__main__ import _montar_matriz

    persistencia.gravar_pessoas(conexao, [_pessoa("204528", "Só Deputada")])
    deputada = conexao.execute("SELECT id FROM pessoas LIMIT 1").fetchone()[0]

    persistencia.gravar_votacoes(
        conexao, [_votacao("2358548-89"), {**_votacao("SF-6918"), "casa": "SENADO"}]
    )
    persistencia.gravar_votos(conexao, [_voto("2358548-89", deputada, 1)])

    pessoas_camara, _, _, _ = _montar_matriz(conexao, 57, "CAMARA")
    pessoas_senado, _, _, _ = _montar_matriz(conexao, 57, "SENADO")

    assert pessoas_camara == [deputada]
    assert pessoas_senado == []


# ═══════════════════════════════════════════════════════════════════
# RISCO: Achado #35 — "votou na legislatura corrente", não "tem voto"
# ═══════════════════════════════════════════════════════════════════


def _com_historico(conexao) -> tuple[int, int]:
    """Uma pessoa que só votou na 56ª e outra que votou na 57ª. Devolve (antiga, atual)."""
    persistencia.gravar_pessoas(
        conexao, [_pessoa("100", "Ex Deputado"), _pessoa("200", "Deputada Atual")]
    )
    antiga, atual = [
        linha[0] for linha in conexao.execute("SELECT id FROM pessoas ORDER BY id").fetchall()
    ]
    persistencia.gravar_votacoes(
        conexao,
        [
            {**_votacao("2200000-1"), "legislatura": 56, "data": "2021-05-04"},
            _votacao("2358548-89"),
        ],
    )
    persistencia.gravar_votos(
        conexao, [_voto("2200000-1", antiga, 1), _voto("2358548-89", atual, 1)]
    )
    return antiga, atual


def test_cpf_so_e_buscado_para_a_legislatura_corrente(conexao):
    """Com o histórico, "tem voto" incluiria milhares de ex-deputados."""
    _, atual = _com_historico(conexao)

    assert [p for _, p in persistencia.pessoas_sem_cpf(conexao)] == [atual]
    assert [p for _, p in persistencia.deputados_da_legislatura(conexao)] == [atual]


def test_desempate_nao_conta_voto_de_legislatura_antiga(conexao):
    """O homônimo de 2003 também tem voto — e desfaria o desempate da PL47."""
    _, atual = _com_historico(conexao)

    votantes = {
        linha[0]
        for linha in conexao.execute(
            "SELECT p.id FROM pessoas p WHERE " + persistencia.na_legislatura_corrente("p.id")
        )
    }

    assert votantes == {atual}


def test_legislatura_corrente_e_a_maior_da_base(conexao):
    """Antes da 57ª chegar, a 56ª É a corrente — não um número fixo."""
    persistencia.gravar_pessoas(conexao, [_pessoa("100", "Ex Deputado")])
    pessoa = conexao.execute("SELECT id FROM pessoas").fetchone()[0]
    persistencia.gravar_votacoes(
        conexao, [{**_votacao("2200000-1"), "legislatura": 56, "data": "2021-05-04"}]
    )
    persistencia.gravar_votos(conexao, [_voto("2200000-1", pessoa, 1)])

    assert [p for _, p in persistencia.deputados_da_legislatura(conexao)] == [pessoa]


def test_legislatura_com_pouco_dado_fica_sem_grafo(conexao, caplog):
    """Abaixo de `VOTACOES_MINIMAS_PARA_GRAFO` não se abre execução: a tela não a oferece."""
    from poligraph_etl.__main__ import VOTACOES_MINIMAS_PARA_GRAFO, _analisar

    antiga, atual = _com_historico(conexao)
    persistencia.gravar_votos(conexao, [_voto("2200000-1", atual, -1)])

    with caplog.at_level("WARNING", logger="poligraph"):
        _analisar(conexao, 56, "CAMARA")

    assert VOTACOES_MINIMAS_PARA_GRAFO > 1
    assert conexao.execute("SELECT count(*) FROM execucoes").fetchone()[0] == 0
    assert "SEM grafo" in caplog.text


def test_ceaps_casa_o_nome_so_com_senador_da_legislatura_da_despesa(conexao):
    """O senador de 2003 não pode receber a despesa do homônimo de 2023 (achado #35)."""
    persistencia.gravar_pessoas(
        conexao,
        [{**_pessoa("1", "Fulano"), "fonte": "SENADO"}, {**_pessoa("2", "Fulano"), "fonte": "SENADO"}],
    )
    antigo, atual = [l[0] for l in conexao.execute("SELECT id FROM pessoas ORDER BY id").fetchall()]
    persistencia.gravar_votacoes(
        conexao,
        [
            {**_votacao("SF-1"), "casa": "SENADO", "legislatura": 52, "data": "2004-05-04"},
            {**_votacao("SF-2"), "casa": "SENADO", "legislatura": 57, "data": "2024-05-04"},
        ],
    )
    persistencia.gravar_votos(conexao, [_voto("SF-1", antigo, 1), _voto("SF-2", atual, 1)])

    assert persistencia.senadores_por_nome(conexao, [52]) == {"FULANO": antigo}
    assert persistencia.senadores_por_nome(conexao, [57]) == {"FULANO": atual}


# ═══════════════════════════════════════════════════════════════════
# Achado #37 — apagar o que a fonte desmentiu
# ═══════════════════════════════════════════════════════════════════


def test_apagar_votacoes_leva_os_votos_junto(conexao):
    pessoa = _preparar_pessoa_e_votacao(conexao)
    persistencia.gravar_votacoes(conexao, [_votacao("SF-1483")])
    persistencia.gravar_votos(conexao, [_voto("SF-1483", pessoa, 1), _voto("2358548-89", pessoa, 1)])

    apagadas = persistencia.apagar_votacoes(conexao, ["SF-1483", "SF-9999"])

    assert apagadas == 1
    assert conexao.execute("SELECT count(*) FROM votos").fetchone()[0] == 1
    assert conexao.execute("SELECT count(*) FROM votacoes").fetchone()[0] == 1


def test_apagar_votacao_com_pergunta_recusa_tudo(conexao):
    """RISCO: A cascata levaria a pergunta do questionário junto, sem ninguém decidir."""
    _preparar_pessoa_e_votacao(conexao)
    persistencia.gravar_votacoes(conexao, [_votacao("SF-1483")])
    conexao.execute("INSERT INTO perguntas (id, votacao_id) VALUES ('q-teste', '2358548-89')")

    with pytest.raises(RuntimeError, match="2358548-89"):
        persistencia.apagar_votacoes(conexao, ["SF-1483", "2358548-89"])

    assert conexao.execute("SELECT count(*) FROM votacoes").fetchone()[0] == 2
