# Parser CSV RFC 4180 para os arquivos da Câmara.
# Trata: campo entre aspas, aspas escapadas (""), e QUEBRA DE LINHA DENTRO DO CAMPO.

function conta_aspas(s,   n, i) {
    n = 0
    for (i = 1; i <= length(s); i++) if (substr(s, i, 1) == "\"") n++
    return n
}

# Divide um registro completo em campos. Devolve a quantidade.
function separa(rec, arr,   n, i, c, campo, dentro, len) {
    n = 0; campo = ""; dentro = 0; len = length(rec)
    delete arr
    for (i = 1; i <= len; i++) {
        c = substr(rec, i, 1)
        if (dentro) {
            if (c == "\"") {
                if (substr(rec, i + 1, 1) == "\"") { campo = campo "\""; i++ }
                else dentro = 0
            } else campo = campo c
        } else {
            if (c == "\"") dentro = 1
            else if (c == ";") { arr[++n] = campo; campo = "" }
            else campo = campo c
        }
    }
    arr[++n] = campo
    return n
}

BEGIN { acumulado = ""; aspas = 0; registro = 0 }

{
    linha = $0
    sub(/\r$/, "", linha)                  # CRLF
    if (NR == 1) sub(/^\xef\xbb\xbf/, "", linha)   # BOM

    acumulado = (acumulado == "" ? linha : acumulado "\n" linha)
    aspas += conta_aspas(linha)

    if (aspas % 2 == 0) {                  # registro completo
        registro++
        n = separa(acumulado, campo)
        processa(registro, n)
        acumulado = ""; aspas = 0
    }
}
