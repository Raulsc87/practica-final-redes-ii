// Practica integradora: API en Node.js detras de un Application Load Balancer
// Base de datos: Amazon RDS for PostgreSQL
//
// [SE PUEDE CAMBIAR] agregar rutas (bloque PERSONALICE), tablas (constante TABLAS)
//                    y los textos de las respuestas.
// [NO CAMBIAR] /api/ping (chequeo de salud del balanceador), /api/visita y
//              /api/estadisticas (pruebas de carga), el puerto y la conexion a la base.
// Si edita este codigo dentro del YAML, siga la regla de !Sub escrita arriba del UserData.
const fs = require('fs');
const express = require('express');
const { Pool } = require('pg');

const SERVIDOR = process.env.INSTANCE_ID || 'local';
const ZONA = process.env.AZ || 'local';
const PUERTO = Number(process.env.PORT || 3000);

// Conexion cifrada con el certificado de AWS (DB_SSL=off solo para pruebas locales)
let ssl;
if (process.env.DB_SSL !== 'off') {
  const ca = process.env.DB_SSL_CA && fs.existsSync(process.env.DB_SSL_CA)
    ? fs.readFileSync(process.env.DB_SSL_CA, 'utf8') : undefined;
  ssl = ca ? { ca } : { rejectUnauthorized: false };
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'proyecto',
  port: 5432,
  ssl,
  max: 10
});

const app = express();
app.use(express.json());

// Registro de cada peticion: se ve con  journalctl -u api -f
app.use((req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  res.on('finish', () => {
    if (req.path !== '/api/ping') {
      console.log(new Date().toISOString() + ' ' + ip + ' ' + req.method + ' ' + req.originalUrl + ' -> ' + res.statusCode);
    }
  });
  req.ipCliente = ip;
  next();
});

// Chequeo de salud del balanceador (no toca la base de datos). [NO CAMBIAR]
app.get('/api/ping', (req, res) => res.send('ok'));

// Equipo responsable del proyecto final de Redes II
app.get('/api/equipo', (req, res) => {
  res.json({
    universidad: 'Universidad Mesoamericana',
    curso: 'Redes II',
    integrantes: [
      'José Raúl Soto Cal',
      'Diego Alejandro Xicará Santizo',
      'Denilson Yair Díaz López'
    ]
  });
});

// Que servidor respondio y si la base de datos esta conectada
app.get('/api/salud', async (req, res) => {
  const { rows } = await pool.query('SELECT NOW() AS hora_bd, version() AS version');
  res.json({ servidor: SERVIDOR, zona: ZONA, hora_bd: rows[0].hora_bd, version: rows[0].version.split(' on ')[0] });
});

// Registra una visita: esta es la ruta que se usa en la prueba de carga. [NO CAMBIAR]
app.get('/api/visita', async (req, res) => {
  await pool.query(
    'INSERT INTO visitas (servidor, zona, ip, agente) VALUES ($1, $2, $3, $4)',
    [SERVIDOR, ZONA, req.ipCliente, (req.headers['user-agent'] || '').slice(0, 200)]
  );
  res.json({ mensaje: 'Visita registrada', servidor: SERVIDOR, zona: ZONA });
});

// Cuantas peticiones atendio cada servidor. [NO CAMBIAR]
app.get('/api/estadisticas', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT servidor, zona, COUNT(*)::int AS peticiones,
           COUNT(*) FILTER (WHERE fecha > NOW() - INTERVAL '1 minute')::int AS ultimo_minuto,
           MAX(fecha) AS ultima
    FROM visitas GROUP BY servidor, zona ORDER BY servidor`);
  const total = rows.reduce((s, r) => s + r.peticiones, 0);
  res.json({ respondio: SERVIDOR, total, servidores: rows });
});

// Libro de visitas. [SE PUEDE CAMBIAR] o reemplazar por el tema del grupo
app.get('/api/mensajes', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, mensaje, servidor, fecha FROM mensajes ORDER BY id DESC LIMIT 50');
  res.json(rows);
});

app.post('/api/mensajes', async (req, res) => {
  const nombre = String((req.body || {}).nombre || '').trim().slice(0, 80);
  const mensaje = String((req.body || {}).mensaje || '').trim().slice(0, 500);
  if (!nombre || !mensaje) {
    return res.status(400).json({ error: 'Envie nombre y mensaje' });
  }
  const { rows } = await pool.query(
    'INSERT INTO mensajes (nombre, mensaje, servidor) VALUES ($1, $2, $3) RETURNING id',
    [nombre, mensaje, SERVIDOR]);
  res.status(201).json({ mensaje: 'Mensaje guardado', id: rows[0].id, servidor: SERVIDOR });
});

// ------------------------------------------------------------------
// PERSONALICE AQUI: agregue sus propias rutas. Ejemplo (quite las // para usarlo):
//
// app.get('/api/hola', (req, res) => {
//   res.json({ mensaje: 'Hola desde el grupo', servidor: SERVIDOR, zona: ZONA });
// });
// ------------------------------------------------------------------

// Cualquier error de base de datos se responde sin detener el servidor
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message, servidor: SERVIDOR });
});

const TABLAS = `
  CREATE TABLE IF NOT EXISTS visitas (
    id BIGSERIAL PRIMARY KEY,
    servidor VARCHAR(40) NOT NULL,
    zona VARCHAR(40) NOT NULL,
    ip VARCHAR(60),
    agente VARCHAR(200),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS mensajes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    mensaje VARCHAR(500) NOT NULL,
    servidor VARCHAR(40) NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`;

// Arranque: espera a que la base responda (puede tardar si se acaba de crear)
async function iniciar() {
  for (let intento = 1; intento <= 30; intento++) {
    try {
      await pool.query(TABLAS);
      console.log('Conectado a PostgreSQL. Servidor ' + SERVIDOR + ' en ' + ZONA);
      break;
    } catch (err) {
      // Si dos servidores crean las tablas al mismo tiempo, una puede fallar: ya existen
      if (err.code === '23505' || err.code === '42P07') break;
      console.error('Intento ' + intento + ': no se pudo conectar a la base (' + (err.code || '') + ' ' + err.message + ')');
      if (intento === 30) process.exit(1);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  app.listen(PUERTO, () => console.log('API escuchando en el puerto ' + PUERTO));
}

iniciar();
