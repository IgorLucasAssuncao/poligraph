"""TRATAMENTO — do JSON do Senado para as linhas que vão ao banco.

## ENTRADA

| | |
|---|---|
| Vem de | `fontes/senado`, já baixado e conferido no volume |
| `votacao` | Array de votações, cada uma com `votos[]` aninhado |
| `senador/lista/atual` | 81 identificações, sem CPF |

## TRATAMENTO

0. Descarta a votação **fora de época** — registro antigo com data recente, ver
   `separar_fora_de_epoca`
1. Separa votação **aberta** de **secreta** pelo campo `votacaoSecreta`
2. Converte o voto para o domínio fechado `{-1, 0, 1, None}` — ver `normalizar_voto`
3. Descarta voto de senador fora do de-para, e o chamador registra a contagem
4. Deduz a legislatura pela data, como na Câmara

## SAÍDA

| | |
|---|---|
| Tabelas | `pessoas` · `pessoa_fonte_ids` · `votacoes` · `votos` |
| Chave de ligação | `CodigoParlamentar`, gravado com `fonte = 'SENADO'` |
| Constraint do banco | `ck_voto_valor` · `ck_votacao_categoria` |
| Idempotência | `ON CONFLICT (id) DO UPDATE` |

---

O mapeamento de voto do Senado **não é o da Câmara**, e reaproveitá-lo produziria número
errado sem erro. Na Câmara, `Sim`+`Não` são 99,3% dos registros; no Senado, 34%. O resto é
presença, ausência ou sigilo — e o valor mais frequente de todos, `Votou`, significa
*votação secreta, posição não revelada*.

Achados: [#4](../../../docs/achados/004-endpoint-do-senado-depreciado.md) ·
[#7](../../../docs/achados/007-casas-nao-sao-comparaveis.md) ·
[#17](../../../docs/achados/017-senado-maioria-secreta.md)
"""

from collections.abc import Container

from .ingestao import legislatura_da_data
from ..nucleo.normalizacao import classificar_categoria
from ..nucleo.tipos import TipoCasa

CASA = TipoCasa.SENADO

# O domínio do voto no Senado, medido em 10.368 registros de 2025.
#
# `Votou` é o valor MAIS COMUM e significa votação secreta: o Senado registra que o
# parlamentar votou, mas não como. Mapeá-lo para qualquer posição inventaria opinião —
# é o equivalente senatorial da inversão de polaridade, e igualmente invisível na tela.
#
# Tudo que não é posição vira None, que significa "fora do cálculo", nunca "discordou".
_VOTOS = {
    "sim": 1,
    "não": -1,
    "nao": -1,
    "abstenção": 0,
    "abstencao": 0,
    "votou": None,        # votação secreta — 3.774 de 10.368 em 2025
    "p-nrv": None,        # presente, não registrou voto
    "ap": None,           # ausência justificada
    "mis": None,          # em missão oficial
    "ls": None,           # licença saúde
    "lp": None,           # licença particular
    "ncom": None,         # não compareceu
    "na": None,           # não aplicável
    "lap": None,          # licença paternidade ou ao adotante
    # MEDIDO: Siglas das legislaturas anteriores (achado #35), com a descrição que a própria
    #    fonte publica. ATENÇÃO: `MERC` não entra: vem sem descrição, e fica no log.
    "rep": None,          # "Representação em solenidade internac./nac./reg." — 2003 a 2011
    "p-od": None,         # "Presente – Obstrução Declarada" — obstrução não é posição
    "obstrução": None,
    "obstrucao": None,
    "lg": None,           # "Licença à gestante" — 59 votos em 2020
    "la": None,           # "Licença à adotante" — 57 votos em 2006
}

# MEDIDO: Desde 2004, o `codigoSessaoVotacao` cresce com a data — medido em 2026-10-02, ano a
#    ano de 2004 a 2026: 2004 começa em 2523, 2014 termina em 5329, 2026 vai a 7105, sem
#    nenhum código fora da ordem. Antes de 2004 a numeração é outra (2003 vai de 21 a 2503).
#
# RISCO: O `/votacao` devolve votações de 1998 e 1999 com `dataSessao` de 2015 a 2017 (achado
#    #37): a matéria é de 1998, o informe da ata diz 1998, os votantes são Ramez Tebet e
#    ACM — e a data diz 2015-04-01. Pela data, elas caíam na 55ª legislatura e punham 89
#    senadores de outra época no grafo dela. O código denuncia: 947 a 1630, no meio de
#    anos em que a sequência estava acima de 5300.
PRIMEIRO_CODIGO_DE_2004 = 2523
_ANO_DA_NUMERACAO_ATUAL = 2004

# O presidente da sessão só vota em desempate — equivale ao "Artigo 17" da Câmara.
_PREFIXO_PRESIDENTE = "presidente"

# A presença de cada sigla — separada da POSIÇÃO de propósito: votar secreto ("Votou") e
# estar presente sem votar ("P-NRV") são presença sem posição. Só o Senado publica a
# justificativa da ausência; a Câmara não lista o ausente.
_PRESENCA = {
    "sim": "PRESENTE",
    "não": "PRESENTE",
    "nao": "PRESENTE",
    "abstenção": "PRESENTE",
    "abstencao": "PRESENTE",
    "votou": "PRESENTE",
    "p-nrv": "PRESENTE",
    "ap": "AUSENTE_JUSTIFICADO",
    "mis": "AUSENTE_JUSTIFICADO",
    "ls": "AUSENTE_JUSTIFICADO",
    "lp": "AUSENTE_JUSTIFICADO",
    "lap": "AUSENTE_JUSTIFICADO",
    "ncom": "AUSENTE",
    "na": None,
    "rep": "AUSENTE_JUSTIFICADO",
    "p-od": "PRESENTE",
    "obstrução": "PRESENTE",
    "obstrucao": "PRESENTE",
    "lg": "AUSENTE_JUSTIFICADO",
    "la": "AUSENTE_JUSTIFICADO",
}


def presenca_do_voto(bruto: str | None) -> str | None:
    """Se o senador estava na votação. `None` para sigla que não diz nada sobre isso.

    ATENÇÃO: Sigla desconhecida também vira `None`, não presente: contar um senador como presente
    por uma sigla que ninguém mediu inflaria a presença sem erro.
    """
    chave = (bruto or "").strip().lower()
    if chave.startswith(_PREFIXO_PRESIDENTE):
        return "PRESENTE"
    return _PRESENCA.get(chave)


def normalizar_voto(bruto: str | None) -> int | None:
    """Converte `siglaVotoParlamentar` para o domínio fechado `{-1, 0, 1, None}`.

    Valor desconhecido vira `None`, não exceção: o Senado já mudou o domínio uma vez, e
    derrubar a ingestão inteira por uma sigla nova seria pior que descartá-la. Quem
    precisa saber é `siglas_desconhecidas`, que o chamador registra no log.
    """
    chave = (bruto or "").strip().lower()

    if chave.startswith(_PREFIXO_PRESIDENTE):
        return None

    return _VOTOS.get(chave)


def eh_sigla_conhecida(bruto: str | None) -> bool:
    """Se a sigla está no domínio medido.

    Distingue *"conhecido e fora do cálculo"* de *"nunca visto"* — as duas viram `None`
    em `normalizar_voto`, e só a segunda é sinal de que a fonte mudou.
    """
    chave = (bruto or "").strip().lower()

    return chave in _VOTOS or chave.startswith(_PREFIXO_PRESIDENTE)


def siglas_desconhecidas(votacoes: list[dict]) -> dict[str, int]:
    """As siglas fora do domínio medido, com a contagem de cada uma."""
    achadas: dict[str, int] = {}

    for votacao in votacoes:
        for voto in votacao.get("votos") or []:
            sigla = (voto.get("siglaVotoParlamentar") or "").strip()
            if sigla and not eh_sigla_conhecida(sigla):
                achadas[sigla] = achadas.get(sigla, 0) + 1

    return achadas


def senadores_para_linhas(identificacoes: list[dict]) -> list[dict]:
    """Converte a lista de senadores em linhas de `pessoas`.

    `cpf_hash` sai nulo: o Senado não publica CPF. A ponte com a Câmara e com o TSE
    depende de outro caminho — ver achado #18.
    """
    linhas = []

    for identificacao in identificacoes:
        codigo = _texto(identificacao.get("CodigoParlamentar"))
        nome = _texto(identificacao.get("NomeParlamentar"))
        if not codigo or not nome:
            continue

        linhas.append(
            {
                "nome_civil": _texto(identificacao.get("NomeCompletoParlamentar")) or nome,
                "nome_exibicao": nome,
                "cpf_hash": None,
                "url_foto": foto_do_senador(codigo),
                "fonte": CASA,
                "id_externo": codigo,
                "metodo": "MANUAL",
                "confianca": 1.0,
            }
        )

    return linhas


def senadores_dos_votos(
    votacoes: list[dict], ja_conhecidos: Container[str] = ()
) -> list[dict]:
    """Os senadores que aparecem nos votos e não estão na lista de exercício.

    `/senador/lista/atual` devolve apenas os 81 em exercício hoje. Nos votos de 2023 a
    2026 aparecem 104 pessoas: a diferença são suplentes que devolveram a cadeira,
    licenciados e quem assumiu cargo no Executivo. Sem eles, 3.252 votos (10,5% da base)
    seriam descartados por não encontrar dono.

    O registro de voto traz nome, partido e UF, que basta para criar a pessoa. O nome
    civil fica igual ao de exibição: o voto não traz o nome completo.

    `ja_conhecidos` recebe os códigos que a lista de exercício já trouxe, e sem ele esta
    função REGRIDE o dado: `gravar_pessoas` faz `SET nome_civil = ...`, então os 81 que
    vieram com `NomeCompletoParlamentar` eram sobrescritos aqui pelo nome parlamentar.
    Ficaram 104 de 104 sem nome civil, e com isso sem chave para casar com o TSE.
    """
    vistos: dict[str, dict] = {}

    for votacao in votacoes:
        for voto in votacao.get("votos") or []:
            codigo = _texto(voto.get("codigoParlamentar"))
            nome = _texto(voto.get("nomeParlamentar"))
            if not codigo or not nome or codigo in vistos or codigo in ja_conhecidos:
                continue

            vistos[codigo] = {
                "nome_civil": nome,
                "nome_exibicao": nome,
                "cpf_hash": None,
                "url_foto": foto_do_senador(codigo),
                "fonte": CASA,
                "id_externo": codigo,
                "metodo": "MANUAL",
                "confianca": 1.0,
            }

    return list(vistos.values())


def descricoes_de_sigla(votacoes: list[dict]) -> dict[str, str]:
    """Sigla -> a descrição que a própria API traz em `descricaoVotoParlamentar`.

    Serve ao log de sigla nova: sem isto, diagnosticar `{'LAP': 1}` exigiria procurar o
    registro à mão. Com isto, o log já diz "licença paternidade ou ao adotante".
    """
    achadas: dict[str, str] = {}

    for votacao in votacoes:
        for voto in votacao.get("votos") or []:
            sigla = _texto(voto.get("siglaVotoParlamentar"))
            descricao = _texto(voto.get("descricaoVotoParlamentar"))
            if sigla and descricao:
                achadas.setdefault(sigla, descricao)

    return achadas


def separar_fora_de_epoca(votacoes: list[dict]) -> tuple[list[dict], list[dict]]:
    """Separa a votação cuja data contradiz o próprio código — ver `PRIMEIRO_CODIGO_DE_2004`.

    Devolve `(validas, fora)`. A de fora não é re-datada: a data verdadeira só se infere, e
    uma votação de 1998 cairia na 50ª legislatura, que a base não tem. O chamador registra
    a contagem e apaga a que uma carga anterior já tenha gravado.

    Sem código ou sem data, fica nas válidas: `votacoes_para_linhas` já a descarta.
    """
    validas, fora = [], []

    for votacao in votacoes:
        codigo = _texto(votacao.get("codigoSessaoVotacao"))
        data = _data(votacao)

        if not codigo.isdigit() or not data:
            validas.append(votacao)
            continue

        numeracao_atual = int(codigo) >= PRIMEIRO_CODIGO_DE_2004
        data_atual = int(data[:4]) >= _ANO_DA_NUMERACAO_ATUAL
        (validas if numeracao_atual == data_atual else fora).append(votacao)

    return validas, fora


def id_da_votacao(votacao: dict) -> str:
    """`SF-` + o código: o prefixo evita colisão com o id da Câmara na mesma tabela."""
    return f"SF-{_texto(votacao.get('codigoSessaoVotacao'))}"


def votacoes_para_linhas(votacoes: list[dict]) -> list[dict]:
    """Converte em linhas de `votacoes`, secretas incluídas.

    A votação secreta **entra na tabela** e sai da matriz: descartá-la aqui apagaria a
    evidência do achado #17, que é justamente quanto do Senado não é analisável. Quem
    filtra é a montagem da matriz, pelo campo `secreta`.

    Contados do array de votos, não lidos do campo: o Senado devolve
    `totalVotosSim` e `totalVotosNao` como NULL em todas as votações
    medidas. Sem contar, o painel do questionário — que é a assinatura
    visual do site — renderizaria vazio para toda pergunta do Senado.
    """
    linhas = []

    for votacao in votacoes:
        codigo = _texto(votacao.get("codigoSessaoVotacao"))
        data = _data(votacao)
        if not codigo or not data:
            continue

        descricao = _texto(votacao.get("descricaoVotacao")) or _texto(
            votacao.get("ementa")
        )

        linhas.append(
            {
                "id": id_da_votacao(votacao),
                "casa": CASA,
                "legislatura": legislatura_da_data(data),
                "data": data,
                "orgao": _texto(votacao.get("siglaCasaSessao")) or CASA,
                "descricao": descricao or None,
                "proposicao_id": None,
                "categoria": classificar_categoria(descricao),
                "secreta": _texto(votacao.get("votacaoSecreta")).upper() == "S",
                "plenario": True,
                "votos_sim": _contar(votacao, 1),
                "votos_nao": _contar(votacao, -1),
            }
        )

    return linhas


def votos_para_linhas(
    votacoes: list[dict], mapa_pessoas: dict[str, int]
) -> list[dict]:
    """Converte os votos aninhados em linhas de `votos`.

    O partido e a UF são gravados **como estavam no momento do voto**: trocar de partido
    é comum, e guardar só a filiação atual reescreveria o passado.

    ATENÇÃO: Vazio, não None: as colunas são NOT NULL, como na Câmara. Na 57ª
    nunca faltava; em 2002 vem ausência sem UF (achado #35), e o
    banco recusava a carga inteira do ano.
    """
    linhas = []

    for votacao in votacoes:
        codigo = _texto(votacao.get("codigoSessaoVotacao"))
        if not codigo:
            continue

        for voto in votacao.get("votos") or []:
            pessoa_id = mapa_pessoas.get(_texto(voto.get("codigoParlamentar")))
            if pessoa_id is None:
                continue

            linhas.append(
                {
                    "votacao_id": f"SF-{codigo}",
                    "pessoa_id": pessoa_id,
                    "valor": normalizar_voto(voto.get("siglaVotoParlamentar")),
                    "presenca": presenca_do_voto(voto.get("siglaVotoParlamentar")),
                    "partido_no_voto": _texto(voto.get("siglaPartidoParlamentar")),
                    "uf_no_voto": _texto(voto.get("siglaUFParlamentar")),
                }
            )

    return linhas


# ═══════════════════════════════════════════════════════════════════


def _contar(votacao: dict, valor: int) -> int:
    """Quantos votaram naquele sentido.

    Em votação secreta o resultado é zero, e é correto: ninguém revelou posição.
    """
    return sum(
        1
        for voto in votacao.get("votos") or []
        if normalizar_voto(voto.get("siglaVotoParlamentar")) == valor
    )


def _data(votacao: dict) -> str:
    """A data da sessão, em `YYYY-MM-DD`.

    O Senado usa nomes diferentes conforme o recurso, e alguns trazem hora junto.
    """
    for campo in ("dataSessao", "data", "dataHoraInicio"):
        valor = _texto(votacao.get(campo))
        if len(valor) >= 10:
            return valor[:10]

    return ""


def _texto(valor) -> str:
    """Tudo passa por aqui: os campos do Senado não vêm higienizados."""
    return "" if valor is None else str(valor).strip()


def foto_do_senador(codigo: str) -> str:
    """A foto oficial pelo código do senador, no endereço FINAL.

    MEDIDO: Medido em 2026-10-01: `UrlFotoParlamentar` aponta para
    `www.senado.leg.br/senadores/img/fotos-oficiais/senador{codigo}.jpg`, que responde
    **301** para este endereço com `Cache-Control: private` — uma requisição a mais por
    foto, em toda visita. O destino responde direto, com CORS e `max-age=600`.

    DECISÃO: E vale para todo código: só a lista de exercício trazia foto, e 375 dos 458
    senadores da base (os que vieram pelo voto) ficavam sem rosto.

    ATENÇÃO: Já é HTTPS: a URL antiga vinha em `http://`, conteúdo misto que o navegador
    bloqueava sem erro visível.
    """
    return f"https://legis.senado.leg.br/senadores/fotos-oficiais/{codigo}"

