"""Contratos de entrada do Portal da Transparência."""

from dataclasses import dataclass

from .entrada import coluna


@dataclass(frozen=True)
class LinhaDoCartaoDaDefesaCivil:
    """Uma transação do Cartão de Pagamento da Defesa Civil: `download-de-dados/cpdc/AAAAMM`.

    CSV com ponto e vírgula, latin-1, decimal com vírgula, dentro de um ZIP com `AAAAMM_CPDC.csv`.
    O executor vem como `"ASSIS BRASIL / AC"` ou `"GOVERNO DO ESTADO / RS"`.

    RISCO: o arquivo traz o CPF do portador (mascarado) e o CPF ou CNPJ do favorecido. Nenhum
    dos dois está aqui, e por isso nenhum dos dois é lido.
    """

    ano_do_extrato: str | None = coluna("ANO EXTRATO")
    mes_do_extrato: str | None = coluna("MÊS EXTRATO")
    executor: str | None = coluna("EXECUTOR DESPESA")
    cnpj_do_convenente: str | None = coluna("CÓDIGO CONVENENTE")
    valor: str | None = coluna("VALOR TRANSAÇÃO")


@dataclass(frozen=True)
class LinhaDePagamentoDeViagem:
    """Um pagamento de viagem a serviço: `download-de-dados/viagens/AAAA`, membro `AAAA_Pagamento.csv`.

    ATENÇÃO: parte das linhas vem com o tipo sem os acentos e sem a letra acentuada (`DIRIAS`,
    `RESTITUIO`). O tipo é reconhecido pelo começo da palavra em `viagens.tipo_do_pagamento`.
    """

    orgao_superior: str | None = coluna("Nome do órgão superior")
    tipo: str | None = coluna("Tipo de pagamento")
    valor: str | None = coluna("Valor")


@dataclass(frozen=True)
class LinhaDeViagem:
    """Uma viagem a serviço: membro `AAAA_Viagem.csv`.

    RISCO: o arquivo traz nome, CPF mascarado, cargo e motivo de cada viajante. Nenhum está aqui:
    a tela mostra o órgão, não a pessoa.
    """

    orgao_superior: str | None = coluna("Nome do órgão superior")
    situacao: str | None = coluna("Situação")
    urgente: str | None = coluna("Viagem Urgente")


@dataclass(frozen=True)
class LinhaDeTrechoDeViagem:
    """Um trecho de viagem: membro `AAAA_Trecho.csv`. A UF vem por extenso; fora do Brasil, vazia."""

    pais_de_destino: str | None = coluna("Destino - País")
    uf_de_destino: str | None = coluna("Destino - UF")
    cidade_de_destino: str | None = coluna("Destino - Cidade")
    numero_de_diarias: str | None = coluna("Número Diárias")
