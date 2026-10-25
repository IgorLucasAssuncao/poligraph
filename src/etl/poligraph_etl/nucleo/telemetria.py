"""TELEMETRIA — os logs da ETL também no Grafana (decisão do autor, 2026-10-16; P21).

A ETL loga com o `logging` do Python, e o log continua saindo no terminal e na tarefa agendada
do Coolify. Com `OTEL_EXPORTER_OTLP_ENDPOINT` definido, cada linha vai também, pelo padrão
OpenTelemetry, para o serviço `observabilidade` do compose, onde o Grafana a mostra ao lado dos
logs da API. Sem a variável, nada muda: é o caso do computador do autor.

| Variável | Valor no compose |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://observabilidade:4318` (OTLP por HTTP; o `/v1/logs` o exportador acrescenta) |
| `OTEL_SERVICE_NAME` | `poligraph-etl`, o nome que aparece no Grafana |

DECISÃO: OTLP por HTTP, e não gRPC: o pacote de gRPC traz um binário pesado, e o HTTP usa o
mesmo `requests` que a ETL já tem. O `LoggingHandler` vem de `opentelemetry-instrumentation-logging`:
o do `opentelemetry-sdk` foi depreciado (MEDIDO na versão 1.45, 2026-10-16).

ATENÇÃO: os logs vão em lote, a cada poucos segundos. A rotina é um processo que termina: o
`shutdown` no fim do processo despacha o que ainda estiver no lote, para a última etapa não sumir
do Grafana.
"""

import atexit
import logging
import os


def ligar_logs(destino: logging.Logger) -> bool:
    """Pendura no `destino` o envio por OpenTelemetry, se a variável do coletor existir."""
    if not os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return False

    from opentelemetry._logs import set_logger_provider
    from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
    from opentelemetry.instrumentation.logging.handler import LoggingHandler
    from opentelemetry.sdk._logs import LoggerProvider
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
    from opentelemetry.sdk.resources import Resource

    provedor = LoggerProvider(resource=Resource.create())
    provedor.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))
    set_logger_provider(provedor)
    destino.addHandler(LoggingHandler(level=logging.INFO, logger_provider=provedor))
    atexit.register(provedor.shutdown)
    return True
