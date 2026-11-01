# Proyecto final — Redes II

Universidad Mesoamericana · Redes II

**Integrantes:**

- José Raúl Soto Cal
- Diego Alejandro Xicará Santizo
- Denilson Yair Díaz López

**Sitio público:** [https://d2cbq6f66ks9yt.cloudfront.net](https://d2cbq6f66ks9yt.cloudfront.net)

El proyecto demuestra una arquitectura de tres capas en AWS: una página web, una API y una base de datos privada. Incluye pruebas de carga, escalado automático y recuperación después de detener una instancia.

## Arquitectura

```
Usuarios ─HTTPS─► CloudFront ─┬─ /*      ─► S3 (index.html, estilos.css, app.js)   [privado, OAC]
                              └─ /api/*  ─► Application Load Balancer (puerto 80)
                                              ├─► EC2 API Node.js · zona A ─┐
                                              └─► EC2 API Node.js · zona B ─┤  Auto Scaling 2 a 4
                                                                            ▼
                                                     RDS PostgreSQL (subredes privadas, puerto 5432)
```

| Capa | Servicio | Detalle |
|---|---|---|
| Presentación | Amazon S3 + CloudFront | Sitio estático privado, servido solo por CloudFront (OAC), HTTPS |
| Aplicación | EC2 + Auto Scaling + ALB | API Node.js 22 (Express 5) en 2 zonas; escala con 600 peticiones/min por servidor |
| Datos | Amazon RDS for PostgreSQL | db.t4g.micro, 20 GiB gp3, sin acceso público |
| Infraestructura como código | AWS CloudFormation | 26 recursos en `infra-practica-integradora.yaml` |

CloudFront entrega los archivos del sitio desde S3 y envía las solicitudes `/api/*` al balanceador. El balanceador distribuye las peticiones entre las instancias EC2. La API guarda las visitas y los mensajes en PostgreSQL.

## Carpetas y archivos

| Ubicación | Contenido |
|---|---|
| `sitio/` | Página `index.html`, estilos `estilos.css` y lógica del navegador `app.js`. |
| `api/` | API Node.js en `server.js` y dependencias declaradas en `package.json`. |
| `infra-practica-integradora.yaml` | Plantilla CloudFormation. UserData contiene otra copia de la API; debe mantenerse sincronizada con `api/server.js`. |
| `comandos-cloudshell.sh` | Comandos de consulta, carga del sitio, pruebas y limpieza. Se usan por bloques, no todos juntos. |
| `consultas-servidor.sh` | Comandos de diagnóstico desde EC2 y ejemplos de consultas SQL. |
| `Evidencias_Redes_II_AWS (1)/Evidencias_Redes_II_AWS/` | Capturas reales de la práctica y `LEEME.txt` con su contexto. Se conserva la ubicación actual. |
| `.gitignore` | Exclusiones para dependencias, configuración con secretos, claves privadas y copias de respaldo. |

## Seguridad (cadena de grupos de seguridad)

| Grupo | Permite entrada | Desde |
|---|---|---|
| sg-alb | TCP 80 | Internet |
| sg-api | TCP 3000 | Solo sg-alb |
| sg-api | TCP 22 | SSHLocation (EC2 Instance Connect) |
| sg-bd | TCP 5432 | Solo sg-api |

## API

| Ruta | Descripción |
|---|---|
| `GET /api/ping` | Chequeo de salud del balanceador |
| `GET /api/equipo` | Universidad, curso e integrantes del proyecto |
| `GET /api/salud` | Servidor, zona y versión de PostgreSQL |
| `GET /api/visita` | Registra una visita en la tabla `visitas` (ruta de la prueba de carga) |
| `GET /api/estadisticas` | Peticiones atendidas por cada servidor |
| `GET /api/mensajes` · `POST /api/mensajes` | Libro de visitas |

## Despliegue

1. CloudFormation › Crear pila › subir `infra-practica-integradora.yaml`.
2. Nombre de pila `PracticaIntegradora`, contraseña de la base (solo letras y números).
3. Esperar `CREATE_COMPLETE` (15 a 20 minutos).
4. Subir `sitio/index.html`, `sitio/estilos.css` y `sitio/app.js` al bucket de la salida `BucketSitio`.
5. Abrir la salida `SitioWeb`.

Los comandos están en `comandos-cloudshell.sh` (pruebas y limpieza) y `consultas-servidor.sh` (registros y SQL).

## Personalización del grupo

- Sitio (`sitio/`): título “Proyecto final — Redes II”, Universidad Mesoamericana e integrantes; colores sobrios, mayor espaciado y diseño adaptable a computadora y móvil.
- Equipo: el encabezado consulta la ruta relativa `/api/equipo`. Si la API no está disponible, conserva los datos del proyecto y muestra un aviso.
- API: nueva ruta `GET /api/equipo`, sincronizada en `api/server.js` y en UserData del YAML. Los cuatro logs mantienen concatenación, sin interpolaciones de JavaScript.
- Se conservan las funciones de salud, visitas, estadísticas y mensajes, y la configuración de recursos, puertos, seguridad y escalado.

### Comprobar el equipo

Abra [GET /api/equipo en el sitio público](https://d2cbq6f66ks9yt.cloudfront.net/api/equipo). También puede usar `http://localhost:3000/api/equipo` con la API local en ejecución. Debe responder:

```json
{
  "universidad": "Universidad Mesoamericana",
  "curso": "Redes II",
  "integrantes": [
    "José Raúl Soto Cal",
    "Diego Alejandro Xicará Santizo",
    "Denilson Yair Díaz López"
  ]
}
```

En el sitio, el encabezado mostrará “Información del equipo confirmada por la API” cuando la consulta termine correctamente.

## Costos

Cost Explorer muestra provisionalmente **0.00 USD** en el reporte capturado. Esa lectura no demuestra que el proyecto tenga costo final cero ni que el reporte incluya exclusivamente esta pila. El **costo final está pendiente de actualización**.

La estimación inicial de planificación era de aproximadamente 0.09 USD por hora, unos 7 USD por 72 horas en us-east-1. Es una referencia previa, no un costo medido ni una cotización actual. El escalado y el tiempo de uso pueden cambiar el total.

Pendiente: volver a consultar Cost Explorer, guardar el desglose actualizado y registrar el costo final. El enlace a una estimación en AWS Pricing Calculator también está pendiente.

## Resultados de las pruebas

Resultados registrados con ApacheBench sobre `/api/visita`:

| Prueba | Peticiones completadas | Failed requests | Peticiones/s | Respuestas no 2xx |
|---|---:|---:|---:|---|
| Base | 2000 | 0 | 1831.16 | No se consigna un conteo en la captura seleccionada. |
| Carga sostenida | 1000000 | 0 | 3975.47 | No se consigna un conteo en la captura seleccionada. |
| Falla al detener una instancia | 546233 | 0 | 1811.65 | 5292, aproximadamente 0.97%. |

En la prueba de falla, `Failed requests: 0` y `Non-2xx responses: 5292` son contadores distintos del reporte. El porcentaje es `5292 / 546233 × 100 ≈ 0.97%`. **Hubo respuestas HTTP no 2xx; la prueba no ocurrió sin errores HTTP.**

Durante la carga sostenida, Auto Scaling aumentó automáticamente de **2 a 4 instancias**. En la prueba de falla se detuvo una instancia; Auto Scaling la reemplazó y después se comprobaron **cuatro destinos Healthy** en el balanceador. Esto demuestra recuperación, con el impacto HTTP registrado durante la prueba.

La consulta SQL inicial de visitas mostró 11 peticiones en una instancia y 9 en otra, para un total de 20. Es una comprobación inicial del reparto, no el resultado de las pruebas masivas. Los IDs históricos que aparecen en las estadísticas del sitio tampoco equivalen al número actual de instancias activas.

## Evidencias seleccionadas

Los enlaces siguientes apuntan a capturas que existen en la carpeta de evidencias. Los espacios y paréntesis de la ruta están codificados para que los enlaces funcionen en GitHub. `LEEME.txt` conserva observaciones de distintas etapas; los pendientes de entrega actuales se indican al final de este README.

| Evidencia | Captura |
|---|---|
| Red con subredes públicas y privadas | [06 — Mapa de la VPC](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/06_mapa_red_VPC.png) |
| Reparto inicial de visitas en PostgreSQL | [16 — Visitas por servidor y zona](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/16_SQL_visitas_por_servidor_y_zona.png) |
| Prueba base: 2000 peticiones | [22 — Resultado de ApacheBench](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/22_ApacheBench_prueba_base_2000_sin_fallos.png) |
| Escalado automático de 2 a 4 | [24 — Actividad de Auto Scaling](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/24_Actividad_escalado_automatico_de_2_a_4.png) |
| Carga sostenida: 1000000 peticiones | [25 — Resultado de ApacheBench](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/25_ApacheBench_carga_millon_sin_fallos.png) |
| Reemplazo automático tras detener una instancia | [28 — Actividad de reemplazo](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/28_AutoScaling_reemplazo_automatico_por_falla.png) |
| Impacto durante la falla: 5292 respuestas no 2xx | [29 — Resultado durante la falla](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/29_ApacheBench_durante_falla_respuestas_no_2xx.png) |
| Recuperación con cuatro destinos Healthy | [33 — Destinos del balanceador](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/33_balanceador_reemplazo_y_cuatro_destinos_Healthy.png) |
| Ruta personalizada disponible | [35 — GET /api/equipo con HTTP 200](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/35_API_equipo_publicada_HTTP_200.png) |
| Sitio personalizado y equipo confirmado por la API | [38 — Sitio de Redes II](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/38_sitio_personalizado_equipo_confirmado_por_API.png) |
| Lectura provisional de costos: 0.00 USD | [39 — Cost Explorer](Evidencias_Redes_II_AWS%20%281%29/Evidencias_Redes_II_AWS/39_CostExplorer_diario_lectura_provisional_0_USD.png) |

## Video

**Pendiente:** grabar o adjuntar el video de la demostración y agregar su enlace.

## Preparación para GitHub

Se incluyen código, plantilla, documentación y evidencias. `.gitignore` excluye `node_modules`, archivos `.env` con configuración local, claves privadas y copias `.bak`. Los ejemplos como `.env.example`, `.env.sample` y `.env.template` se conservan y deben contener solo valores de muestra, sin secretos.

Antes de publicar, revise `git status` y el contenido de los archivos que va a incluir. No suba contraseñas, credenciales ni claves privadas. El commit y el push quedan pendientes.

## Limpieza

Vaciar el bucket y eliminar la pila `PracticaIntegradora` (ver `comandos-cloudshell.sh`, bloque 7).

El bloque 7 elimina archivos y recursos. No ejecute todo el script de CloudShell de una sola vez; use únicamente el bloque que corresponda a la tarea prevista.

**Pendiente:** realizar y documentar la limpieza, guardar la evidencia del estado `DELETE_COMPLETE` y comprobar el inventario de recursos. La eliminación no se presenta como completada.
