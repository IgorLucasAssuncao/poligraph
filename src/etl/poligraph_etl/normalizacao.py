"""Normalização dos dados brutos da Câmara e do Senado.

Estas funções são puras de propósito: são o que os testes unitários cobrem, e o que
as medições do discovery transformaram em regra. Nada aqui toca banco ou rede.
"""

import re
import unicodedata

# ═══════════════════════════════════════════════════════════════════
# RN-03 — domínio fechado do voto
# ═══════════════════════════════════════════════════════════════════

# ⚠️ "Obstrução" NÃO é abstenção. Em 2023 foi 2,50% dos votos — medir só 2025,
#    onde deu 0,2%, levaria a tratá-la como ruído. É manobra de bancada: o
#    parlamentar está presente e se recusa a votar. Vira NULL (fora do cálculo),
#    não 0 (abstenção declarada).
_VOTOS = {
    "sim": 1,
    "não": -1,
    "nao": -1,
    "abstenção": 0,
    "abstencao": 0,
    "obstrução": None,
    "obstrucao": None,
    "artigo 17": None,      # o presidente da sessão só vota em desempate
    "branco": None,
}


def normalizar_voto(bruto: str | None) -> int | None:
    """Converte o voto textual da Câmara para o domínio fechado {-1, 0, 1, None}.

    ⚠️ Devolver None significa "fora do cálculo", não "discordou". Tratar ausência
    como discordância faria o ranking medir presença em vez de afinidade.
    """
    if bruto is None:
        return None

    chave = _sem_acento(bruto.strip().lower())
    for texto, valor in _VOTOS.items():
        if chave == _sem_acento(texto):
            return valor

    return None


# ═══════════════════════════════════════════════════════════════════
# RF-15 — categoria da votação
# ═══════════════════════════════════════════════════════════════════

# A ordem importa: a primeira que casar vence. PROCEDIMENTAL vem primeiro
# porque "Requerimento de urgência para o Projeto..." contém as duas coisas.
_CATEGORIAS: list[tuple[str, str]] = [
    (
        "PROCEDIMENTAL",
        r"requerimento|urgencia|encerramento|adiamento|retirada de pauta"
        r"|inversao|intersticio|prejudicial|questao de ordem|preferencia"
        r"|votacao em globo|recurso",
    ),
    (
        "DESTAQUE",
        r"destaque|mantido o texto|suprimido o texto|emenda|subemenda",
    ),
    (
        "AUTORIDADE",
        r"indicacao|mensagem|autoridade|embaixador|nomeacao|prisao preventiva"
        r"|perda do mandato|representacao|decoro",
    ),
]


def classificar_categoria(descricao: str | None) -> str:
    """Classifica a votação. O default é SUBSTANTIVA — voto de mérito.

    ⚠️ As regex precisam de validação contra amostra rotulada à mão (pendência A2).
    Categoria errada muda o PESO da votação na matriz de similaridade.
    """
    if not descricao:
        return "SUBSTANTIVA"

    texto = _sem_acento(descricao.lower())
    for categoria, padrao in _CATEGORIAS:
        if re.search(padrao, texto):
            return categoria

    return "SUBSTANTIVA"


# ═══════════════════════════════════════════════════════════════════
# 🔴 Achado #12 — a polaridade, detectável por padrão textual
# ═══════════════════════════════════════════════════════════════════


def inferir_polaridade(descricao: str | None) -> int:
    """Infere o que "Sim" significou nesta votação.

    🔴 O campo mais perigoso do sistema. Em 14% das votações nominais "Sim" quer
    dizer REJEITAR — e o erro não aparece na tela, aparece como um número plausível.

    ⚠️ Esta função é AUXÍLIO à curadoria, não substituto dela. O valor final de
    `pergunta.polaridade` é atribuído por pessoa (PL11).
    """
    if not descricao:
        return 1

    texto = _sem_acento(descricao.lower())

    # "Mantido o texto" = o destaque supressivo foi REJEITADO.
    # Quem votou Sim quis MANTER, ou seja, votou CONTRA a supressão proposta.
    if "mantido o texto" in texto:
        return -1

    return 1


# ═══════════════════════════════════════════════════════════════════
# CPF — a armadilha do zero à esquerda
# ═══════════════════════════════════════════════════════════════════


def normalizar_cpf(bruto: str | int | None) -> str | None:
    """Devolve o CPF com 11 dígitos, preservando zeros à esquerda.

    ⚠️ Ler CPF como número é o erro clássico: `01234567890` vira `1234567890` e o
    join com o TSE perde a pessoa em silêncio. Por isso o ETL lê tudo como texto.
    """
    if bruto is None:
        return None

    digitos = re.sub(r"\D", "", str(bruto))
    if not digitos:
        return None

    if len(digitos) > 11:
        return None

    return digitos.zfill(11)


# ═══════════════════════════════════════════════════════════════════

def _sem_acento(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )
