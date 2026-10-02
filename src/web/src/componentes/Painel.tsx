/**
 * O painel — o elemento-assinatura do poligraph.
 *
 * Uma marca por parlamentar da base: **cheia** para quem se posicionou naquela votação,
 * **vazada** para quem não. É o artefato do assunto — toda votação nominal da Câmara
 * vira um painel, e nenhum outro produto teria motivo para desenhar isto.
 *
 * RISCO: não O painel NUNCA mostra direção. Nada de "cheia = Sim, vazada = Não". Revelar a
 * divisão entre uma pergunta e a seguinte induziria conformidade, e o instrumento
 * passaria a medir adesão à maioria em vez de posição própria. Ver `PerguntaPublica`
 * na API.
 *
 * DECISÃO: Repare que a assinatura nasce da restrição: é justamente por não poder mostrar
 * direção que sobra o comparecimento — e comparecimento tem forma visual própria.
 *
 * ATENÇÃO: Sem denominador não há painel: 300 e 480 marcas seriam indistinguíveis a olho.
 */
export function Painel({
  posicionados,
  total,
}: {
  posicionados: number;
  total: number;
}) {
  if (total <= 0 || posicionados <= 0) return null;

  const marcas = Array.from({ length: total }, (_, i) => i < posicionados);

  return (
    <div className="painel-votacao">
      <div
        className="painel-marcas"
        role="img"
        aria-label={`${posicionados} de ${total} parlamentares se posicionaram nesta votação`}
      >
        {marcas.map((cheia, i) => (
          <span key={i} className={cheia ? 'marca marca-cheia' : 'marca'} />
        ))}
      </div>

      <p className="painel-legenda">
        <strong>{posicionados}</strong> de {total} se posicionaram
      </p>
    </div>
  );
}
