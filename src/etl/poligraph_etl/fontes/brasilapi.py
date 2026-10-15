"""BrasilAPI — a sede de um CNPJ pelo código IBGE do município (Pendência 71).

## ENTRADA

| | |
|---|---|
| Fonte | `brasilapi.com.br/api/cnpj/v1/{cnpj}` |
| Origem do dado | O cadastro aberto de CNPJ da Receita Federal, que a BrasilAPI repassa |
| Formato | JSON, uma requisição por CNPJ |

RISCO: É projeto comunitário, sem garantia de disponibilidade nem de atualização. A fonte
citada continua sendo a Receita; a BrasilAPI é o caminho até ela, e a URL da carga diz isso.

RISCO: A resposta traz 48 campos, entre eles o quadro de sócios (`qsa`), com nome e parte do
CPF de pessoas. Este módulo devolve só quatro campos: o resto nunca sai daqui, nem para o
arquivo guardado. O sócio é dado pessoal e não serve ao trabalho.
"""

import logging
import time

import requests

BASE = "https://brasilapi.com.br/api/cnpj/v1"

CABECALHOS = {"User-Agent": "poligraph-etl/1.0 (TCC; dados abertos)"}
"""MEDIDO em 2026-10-02: com o user-agent padrão do `requests`, a BrasilAPI responde 429 a todo
pedido; com um user-agent que diz quem pede, 200. Sem isto, cada CNPJ esperava 30 s e saía vazio."""

TENTATIVAS_COM_LIMITE = 6

STATUS_DE_LIMITE = (429, 403)
"""429 é o limite; 403 com `x-vercel-mitigated: deny` é a proteção anti-abuso da Vercel
(issues #826 e #835 da BrasilAPI). Os dois pedem o mesmo: ir mais devagar."""


class Ritmo:
    """A pausa entre requisições, ajustada pelo que a BrasilAPI responde (decisão do autor, 2026-10-02).

    A BrasilAPI não publica limite (issue #835): começar devagar demais desperdiça horas, e
    rápido demais arrisca bloqueio do IP. A pausa começa curta, dobra a cada recusa e volta
    a encurtar depois de uma sequência sem erro.
    """

    MINIMA = 0.1
    MAXIMA = 60.0
    SEQUENCIA_PARA_ENCURTAR = 50

    def __init__(self, esperar=time.sleep):
        self.pausa = self.MINIMA
        self.recusas = 0
        self._sem_erro = 0
        self._esperar = esperar

    def esperar(self) -> None:
        self._esperar(self.pausa)

    def recusou(self) -> None:
        """429 ou 403: dobra a pausa."""
        self.recusas += 1
        self._sem_erro = 0
        self.pausa = min(self.pausa * 2, self.MAXIMA)

    def respondeu(self) -> None:
        """Qualquer resposta que não é recusa: depois de uma sequência, a pausa cai pela metade."""
        self._sem_erro += 1
        if self._sem_erro >= self.SEQUENCIA_PARA_ENCURTAR and self.pausa > self.MINIMA:
            self.pausa = max(self.pausa / 2, self.MINIMA)
            self._sem_erro = 0

log = logging.getLogger("poligraph")


def sede(cnpj: str, ritmo: Ritmo | None = None) -> dict | None:
    """`{cnpj, codigo_ibge, municipio, uf}`, ou `None` quando não há resposta útil.

    Espera o `ritmo` antes de cada requisição. Recusa (429, 403) dobra a pausa e tenta de novo;
    404 e as outras falhas devolvem `None`, e o CNPJ fica para a próxima execução.
    """
    ritmo = ritmo or Ritmo()
    for _ in range(TENTATIVAS_COM_LIMITE):
        ritmo.esperar()
        try:
            resposta = requests.get(f"{BASE}/{cnpj}", headers=CABECALHOS, timeout=30)
        except requests.RequestException:
            return None
        if resposta.status_code in STATUS_DE_LIMITE:
            ritmo.recusou()
            continue
        ritmo.respondeu()
        if resposta.status_code != 200:
            return None
        try:
            dados = resposta.json()
        except ValueError:
            return None
        return _quatro_campos(cnpj, dados)
    return None


def _quatro_campos(cnpj: str, dados: dict) -> dict | None:
    """Só o que a sede precisa. O código vem como número e às vezes falta."""
    codigo = dados.get("codigo_municipio_ibge")
    if not codigo:
        return None
    return {
        "cnpj": cnpj,
        "codigo_ibge": str(codigo).zfill(7),
        "municipio": dados.get("municipio"),
        "uf": dados.get("uf"),
    }
