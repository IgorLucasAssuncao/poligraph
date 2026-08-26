# /revisar

Revisa código C# do poligraph com o checklist do projeto.

## Uso

```
/revisar <arquivo-ou-pasta> [--foco seguranca|performance|lgpd]
```

## Instruções

1. Invoque a skill **`revisao-codigo`** e siga o checklist dela.
2. Comece pelas **cinco verificações do projeto** (§1). Se alguma falhar, pare e reporte.
3. Leia o código indicado. Se for pasta, priorize `Services/`, `Endpoints/` e `Data/`.
4. Produza o parecer no formato da §7 — 🔴 crítico, 🟡 importante, 🟢 sugestão, ✅ bom.
5. Todo 🔴 precisa de **cenário concreto de falha**, não de suspeita.
6. ⛔ Não aponte ausência de Repository, MediatR ou camadas: são decisões (§8).
