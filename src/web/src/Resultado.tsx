import type { ParlamentarAfim, ResultadoAfinidade } from './api';

/**
 * A tela de resultado.
 *
 * 🔴 RF-29: SEMPRE "concordou em X de Y", NUNCA percentual solto.
 * "67%" esconde que a base foram 3 perguntas; "2 de 3" mostra a fragilidade do próprio
 * número — e isso é honestidade metodológica, não detalhe de interface.
 */
export function Resultado({
  resultado,
  aoRefazer,
}: {
  resultado: ResultadoAfinidade;
  aoRefazer: () => void;
}) {
  return (
    <section className="resultado">
      <h2>Seu resultado</h2>
      <p className="ajuda">
        Você respondeu {resultado.totalPerguntasRespondidas} perguntas. A comparação usa
        apenas as votações em que o parlamentar esteve presente e se posicionou.
      </p>

      <h3>Mais próximos</h3>
      <ol className="lista-afinidade">
        {resultado.maisProximos.map((p) => (
          <Linha key={p.pessoaId} parlamentar={p} />
        ))}
      </ol>

      <h3>Mais distantes</h3>
      <ol className="lista-afinidade">
        {resultado.maisDistantes.map((p) => (
          <Linha key={p.pessoaId} parlamentar={p} />
        ))}
      </ol>

      <p className="aviso" role="note">
        ⚠️ Esta é uma ferramenta acadêmica de comparação de votos. <strong>Não é
        recomendação de voto</strong>, e não representa o programa completo de nenhum
        parlamentar.
      </p>

      <button type="button" onClick={aoRefazer}>
        Refazer o questionário
      </button>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════

function Linha({ parlamentar }: { parlamentar: ParlamentarAfim }) {
  return (
    <li>
      <a href={`/parlamentares/${parlamentar.pessoaId}`}>{parlamentar.nome}</a>{' '}
      <span className="filiacao">
        {parlamentar.partido}
        {parlamentar.uf && `/${parlamentar.uf}`}
      </span>
      <span className="placar">
        {/* 🔴 nunca percentual — ver o cabeçalho deste arquivo */}
        concordaram em <strong>{parlamentar.acordos}</strong> de{' '}
        <strong>{parlamentar.comparaveis}</strong> perguntas
      </span>
    </li>
  );
}
