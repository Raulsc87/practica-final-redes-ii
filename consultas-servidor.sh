#!/bin/bash
# ==================================================================
# Comandos DENTRO de un servidor API
# Conectarse: EC2 > Instancias > (una instancia PracticaIntegradora-api) > Conectar > EC2 Instance Connect
# ==================================================================

# Ver la API en vivo: cada peticion que llega del balanceador
sudo journalctl -u api -f
# (Ctrl + C para salir)

# Estado del servicio
sudo systemctl status api

# Si algo fallo al encender, aqui esta todo lo que hizo el UserData
sudo tail -50 /var/log/cloud-init-output.log

# Probar la API desde el propio servidor
curl -s localhost:3000/api/salud; echo

# Prueba de red: desde AQUI la base si responde (sg-bd acepta a sg-api)
BD=$(sudo grep DB_HOST /etc/api.env | cut -d= -f2)
getent hosts $BD
timeout 5 bash -c "</dev/tcp/$BD/5432" && echo "5432 ABIERTO desde el servidor"

# Entrar a PostgreSQL (la base es privada: solo se llega desde aqui)
sudo bd

# ---------- Consultas SQL (escribalas dentro de psql) ----------
# \dt                                   -- lista las tablas
# SELECT COUNT(*) FROM visitas;
#
# -- Reparto de la carga por servidor
# SELECT servidor, zona, COUNT(*) AS peticiones
# FROM visitas GROUP BY servidor, zona ORDER BY peticiones DESC;
#
# -- Peticiones por minuto (vea el momento de la prueba de carga)
# SELECT date_trunc('minute', fecha) AS minuto, servidor, COUNT(*)
# FROM visitas GROUP BY 1, 2 ORDER BY 1, 2;
#
# -- Ultimas entradas
# SELECT id, servidor, ip, fecha FROM visitas ORDER BY id DESC LIMIT 10;
# SELECT * FROM mensajes ORDER BY id DESC;
#
# \q                                    -- salir
