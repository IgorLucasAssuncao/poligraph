"""Os logs da ETL saindo por OpenTelemetry, só quando o coletor está configurado."""

import logging
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from poligraph_etl.nucleo import telemetria


def test_sem_coletor_nao_liga(monkeypatch):
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    destino = logging.getLogger("teste-sem-coletor")

    assert telemetria.ligar_logs(destino) is False
    assert destino.handlers == []


def test_com_coletor_a_linha_de_log_chega(monkeypatch):
    """Um servidor local faz o papel do coletor: a linha tem de chegar em /v1/logs."""
    recebidos: list[tuple[str, bytes]] = []

    class Coletor(BaseHTTPRequestHandler):
        def do_POST(self):
            corpo = self.rfile.read(int(self.headers["Content-Length"]))
            recebidos.append((self.path, corpo))
            self.send_response(200)
            self.end_headers()

        def log_message(self, *_):
            return

    servidor = HTTPServer(("127.0.0.1", 0), Coletor)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", f"http://127.0.0.1:{servidor.server_port}")
    monkeypatch.setenv("OTEL_SERVICE_NAME", "poligraph-etl")
    destino = logging.getLogger("teste-com-coletor")
    destino.setLevel(logging.INFO)

    try:
        assert telemetria.ligar_logs(destino) is True
        destino.info("Etapa 3 de 6: simbolicas --anos 2026")
        from opentelemetry._logs import get_logger_provider
        get_logger_provider().force_flush()
    finally:
        servidor.shutdown()

    assert [caminho for caminho, _ in recebidos] == ["/v1/logs"]
    assert b"simbolicas --anos 2026" in recebidos[0][1]
    assert b"poligraph-etl" in recebidos[0][1]
