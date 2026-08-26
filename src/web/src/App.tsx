import { Questionario } from './Questionario';
import './App.css';

export default function App() {
  return (
    <main>
      <header>
        <h1>poligraph</h1>
        <p className="subtitulo">
          Afinidade política medida pelo voto — não pelo discurso.
        </p>
      </header>

      <Questionario />

      <footer>
        <small>
          Dados abertos da Câmara dos Deputados · Trabalho de conclusão de curso
        </small>
      </footer>
    </main>
  );
}
