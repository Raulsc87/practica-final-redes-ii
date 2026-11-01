// La pagina vive en S3; los datos llegan de /api a traves de CloudFront y el balanceador
const historial = [];

async function cargarEquipo() {
  const estado = document.getElementById('equipo-estado');
  try {
    const respuesta = await fetch('/api/equipo', { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('No se pudo consultar el equipo');
    const equipo = await respuesta.json();
    if (typeof equipo.universidad !== 'string' || typeof equipo.curso !== 'string' ||
        !Array.isArray(equipo.integrantes) || !equipo.integrantes.length ||
        !equipo.integrantes.every(nombre => typeof nombre === 'string')) {
      throw new Error('Información del equipo incompleta');
    }
    const integrantes = equipo.integrantes.map(nombre => {
      const li = document.createElement('li');
      li.textContent = nombre;
      return li;
    });
    document.getElementById('equipo-universidad').textContent = equipo.universidad;
    document.getElementById('equipo-curso').textContent = equipo.curso;
    document.getElementById('equipo-integrantes').replaceChildren(...integrantes);
    estado.textContent = 'Información del equipo confirmada por la API';
  } catch (e) {
    estado.textContent = 'Se muestran los datos del proyecto. La API del equipo no está disponible.';
  }
}

async function preguntar() {
  try {
    const r = await fetch('/api/salud', { cache: 'no-store' });
    const s = await r.json();
    if (s.error) throw new Error(s.error);
    document.getElementById('srv-id').textContent = s.servidor;
    document.getElementById('srv-zona').textContent = s.zona;
    document.getElementById('srv-bd').textContent = s.version;
    historial.unshift(s.servidor.slice(-6) + ' (' + s.zona.slice(-2) + ')');
    document.getElementById('historial').textContent = 'Últimas respuestas: ' + historial.slice(0, 8).join(' · ');
  } catch (e) {
    document.getElementById('srv-id').textContent = 'Error: ' + e.message;
  }
}

async function estadisticas() {
  try {
    const r = await fetch('/api/estadisticas', { cache: 'no-store' });
    const d = await r.json();
    document.getElementById('total').textContent = d.total;
    const barras = document.getElementById('barras');
    barras.innerHTML = '';
    for (const s of d.servidores) {
      const pct = d.total ? Math.round(s.peticiones * 100 / d.total) : 0;
      const div = document.createElement('div');
      div.className = 'barra';
      div.innerHTML = '<div class="titulo"><span></span><span></span></div><div class="fondo"><div class="relleno"></div></div>';
      div.querySelector('.titulo span:first-child').textContent = s.servidor + ' · ' + s.zona;
      div.querySelector('.titulo span:last-child').textContent = s.peticiones + ' (' + pct + '%)';
      div.querySelector('.relleno').style.width = pct + '%';
      barras.appendChild(div);
    }
  } catch (e) { /* se reintenta en 5 segundos */ }
}

async function mensajes() {
  const r = await fetch('/api/mensajes', { cache: 'no-store' });
  const lista = await r.json();
  const ul = document.getElementById('mensajes');
  ul.innerHTML = '';
  for (const m of lista) {
    const li = document.createElement('li');
    li.innerHTML = '<b></b>: <span></span><div class="meta"></div>';
    li.querySelector('b').textContent = m.nombre;
    li.querySelector('span').textContent = m.mensaje;
    li.querySelector('.meta').textContent = new Date(m.fecha).toLocaleString() + ' · guardado por ' + m.servidor;
    ul.appendChild(li);
  }
}

document.getElementById('btn-preguntar').onclick = preguntar;

document.getElementById('btn-visita').onclick = async () => {
  await Promise.all(Array.from({ length: 10 }, () => fetch('/api/visita', { cache: 'no-store' })));
  estadisticas();
};

document.getElementById('formulario').onsubmit = async (e) => {
  e.preventDefault();
  await fetch('/api/mensajes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: document.getElementById('nombre').value,
      mensaje: document.getElementById('mensaje').value
    })
  });
  e.target.reset();
  mensajes();
};

cargarEquipo();
preguntar();
estadisticas();
mensajes();
setInterval(estadisticas, 5000);
