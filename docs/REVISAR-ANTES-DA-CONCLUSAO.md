# Revisar antes de escrever a conclusão

> **Criado:** 2026-08-23
> Lista de **coisas que podem mudar** entre o discovery e a entrega do TCC. Não são
> pendências de trabalho — são **fatos externos com prazo de validade**.
>
> ⚠️ Afirmar na conclusão algo que deixou de ser verdade é o pior erro possível num
> trabalho cuja força está em ter medido tudo. **Reverificar leva uma hora.**

---

## 🔴 Podem mudar a conclusão do trabalho

### 1. A CPMI passou a publicar votação nominal?

| | |
|---|---|
| **Situação em 2026-08-23** | `CPMI8JAN` existe como órgão (id 102648), mas retorna **0 votações** |
| **Por que importa** | 🔴 É o **único lugar** onde deputados e senadores votam **o mesmo, juntos** (achado #21). Se for publicada, **a unificação dos dois grafos passa a ser possível** e o achado #7 muda |
| **Como verificar** | `GET /api/v2/votacoes?idOrgao=102648` · e `casaSessao` no `/votacao` do Senado |
| **Se mudou** | Rever achado #7 e §4.5 do discovery. O volume seria pequeno, mas seria ponte real |

### 2. O Senado passou a publicar orientação de bancada?

| | |
|---|---|
| **Situação** | ⛔ Não existe — `/orientacao`, `/votacao/orientacao`, `/processo/orientacao` → 404 |
| **Por que importa** | É o que torna a comparação entre casas **assimétrica**. Disciplina partidária e governismo só existem na Câmara |
| **Se mudou** | A comparação Câmara × Senado fica completa, e o RF-22 e RF-23 mudam de escopo |

---

## 🟡 Podem invalidar afirmações do texto

### 3. O acesso ao TSE ainda funciona?

| | |
|---|---|
| **Situação** | ✅ 200 com o conjunto completo de headers de navegador (§2.0 do [12-fonte-tse](12-fonte-tse.md)) |
| **Risco** | 🔴 **Alto** — é comportamento de WAF, pode endurecer sem aviso |
| **Se mudou** | A RE-01 volta a valer, a RNF-25 (reprodutibilidade integral) deixa de ser verdade, e a carga volta a ser manual |

### 4. O endpoint do Senado continua o mesmo?

| | |
|---|---|
| **Situação** | `/votacao` é o substituto; o antigo `/plenario/lista/votacao` tinha desativação anunciada para **2026-02-01** |
| **Verificar** | Se o `/votacao` também ganhou bloco `Descontinuacao` nos `Metadados` |
| **Se mudou** | Todo o extrator do Senado |

### 5. Os CSVs da Câmara mantêm o layout?

| | |
|---|---|
| **Situação** | Reconstruídos toda madrugada (achado #19); layout estável no período observado |
| **Verificar** | Header de `votacoesVotos-{ano}.csv` e a coluna `cpf` de `deputados.csv` (hoje **vazia**) |
| **Se mudou** | ⭐ Se o `cpf` for preenchido, some a necessidade de 644 chamadas REST |

---

## 🟢 Números que crescem sozinhos

### 6. Recontar tudo com o ano fechado

Quase todos os números do projeto foram medidos com **2026 parcial** (até agosto).

| Métrica | Medido em 2026-08 | Na conclusão |
|---|---|---|
| Votações nominais 2026 | 149 | ⬆️ maior |
| Votações de plenário na legislatura | 1.103 | ⬆️ maior |
| Nós do grafo | 644 | ⬆️ possivelmente |
| Senado — votações abertas | 182 | ⬆️ maior |

⚠️ **Refaça a medição antes de escrever.** E aplique a regra: **todo número precisa dizer
sobre qual recorte foi medido.**

### 7. A eleição de outubro de 2026

| | |
|---|---|
| **O que muda** | A composição eleita muda; a **57ª legislatura vai até 31/01/2027** |
| **O que NÃO muda** | Os dados da legislatura 57 continuam válidos — é um recorte fechado |
| ⚠️ **Cuidado** | Não misturar legislaturas (RN-12). E rever o **risco R7 / RNF-17** — depois da eleição, a restrição de publicação perde o motivo |

---

## 🔵 Oportunidades que podem ter surgido

| # | Verificar | Se existir |
|---|---|---|
| 8 | **Feed RSS da Agência Câmara** (N1) | Corrige o viés contra deputados na cobertura noticiosa |
| 9 | **Assembleias estaduais** publicando voto nominal | Reabriria o escopo subnacional (§3.0.1 do [10-api-camara](10-api-camara.md)) |
| 10 | **Câmaras municipais** com voto nominal | Idem (§3.0.2) |

⚠️ Os itens 9 e 10 sustentam uma afirmação forte do trabalho — *"nenhuma assembleia ou
câmara municipal testada publica voto nominal"*. **Se alguma passou a publicar, a frase
precisa ser qualificada com a data do teste.**

---

## Checklist de reverificação

```
[ ] 1. CPMI publica votação?              GET /votacoes?idOrgao=102648
[ ] 2. Senado tem orientação de bancada?  GET /orientacao  → ainda 404?
[ ] 3. TSE ainda responde 200?            headers completos
[ ] 4. /votacao do Senado sem Descontinuacao?
[ ] 5. Layout dos CSVs e coluna cpf
[ ] 6. Recontar TODOS os números com o ano fechado
[ ] 7. Confirmar recorte da legislatura 57 e revisitar R7/RNF-17
[ ] 8. Feed da Agência Câmara apareceu?
[ ] 9/10. Assembleias e câmaras municipais publicam voto nominal?
```

> 🔑 **Registre a data da reverificação no texto do TCC.** "Verificado em <data>" é o que
> transforma um número que envelheceu em uma medição datada — e a segunda é defensável.
