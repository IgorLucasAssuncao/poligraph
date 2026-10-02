import { useLocation, useSearchParams } from 'react-router-dom';
import { ehDinheiroPublico } from '../navegacao';
import { SeletorDeLegislatura } from './SeletorDeLegislatura';
import { useLegislaturaDaUrl, useLegislaturas } from './useLegislatura';

/**
 * De onde vem o dado, dito antes de qualquer número — e de QUE PERÍODO.
 *
 * Esta faixa já existiu e saiu porque, somada ao cabeçalho fixo, deixava 110px presos na
 * tela. Voltou sem ser fixa: rola junto com a página, e só o cabeçalho fica. Custa uma
 * linha no topo e nada durante a leitura.
 *
 * ## 🔴 A faixa ⛔ afirma um período que a tela ⛔ mostra
 *
 * Ela dizia sempre "57ª legislatura" — inclusive sobre a lista de 2015–2019, onde a
 * própria página dizia outra coisa (2026-10-02). Agora o que ela diz depende da tela:
 *
 * | Tela | A faixa |
 * |---|---|
 * | Início e Parlamentares | **O seletor de período** — um só, no mesmo lugar em todo o site |
 * | Compare seu voto | "Perguntas da 57ª legislatura": o questionário é só da corrente |
 * | Ficha | Nada: a ficha mostra os mandatos da pessoa, e qual está aberto |
 * | Dinheiro público e o resto | Nada: lá o recorte é por ano, ⛔ por legislatura |
 */
export function FaixaDeProcedencia() {
  const { pathname } = useLocation();

  return (
    <div className="faixa-procedencia" data-tour="procedencia">
      <strong>Dados públicos</strong>
      <span className="faixa-longa">Registro nominal de votação da Câmara dos Deputados e do Senado Federal</span>
      <span className="faixa-curta" aria-hidden="true">Câmara e Senado</span>
      <PeriodoDaFaixa pathname={pathname} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════

function PeriodoDaFaixa({ pathname }: { pathname: string }) {
  const [parametros] = useSearchParams();
  const [escolha, definir] = useLegislaturaDaUrl();
  const legislaturas = useLegislaturas();

  if (!legislaturas || legislaturas.length === 0) return null;
  const corrente = legislaturas[0].numero;

  if (pathname === '/resultado') return <span>Perguntas da {corrente}ª legislatura</span>;

  const escolhe = pathname === '/' || pathname === '/parlamentares';
  if (!escolhe || ehDinheiroPublico(pathname)) return null;

  // ⭐ "Todos os períodos" só na lista: ⛔ existe grafo nem painel de todas juntas.
  const naLista = pathname === '/parlamentares' && parametros.get('vista') !== 'grafo';
  const atual = escolha === 'todas' && !naLista ? corrente : (escolha ?? corrente);

  return (
    <SeletorDeLegislatura
      opcoes={legislaturas.map((l) => l.numero)}
      atual={atual}
      aoTrocar={definir}
      comTodas={naLista}
    />
  );
}
