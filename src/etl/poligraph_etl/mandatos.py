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

from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher

from . import normalizacao
from .contratos.banco import Mandato
from .contratos.tse import LinhaDeCandidatura
from .tipos import (
    CARGOS_DO_CONGRESSO, CARGOS_MUNICIPAIS, CARGOS_NACIONAIS, ELEITOS, TipoCargo, TipoCasa, TipoSexo,
    anos_do_mandato, cargo_do_tse, sexo_do_tse, situacao_do_tse,
)

RECURSO = "consulta_cand/consulta_cand_{ano}.zip"

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


def eleitos(linhas: list[LinhaDeCandidatura]) -> list[Eleito]:
    """Os eleitos nos cargos do escopo, um por candidatura.

    ATENÇÃO: no segundo turno o eleito aparece duas vezes, `2º TURNO` na linha do primeiro e `ELEITO` na do
    segundo; fica a de eleito.
    """
    vistos: dict[tuple, Eleito] = {}
    for linha in linhas:
        cargo = cargo_do_tse(linha.cargo)
        if cargo is None or situacao_do_tse(linha.situacao) not in ELEITOS:
            continue
        municipal = cargo in CARGOS_MUNICIPAIS
        eleito = Eleito(
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
            nascimento=_data(linha.nascimento),
            sexo=sexo_do_tse(linha.genero),
            partido=linha.partido or "",
        )
        vistos[candidatura(eleito)] = eleito
    return list(vistos.values())


def candidatura(eleito: Eleito) -> tuple[int, str | None, str | None, str, str]:
    """A chave da candidatura: ano, UF, município, cargo e `SQ_CANDIDATO`.

    RISCO: até 2008 o TSE numera o `SQ_CANDIDATO` dentro de cada município e de cada UF, não no país.
    MEDIDO em 2026-10-21: em 2000 os 5.585 prefeitos e vices eleitos dividem 595 números; em 2012, 11.356
    dividem 11.352. Sem a UF e o município, um prefeito apagava o de outra cidade.
    """
    return eleito.ano_eleicao, eleito.uf, eleito.codigo_ue, eleito.cargo.value, eleito.sq_candidato


def ponte_de_municipios(eleitos_municipais: list[Eleito], municipios: list[tuple[str, str, str]]) -> dict[str, str | None]:
    """`SG_UE` do TSE → código do IBGE, pelo nome e pela UF. `municipios` é (ibge, nome, uf).

    O nome exato primeiro; depois o mais parecido da mesma UF, se for o único acima de `SEMELHANCA_MINIMA`.
    """
    por_nome = {(_nome(nome), uf): ibge for ibge, nome, uf in municipios}
    por_uf: dict[str, list[tuple[str, str]]] = {}
    for ibge, nome, uf in municipios:
        por_uf.setdefault(uf, []).append((_nome(nome), ibge))

    ponte: dict[str, str | None] = {}
    for eleito in eleitos_municipais:
        if eleito.codigo_ue in ponte:
            continue
        nome = _nome(eleito.nome_ue)
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
        ))
    return linhas


def pessoas_novas(eleitos_de_todas: list[Eleito], identidades: Identidades) -> list[list[Eleito]]:
    """Os grupos de eleitos que precisam de pessoa nova, um grupo por pessoa.

    Fica fora quem já tem pessoa, quem é do Congresso e quem não traz CPF nem título. Dois eleitos são
    a mesma pessoa quando dividem o CPF ou o título: o de 2020 tem os dois, o de 2024 só o título.
    """
    grupo_de: dict[str, int] = {}
    grupos: list[list[Eleito]] = []
    for eleito in sorted(eleitos_de_todas, key=lambda e: e.ano_eleicao):
        chaves = _chaves(eleito)
        if eleito.cargo in CARGOS_DO_CONGRESSO or not chaves or identidades.pessoa(eleito) is not None:
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
