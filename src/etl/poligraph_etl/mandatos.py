"""Os eleitos de cada eleição, do cadastro de candidatos do TSE (Pendência 90).

| Arquivo lido | `consulta_cand/consulta_cand_{ano}.zip`, o `BRASIL` quando existe |
|---|---|
| Quem entra | Só os eleitos (`ELEITOS`, por igualdade exata), nos cargos de `TipoCargo` |
| Identidade | `cpf_hash` ou `titulo_hash`, HMAC com a mesma chave |

RISCO: o TSE não publica o CPF em 2024 (todo o arquivo vem com `-4`, MEDIDO em 2026-10-21). O título de
eleitor vem em todos os anos e liga o eleito de 2024 à mesma pessoa de 2020 e de 2016.

DECISÃO: quem já está na base ganha o mandato sem pessoa nova. Deputado federal e senador sem pessoa na
base NÃO criam pessoa: o parlamentar nasce da Câmara e do Senado, e criar pelo TSE faria
dois registros da mesma pessoa quando o CPF dela ainda não foi completado.

O município: o TSE tem código próprio (`SG_UE`), que não é o do IBGE. A ponte é o nome e a UF contra
`municipios` (Receita). MEDIDO em 2026-10-21: 5.554 dos 5.569 municípios com prefeito em 2024 casam
pelo nome exato; os outros diferem na grafia (Assú e Açu, Camacã e Camacan) e casam pelo nome mais
parecido da mesma UF. O que não casar fica sem código do IBGE e o comando lista.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher

from . import normalizacao
from .contratos.banco import Mandato
from .contratos.tse import LinhaDeCandidatura, LinhaDeVotacao
from .tipos import (
    CARGOS_DO_CONGRESSO, CARGOS_MUNICIPAIS, CARGOS_NACIONAIS, ELEITOS, TITULAR_DO_VICE, TipoCargo, TipoSituacaoNoTurno, TipoCasa, TipoSexo,
    anos_do_mandato, cargo_do_tse, data_plausivel, sexo_do_tse, situacao_do_tse,
)

RECURSO = "consulta_cand/consulta_cand_{ano}.zip"
RECURSO_DA_VOTACAO = "votacao_candidato_munzona/votacao_candidato_munzona_{ano}.zip"

SEMELHANCA_MINIMA = 0.85
"""Abaixo disto o nome do TSE não é dado como o mesmo município. MEDIDO em 2026-10-21: a pior grafia
legítima dos 15 de 2024 (Graccho e Gracho Cardoso) fica acima de 0,9."""


@dataclass(frozen=True)
class Eleito:
    """Um eleito, já traduzido: o CPF virou hash e os códigos do TSE viraram enum."""

    ano_eleicao: int
    sq_candidato: str
    cargo: TipoCargo
    uf: str | None
    codigo_ue: str | None
    nome_ue: str | None
    nome: str
    nome_de_urna: str
    cpf_hash: str | None
    titulo_hash: str | None
    nascimento: date | None
    sexo: TipoSexo | None
    partido: str
    coligacao: str | None = None


def eleitos(linhas: list[LinhaDeCandidatura], eleitos_pelos_votos: frozenset[str] = frozenset()) -> list[Eleito]:
    """Os eleitos nos cargos do escopo, um por candidatura.

    `eleitos_pelos_votos` são os `SQ_CANDIDATO` de presidente que a fonte não marca como eleitos e os votos
    elegem (`presidente_pelos_votos`); a linha deles conta como `ELEITO`.

    ATENÇÃO: no segundo turno o eleito aparece duas vezes, `2º TURNO` na linha do primeiro e `ELEITO` na do
    segundo; fica a de eleito.

    RISCO: até 2010 (prefeito e governador, até 2012 e 2014) o TSE publica o vice com situação `#NULO#`.
    O vice da chapa eleita é o que divide com o titular eleito, na mesma eleição e na mesma UE, o número
    de candidato ou a coligação (`SQ_COLIGACAO`). MEDIDO em 2026-10-22: de 2002 em diante o vice tem o
    número do titular; em 1998 e 2000, outro número e a mesma coligação. Numa coligação há um titular
    só por UE, então a coligação também identifica a chapa. As colunas estão em todos os anos.
    Só o vice sem resultado (`#NULO#`) entra assim: o substituído ou com registro negado da mesma chapa
    não foi eleito (MEDIDO: sem essa trava, 2012 teria 6.003 vice-prefeitos para 5.665 prefeitos). E só
    quando o ente ainda não tem vice eleito e a chapa aponta um candidato só: na dúvida, fica fora.
    """
    titulares: dict[tuple, tuple] = {}
    vices: list[tuple[LinhaDeCandidatura, TipoCargo]] = []
    vistos: dict[tuple, Eleito] = {}
    for linha in linhas:
        cargo = cargo_do_tse(linha.cargo)
        if cargo is None:
            continue
        situacao = situacao_do_tse(linha.situacao)
        if cargo is TipoCargo.PRESIDENTE and linha.sq_candidato in eleitos_pelos_votos:
            situacao = TipoSituacaoNoTurno.ELEITO
        if cargo in TITULAR_DO_VICE and situacao is TipoSituacaoNoTurno.SEM_RESULTADO:
            vices.append((linha, cargo))
            continue
        if situacao not in ELEITOS:
            continue
        eleito = _eleito(linha, cargo)
        vistos[candidatura(eleito)] = eleito
        if cargo in TITULAR_DO_VICE.values():
            for chave in _chapas(linha, cargo):
                titulares[chave] = candidatura(eleito)
    com_vice_eleito = {
        (e.ano_eleicao, e.uf if e.cargo is not TipoCargo.VICE_PREFEITO else e.codigo_ue, TITULAR_DO_VICE[e.cargo])
        for e in vistos.values() if e.cargo in TITULAR_DO_VICE
    }
    por_titular: dict[tuple, list[tuple[LinhaDeCandidatura, TipoCargo]]] = {}
    for linha, cargo in vices:
        chave = next((c for c in _chapas(linha, TITULAR_DO_VICE[cargo]) if c in titulares), None)
        if chave is not None:
            por_titular.setdefault(titulares[chave], []).append((linha, cargo))
    for titular, candidatos in por_titular.items():
        linha, cargo = candidatos[0]
        eleito = _eleito(linha, cargo)
        ja_tem = (eleito.ano_eleicao, eleito.uf if cargo is not TipoCargo.VICE_PREFEITO else eleito.codigo_ue, TITULAR_DO_VICE[cargo])
        if len({c[0].sq_candidato for c in candidatos}) == 1 and ja_tem not in com_vice_eleito:
            vistos.setdefault(candidatura(eleito), eleito)
    return list(vistos.values())


def _chapas(linha: LinhaDeCandidatura, cargo_do_titular: TipoCargo) -> list[tuple]:
    """As chaves da chapa: eleição, UE e cargo do titular, com o número de candidato ou com a coligação."""
    base = (linha.ano_eleicao, linha.codigo_ue, cargo_do_titular)
    chaves = [(*base, "numero", linha.numero)]
    if linha.sq_coligacao and not linha.sq_coligacao.startswith("-"):
        chaves.append((*base, "coligacao", linha.sq_coligacao))
    return chaves


def _eleito(linha: LinhaDeCandidatura, cargo: TipoCargo) -> Eleito:
    municipal = cargo in CARGOS_MUNICIPAIS
    coligacao = (linha.coligacao or "").strip()
    return Eleito(
        ano_eleicao=int(linha.ano_eleicao or 0),
        sq_candidato=linha.sq_candidato or "",
        cargo=cargo,
        uf=None if cargo in CARGOS_NACIONAIS else linha.uf,
        codigo_ue=linha.codigo_ue if municipal else None,
        nome_ue=linha.nome_ue if municipal else None,
        nome=linha.nome or "",
        nome_de_urna=linha.nome_de_urna or linha.nome or "",
        cpf_hash=normalizacao.hash_de_cpf(linha.cpf),
        titulo_hash=normalizacao.hash_de_titulo(linha.titulo),
        nascimento=data_plausivel(_data(linha.nascimento), int(linha.ano_eleicao or 0) - 16),
        sexo=sexo_do_tse(linha.genero),
        partido=linha.partido or "",
        coligacao=None if coligacao.startswith("#") or not coligacao else coligacao,
    )


def candidatura(eleito: Eleito) -> tuple[int, str | None, str | None, str, str]:
    """A chave da candidatura: ano, UF, município, cargo e `SQ_CANDIDATO`.

    RISCO: até 2008 o TSE numera o `SQ_CANDIDATO` dentro de cada município e de cada UF, não no país.
    MEDIDO em 2026-10-21: em 2000 os 5.585 prefeitos e vices eleitos dividem 595 números; em 2012, 11.356
    dividem 11.352. Sem a UF e o município, um prefeito apagava o de outra cidade.
    """
    return eleito.ano_eleicao, eleito.uf, eleito.codigo_ue, eleito.cargo.value, eleito.sq_candidato


GRAFIAS_DO_TSE = {("ASSU", "RN"): "ACU"}
"""O nome do município no TSE → o do IBGE, quando os dois escrevem a mesma cidade de outro jeito e a semelhança não
alcança. MEDIDO em 2026-10-24: "ASSÚ" no TSE e "Açu" no IBGE (semelhança de 0,57), a única de 2000 a 2024."""


def ponte_de_municipios(eleitos_municipais: list[Eleito], municipios: list[tuple[str, str, str]]) -> dict[str, str | None]:
    """`SG_UE` do TSE → código do IBGE, pelo nome e pela UF. `municipios` é (ibge, nome, uf).

    O nome exato primeiro; depois o mais parecido da mesma UF, se for o único acima de `SEMELHANCA_MINIMA`.

    RISCO: o município muda de nome e o código do TSE fica (Embu virou Embu das Artes; Parati, Paraty). A ponte tenta a
    eleição mais recente primeiro e só dá o código por resolvido quando acha o par. MEDIDO em 2026-10-24: antes ela usava
    o nome da primeira eleição da lista, a de 2000, e cerca de 105 prefeitos e vices por eleição ficavam sem cidade.
    """
    por_nome = {(_nome(nome), uf): ibge for ibge, nome, uf in municipios}
    por_uf: dict[str, list[tuple[str, str]]] = {}
    for ibge, nome, uf in municipios:
        por_uf.setdefault(uf, []).append((_nome(nome), ibge))

    ponte: dict[str, str | None] = {}
    for eleito in sorted(eleitos_municipais, key=lambda e: e.ano_eleicao, reverse=True):
        if ponte.get(eleito.codigo_ue or ""):
            continue
        nome = _nome(eleito.nome_ue)
        nome = GRAFIAS_DO_TSE.get((nome, eleito.uf or ""), nome)
        ibge = por_nome.get((nome, eleito.uf))
        if ibge is None:
            ibge = _mais_parecido(nome, por_uf.get(eleito.uf or "", []))
        ponte[eleito.codigo_ue or ""] = ibge
    return ponte


@dataclass
class Identidades:
    """Onde achar a pessoa de um eleito: pelo CPF, pelo título ou pela candidatura já gravada."""

    por_cpf: dict[str, int]
    por_titulo: dict[str, int]
    por_candidatura: dict[tuple, int]
    por_casa: dict[str, dict[str, int]]

    def pessoa(self, eleito: Eleito) -> int | None:
        """O mandato de senador vai para a pessoa do Senado; os outros, para a da Câmara, quando há as duas."""
        casas = self.por_casa.get(eleito.cpf_hash or "", {})
        if casas:
            preferida = TipoCasa.SENADO if eleito.cargo is TipoCargo.SENADOR else TipoCasa.CAMARA
            return casas.get(preferida) or next(iter(casas.values()))
        return (self.por_cpf.get(eleito.cpf_hash or "")
                or self.por_titulo.get(eleito.titulo_hash or "")
                or self.por_candidatura.get(candidatura(eleito)))

    def propagar(self, eleitos_de_todas: list[Eleito]) -> None:
        """Quem já tem pessoa empresta o CPF e o título dele aos outros eleitos, até não sobrar ligação nova.

        RISCO: sem isto, o prefeito de 2020 achado pelo CPF e o de 2024, que só traz o título, viravam duas
        pessoas quando o título ainda não estava gravado. MEDIDO em 2026-10-21: 5.574 pessoas duplicadas
        depois de a coluna `titulo_hash` ser recriada vazia.
        """
        mudou = True
        while mudou:
            mudou = False
            for eleito in eleitos_de_todas:
                pessoa = self.pessoa(eleito)
                if pessoa is None:
                    continue
                antes = (len(self.por_cpf), len(self.por_titulo))
                self.guardar(eleito, pessoa)
                mudou = mudou or antes != (len(self.por_cpf), len(self.por_titulo))

    def guardar(self, eleito: Eleito, pessoa: int) -> None:
        if eleito.cpf_hash:
            self.por_cpf.setdefault(eleito.cpf_hash, pessoa)
        if eleito.titulo_hash:
            self.por_titulo.setdefault(eleito.titulo_hash, pessoa)


def mandatos_para_linhas(eleitos_da_eleicao: list[Eleito], identidades: Identidades, ponte: dict[str, str | None]) -> list[Mandato]:
    """Os mandatos de quem tem pessoa na base."""
    linhas = []
    for eleito in eleitos_da_eleicao:
        pessoa = identidades.pessoa(eleito)
        if pessoa is None:
            continue
        primeiro, ultimo = anos_do_mandato(eleito.cargo, eleito.ano_eleicao)
        linhas.append(Mandato(
            pessoa_id=pessoa,
            cargo=eleito.cargo.value,
            ano_eleicao=eleito.ano_eleicao,
            sq_candidato=eleito.sq_candidato,
            primeiro_ano=primeiro,
            ultimo_ano=ultimo,
            uf=eleito.uf,
            codigo_municipio_tse=eleito.codigo_ue,
            codigo_municipio_ibge=ponte.get(eleito.codigo_ue) if eleito.codigo_ue else None,
            partido=eleito.partido,
            nome_de_urna=eleito.nome_de_urna,
            coligacao=eleito.coligacao,
        ))
    return linhas


def pessoas_novas(eleitos_de_todas: list[Eleito], identidades: Identidades, ano_atual: int) -> list[list[Eleito]]:
    """Os grupos de eleitos que precisam de pessoa nova, um grupo por pessoa.

    Fica fora quem já tem pessoa e quem não traz CPF nem título. Dois eleitos são a mesma pessoa quando dividem
    o CPF ou o título: o de 2020 tem os dois, o de 2024 só o título.

    DECISÃO (2026-10-23): o eleito para o Congresso ganha pessoa só antes da posse, para ter perfil desde a eleição.
    Na posse, a Câmara ou o Senado cria a dela, o `cpf` grava o hash e a fusão junta as duas (`pares_do_mesmo_cpf`).

    RISCO: o eleito antigo fica fora. MEDIDO em 2026-10-23: 5.683 das 7.889 pessoas da Câmara não têm `cpf_hash`, a
    história da casa de antes da base de votos; o deputado de 1998 criado pelo TSE seria uma segunda pessoa que
    nenhuma fusão junta.
    """
    grupo_de: dict[str, int] = {}
    grupos: list[list[Eleito]] = []
    for eleito in sorted(eleitos_de_todas, key=lambda e: e.ano_eleicao):
        chaves = _chaves(eleito)
        antes_da_posse = anos_do_mandato(eleito.cargo, eleito.ano_eleicao)[0] > ano_atual
        if (eleito.cargo in CARGOS_DO_CONGRESSO and not antes_da_posse) or not chaves or identidades.pessoa(eleito) is not None:
            continue
        existentes = sorted({grupo_de[c] for c in chaves if c in grupo_de})
        if existentes:
            destino = existentes[0]
            for outro in existentes[1:]:
                grupos[destino].extend(grupos[outro])
                for eleito_movido in grupos[outro]:
                    for c in _chaves(eleito_movido):
                        grupo_de[c] = destino
                grupos[outro] = []
        else:
            destino = len(grupos)
            grupos.append([])
        grupos[destino].append(eleito)
        for c in chaves:
            grupo_de[c] = destino
    return [g for g in grupos if g]


def _chaves(eleito: Eleito) -> list[str]:
    return [c for c in (f"cpf:{eleito.cpf_hash}" if eleito.cpf_hash else "", f"titulo:{eleito.titulo_hash}" if eleito.titulo_hash else "") if c]


def _nome(texto: str | None) -> str:
    """Nome de município comparável: sem acento, em maiúsculas, apóstrofo e hífen como espaço."""
    return normalizacao.sem_acento_maiusculo((texto or "").replace("'", " ").replace("-", " "))


def _mais_parecido(nome: str, candidatos: list[tuple[str, str]]) -> str | None:
    notas = sorted(((SequenceMatcher(None, nome, outro).ratio(), ibge) for outro, ibge in candidatos), reverse=True)
    if not notas or notas[0][0] < SEMELHANCA_MINIMA:
        return None
    if len(notas) > 1 and notas[1][0] >= SEMELHANCA_MINIMA:
        return None
    return notas[0][1]


def _data(texto: str | None) -> date | None:
    """`DT_NASCIMENTO` vem como dd/mm/aaaa; vazio ou inválido vira `None`."""
    partes = (texto or "").split("/")
    if len(partes) != 3 or not all(p.isdigit() for p in partes):
        return None
    try:
        return date(int(partes[2]), int(partes[1]), int(partes[0]))
    except ValueError:
        return None


def presidente_pelos_votos(linhas: Iterable[LinhaDeVotacao]) -> str | None:
    """O `SQ_CANDIDATO` do presidente eleito pelos votos: o mais votado no último turno (Constituição, art. 77).

    RISCO: em 2006 o TSE não marca o eleito em nenhum dos dois arquivos. No cadastro de candidatos as 8 candidaturas a
    presidente vêm `#NULO#` e o 2º turno não aparece; no de votação, o 2º turno vem `#NULO`. Os votos estão lá e batem com o
    resultado oficial (MEDIDO em 2026-10-24: Lula 58.295.042, Alckmin 37.543.178). A regra é a da Constituição, escrita
    aqui, e só entra quando o cadastro não traz presidente eleito.

    RISCO: com só o 1º turno apurado e ninguém com mais da metade dos votos, não há eleito: devolve `None`. Sem a trava, a
    carga de 2026 antes do 2º turno elegeria o mais votado do 1º (aconteceu em 2026-10-24, parada antes de gravar).
    """
    por_turno: dict[int, dict[str, int]] = {}
    for linha in linhas:
        if cargo_do_tse(linha.cargo) is not TipoCargo.PRESIDENTE or not linha.sq_candidato:
            continue
        votos = por_turno.setdefault(int(linha.turno or 0), {})
        votos[linha.sq_candidato] = votos.get(linha.sq_candidato, 0) + int(linha.votos or 0)
    if not por_turno:
        return None
    turno = max(por_turno)
    ultimo = por_turno[turno]
    mais_votado = max(ultimo, key=lambda sq: ultimo[sq])
    if turno == 1 and ultimo[mais_votado] * 2 <= sum(ultimo.values()):
        return None
    return mais_votado


@dataclass(frozen=True)
class SenadorNaBase:
    """Quem votou no Senado: a pessoa, o nome parlamentar, a UF do voto e os anos em que votou por ela."""

    pessoa_id: int
    nome: str
    uf: str
    primeiro_ano: int
    ultimo_ano: int


def senadores_pelo_voto(eleitos_sem_pessoa: list[Eleito], senadores: list[SenadorNaBase]) -> dict[tuple, int]:
    """Candidatura de senador eleito → a pessoa do Senado, para quem o CPF não liga.

    RISCO: o Senado não publica CPF, e o nome civil da base é o nome parlamentar ("Alvaro Dias", "Pedro Simon"): o
    `cpf` não casa ninguém de antes de 2010. MEDIDO em 2026-10-24: 56 senadores eleitos de 1998 a 2014 ficavam sem mandato.

    DECISÃO: casa quando o senador votou pela mesma UF durante o mandato e todas as palavras do nome parlamentar estão no
    nome civil ou no de urna do TSE. Mais de um candidato é ambiguidade, e fica de fora. MEDIDO em 2026-10-24: 55 de 56
    casam com um só; o outro (Luiz Estevão, cassado em 2000) não tem voto na base.
    """
    ligados: dict[tuple, int] = {}
    for eleito in eleitos_sem_pessoa:
        if eleito.cargo is not TipoCargo.SENADOR:
            continue
        primeiro, ultimo = anos_do_mandato(eleito.cargo, eleito.ano_eleicao)
        do_tse = _palavras(eleito.nome) | _palavras(eleito.nome_de_urna)
        achados = {
            s.pessoa_id
            for s in senadores
            if s.uf == eleito.uf and s.primeiro_ano <= ultimo and s.ultimo_ano >= primeiro
            and _palavras(s.nome) and _palavras(s.nome) <= do_tse
        }
        if len(achados) == 1:
            ligados[candidatura(eleito)] = achados.pop()
    return ligados


def _palavras(nome: str | None) -> set[str]:
    """As palavras de um nome que identificam: sem acento, sem ponto e sem as de duas letras ("de", "da", "do")."""
    return {p for p in normalizacao.sem_acento_maiusculo((nome or "").replace(".", " ")).split() if len(p) > 2}
