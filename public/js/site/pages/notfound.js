import { initPage } from '../layout.js';
import { el } from '../ui.js';

await initPage({ requireAuth: false });
document.getElementById('app').append(el('div', { class: 'panel center', style: { padding: '60px 20px' } },
  el('img', { src: '/img/icon-dark.svg', alt: '', style: { width: '90px', transform: 'rotate(-20deg)', opacity: 0.8 } }),
  el('h1', { style: { marginTop: '20px' }, text: 'Page cannot be found or no longer exists' }),
  el('p', { class: 'muted', text: '404 — Oof!' }),
  el('div', { class: 'row', style: { justifyContent: 'center' } }, el('a', { class: 'btn', href: 'javascript:history.back()', text: 'Go to Previous Page' }), el('a', { class: 'btn btn-primary', href: '/home', text: 'Return Home' }))));
