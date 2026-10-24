# Coolify: valores para colar

Cada valor num bloco próprio. Explicação de cada um em `coolify-tarefas.md`.

---

## Variável da chave do CPF

**production → Shared Variables → + Add**

Name:

```
POLIGRAPH_CHAVE_CPF
```

Value: a chave do computador do autor, tirada com o comando abaixo, no PowerShell, na pasta do
projeto. O valor é o que vem depois de `= `. Não colar em chat nem em arquivo.

```powershell
dotnet user-secrets list --project src/Poligraph.AppHost | Select-String "chave-cpf"
```

**Aplicação → Environment Variables**

Name:

```
POLIGRAPH_CHAVE_CPF
```

Value:

```
{{environment.POLIGRAPH_CHAVE_CPF}}
```

Depois: **Deploy**.

---

## Tarefa 1: rotina semanal

**Aplicação → Scheduled Tasks → + Add**

Name:

```
rotina-semanal
```

Command:

```
python -m poligraph_etl rotina --frequencia semanal
```

Frequency (toda segunda, às 3h):

```
0 3 * * 1
```

Container name / Service:

```
etl
```

Timeout (segundos, 6 horas):

```
21600
```

---

## Tarefa 2: rotina mensal

**Aplicação → Scheduled Tasks → + Add**

Name:

```
rotina-mensal
```

Command:

```
python -m poligraph_etl rotina --frequencia mensal
```

Frequency (todo dia 2, às 3h):

```
0 3 2 * *
```

Container name / Service:

```
etl
```

Timeout (segundos, 6 horas):

```
21600
```

---

## Por que 6 horas nas duas

O timeout só serve para matar tarefa travada; folga não custa nada, e a tarefa morta no meio não
grava o evento, então ninguém é avisado. 1500 s não bastou. Medido nas cargas da máquina do autor
(2026-10): só `emendas` chegou a 26 min, `redes` a 58 e o `siconfi` passa de uma hora. A mensal
de maio (siconfi) e a de novembro e dezembro de ano de eleição (mandatos, fundo, patrimônio e redes)
são as mais longas. A semanal precisa do mesmo valor: quando cai no dia da mensal, espera a mensal
acabar, e o tempo de espera conta. Depois da primeira de cada, ver o "Concluído em" no log e
deixar o timeout em pelo menos o dobro.

---

## Comandos avulsos

Para rodar à mão no **Terminal** da aplicação, serviço `etl`:

```
python -m poligraph_etl conferir
```

```
python -m poligraph_etl limpar-cache
```

```
du -sh /cache
```
