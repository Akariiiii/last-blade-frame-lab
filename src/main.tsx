import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { selectDataSource } from './lib/data.ts';
import './app/styles.css';
const root = ReactDOM.createRoot(document.getElementById('root')!);
const base = import.meta.env.BASE_URL;
void selectDataSource(base).then(source => root.render(
  <React.StrictMode>
    {source === 'demo' && <div className="demo-notice" role="status">Synthetic demo · generated shapes and example values, not game measurements. Import your local data pack to view the game.</div>}
    <App />
  </React.StrictMode>
)).catch(error => root.render(<main className="startup-error"><h1>Frame Lab</h1><p role="alert">{String(error)}</p></main>));
