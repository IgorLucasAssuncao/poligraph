"""Contratos de entrada do TSE."""

from dataclasses import dataclass

from .entrada import coluna


@dataclass(frozen=True)
class LinhaDeCandidatura:
    """Uma candidatura: `consulta_cand/consulta_cand_{ano}.zip`, um CSV por UF e às vezes um `BRASIL`.

    CSV com ponto e vírgula, latin-1. O mesmo layout de 2010 a 2024 (MEDIDO em 2026-10-21).

    RISCO: `cpf` e `titulo` chegam em claro e viram hash na transformação; nunca são gravados (LGPD).
    """

    ano_eleicao: str | None = coluna("ANO_ELEICAO")
    sq_candidato: str | None = coluna("SQ_CANDIDATO")
    cargo: str | None = coluna("CD_CARGO")
    situacao: str | None = coluna("DS_SIT_TOT_TURNO")
    uf: str | None = coluna("SG_UF")
    codigo_ue: str | None = coluna("SG_UE")
    nome_ue: str | None = coluna("NM_UE")
    nome: str | None = coluna("NM_CANDIDATO")
    nome_de_urna: str | None = coluna("NM_URNA_CANDIDATO")
    cpf: str | None = coluna("NR_CPF_CANDIDATO")
    titulo: str | None = coluna("NR_TITULO_ELEITORAL_CANDIDATO")
    nascimento: str | None = coluna("DT_NASCIMENTO")
    genero: str | None = coluna("CD_GENERO")
    partido: str | None = coluna("SG_PARTIDO")
