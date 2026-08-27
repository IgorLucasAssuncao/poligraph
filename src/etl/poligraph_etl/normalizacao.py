"""Normalização dos dados brutos da Câmara e do Senado.

Estas funções são puras de propósito: são o que os testes unitários cobrem, e o que
as medições do discovery transformaram em regra. Nada aqui toca banco ou rede.
"""

import hashlib
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


def normalizar_voto(bruto) -> int | None:
    """Converte o voto textual da Câmara para o domínio fechado {-1, 0, 1, None}.

    ⚠️ Devolver None significa "fora do cálculo", não "discordou". Tratar ausência
    como discordância faria o ranking medir presença em vez de afinidade.

    🔴 Não anotado como `str | None` de propósito: o que chega aqui vem do pandas, e
    célula vazia vira **`float('nan')`**, não `None` nem `""`. Foi assim que a
    ingestão real de 2025 morreu com `'float' object has no attribute 'strip'` — o
    `dtype=str` do `read_csv` não alcança o que o `na_values` transformou em nulo.
    """
    if bruto is None or not isinstance(bruto, str):
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
        # 🔴 `(?<!ressalvados os )destaques?` — a exceção não é detalhe.
        #
        # "Aprovado o Substitutivo ao PL 2.162, **ressalvados os destaques**" é voto no
        # TEXTO PRINCIPAL: os destaques ficaram de fora, para votação separada. A frase
        # cita destaque justamente para dizer que ele NÃO estava em jogo.
        #
        # ⚠️ Sem a exceção, 69 votações de mérito da legislatura 57 eram classificadas
        # como DESTAQUE. Duas consequências, ambas silenciosas: entravam na matriz com
        # peso 0,7 em vez de 1,0, e o filtro "só texto principal" da curadoria as
        # descartava — encolhendo o universo de perguntas sem que ninguém notasse.
        r"(?<!ressalvados os )destaques?|mantido o texto|suprimido o texto"
        r"|emenda|subemenda",
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


def hash_de_cpf(bruto: str | int | None) -> str | None:
    """SHA-256 do CPF normalizado — é o que vai para o banco.

    🔴 **RNF-13: CPF ⛔ nunca em claro.** Mas o hash **não impede a conciliação**: basta
    hashear os dois lados com o mesmo algoritmo e comparar os hashes. O CPF em claro só
    precisa existir **em memória**, durante a ingestão.

    ⚠️ Normaliza ANTES de hashear, e isso não é detalhe: `012.345.678-90` e
    `01234567890` são o mesmo CPF e precisam dar o **mesmo** hash. Sem a normalização,
    a fonte que formata com pontos nunca casaria com a que não formata.
    """
    digitos = normalizar_cpf(bruto)

    return hashlib.sha256(digitos.encode()).hexdigest() if digitos else None


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
# 🔴 Dinheiro — e as DUAS convenções que convivem no projeto
# ═══════════════════════════════════════════════════════════════════
#
# ⚠️ Este bloco existe porque as fontes ⛔ **não** concordam sobre o que é um número:
#
# | Fonte | `VR` / `vlr` | Convenção |
# |---|---|---|
# | Portal da Transparência (emendas) | `- 26.002,00` | pt-BR — ponto é MILHAR |
# | TSE (prestação de contas) | `3170000,00` | pt-BR — vírgula é decimal |
# | Câmara (cota parlamentar, CEAP) | `1234.56` | ponto é DECIMAL |
#
# 🔴 **A mesma string `"1.234"` vale 1234 numa e 1,234 na outra** — mil vezes de
# diferença, sem erro nenhum. Foi por isso que as funções ganharam nomes que dizem a
# convenção, ⛔ não a fonte: escolher a errada tem de ser uma escolha visível.


def valor_pt_br(bruto: str | None) -> float:
    """`"- 26.002,00"` → `-26002.0`. Ponto é MILHAR, vírgula é decimal.

    🔴 **Três armadilhas num campo só**, todas vistas no dado real:

    1. `float()` direto estoura em `"12.599,10"` — e, pior, `float("12.599")` daria
       **12,599** em vez de 12.599: três ordens de grandeza abaixo, **sem erro**
    2. O sinal negativo vem **antes e separado**: `"- 26.002,00"`. Empenho negativo é
       **cancelamento**, e é caso normal — ⛔ não descartar
    3. Campo vazio, `"#NULO"` e `"#NULO#"` aparecem nas duas fontes pt-BR
    """
    texto = (bruto or "").strip()
    if not texto or texto.upper().startswith("#"):
        return 0.0

    negativo = texto.startswith("-")
    digitos = texto.lstrip("-").strip().replace(".", "").replace(",", ".")

    try:
        valor = float(digitos)
    except ValueError:
        return 0.0

    return -valor if negativo else valor


def valor_com_ponto(bruto: str | None) -> float:
    """`"1234.56"` → `1234.56`. O ponto é DECIMAL — convenção da CEAP.

    ⚠️ Conferido no arquivo real da cota: ⛔ **não** tem separador de milhar. Passar
    um valor pt-BR por aqui daria um número mil vezes menor, calado.
    """
    texto = (bruto or "").strip()
    if not texto or texto.startswith("#"):
        return 0.0

    try:
        return float(texto.replace(",", "."))
    except ValueError:
        return 0.0


# ═══════════════════════════════════════════════════════════════════

def sem_acento_maiusculo(texto: str | None) -> str:
    """Forma canônica para comparar nomes entre fontes.

    ⚠️ O Portal manda `SOSTENES CAVALCANTE`; a Câmara guarda `Sóstenes Cavalcante`. Sem
    remover acento E normalizar a caixa E colapsar espaço, os dois nunca casariam — e o
    sintoma seria "não achou", ⛔ nunca um erro.
    """
    return " ".join(_sem_acento(texto or "").upper().split())


def _sem_acento(texto: str) -> str:
    return "".join(
        caractere for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )
