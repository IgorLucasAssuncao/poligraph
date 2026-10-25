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

    identificador: str | None = coluna("Identificador do processo de viagem")
    orgao_superior: str | None = coluna("Nome do órgão superior")
    tipo: str | None = coluna("Tipo de pagamento")
    valor: str | None = coluna("Valor")


NOME_SIGILOSO = "Sigiloso"
"""O que o Portal escreve no nome do contratado, do portador do cartão e do órgão da viagem protegidos por sigilo."""


@dataclass(frozen=True)
class LinhaDeViagem:
    """Uma viagem a serviço: membro `AAAA_Viagem.csv`.

    RISCO: o arquivo traz nome, CPF mascarado, cargo e motivo de cada viajante. Nenhum está aqui:
    a tela mostra o órgão, não a pessoa.
    """

    identificador: str | None = coluna("Identificador do processo de viagem")
    orgao_superior: str | None = coluna("Nome do órgão superior")
    situacao: str | None = coluna("Situação")
    urgente: str | None = coluna("Viagem Urgente")


@dataclass(frozen=True)
class LinhaDeTrechoDeViagem:
    """Um trecho de viagem: membro `AAAA_Trecho.csv`. A UF vem por extenso; fora do Brasil, vazia.

    ATENÇÃO: neste arquivo o nome da coluna do identificador termina com um espaço.
    """

    identificador: str | None = coluna("Identificador do processo de viagem ")
    pais_de_destino: str | None = coluna("Destino - País")
    uf_de_destino: str | None = coluna("Destino - UF")
    cidade_de_destino: str | None = coluna("Destino - Cidade")
    numero_de_diarias: str | None = coluna("Número Diárias")


@dataclass(frozen=True)
class LinhaDeCompra:
    """Um contrato publicado no Diário Oficial: `download-de-dados/compras/AAAAMM`, membro `AAAAMM_Compras.csv`.

    ATENÇÃO: os dois valores vêm com erro de digitação na fonte, um ou outro (ver
    `compras.valor_do_contrato`). Contrato sigiloso vem com contratado `-11` e nome `Sigiloso`.
    """

    orgao_superior: str | None = coluna("Nome Órgão Superior")
    modalidade: str | None = coluna("Modalidade Compra")
    codigo_do_contratado: str | None = coluna("Código Contratado")
    nome_do_contratado: str | None = coluna("Nome Contratado")
    valor_inicial: str | None = coluna("Valor Inicial Compra")
    valor_final: str | None = coluna("Valor Final Compra")


@dataclass(frozen=True)
class LinhaDeSancao:
    """Uma sanção do CEIS ou do CNEP: `download-de-dados/ceis/AAAAMMDD` e `cnep/AAAAMMDD`.

    RISCO: `documento` traz CNPJ de empresa e também CPF de pessoa física, sem máscara. Ele é lido
    só para separar os dois: `sancoes.para_empresas` descarta toda linha que não é CNPJ antes de
    qualquer gravação.
    """

    cadastro: str | None = coluna("CADASTRO")
    codigo_da_sancao: str | None = coluna("CÓDIGO DA SANÇÃO")
    documento: str | None = coluna("CPF OU CNPJ DO SANCIONADO")
    nome: str | None = coluna("NOME DO SANCIONADO")
    categoria: str | None = coluna("CATEGORIA DA SANÇÃO")
    inicio: str | None = coluna("DATA INÍCIO SANÇÃO")
    fim: str | None = coluna("DATA FINAL SANÇÃO")
    orgao_sancionador: str | None = coluna("ÓRGÃO SANCIONADOR")
    esfera: str | None = coluna("ESFERA ÓRGÃO SANCIONADOR")
    fundamentacao_legal: str | None = coluna("FUNDAMENTAÇÃO LEGAL")


@dataclass(frozen=True)
class LinhaDeCompraCentralizadaNoCartao:
    """Uma transação do Cartão de Pagamento de Compras Centralizadas: `download-de-dados/cpcc/AAAAMM`.

    RISCO: o arquivo traz o CPF do favorecido pessoa física sem máscara. Ele não está aqui.
    """

    ano_do_extrato: str | None = coluna("ANO EXTRATO")
    mes_do_extrato: str | None = coluna("MÊS EXTRATO")
    orgao_superior: str | None = coluna("NOME ÓRGÃO SUPERIOR")
    valor: str | None = coluna("VALOR TRANSAÇÃO")
