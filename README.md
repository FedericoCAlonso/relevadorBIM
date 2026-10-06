# Relevador BIM — Arquitectura, Estructura y Red Eléctrica AEA 90364-771

PWA profesional para relevamiento planimétrico por anclajes métricos de referencia, modelado arquitectónico/estructural BIM 2D y diseño de instalaciones electromecánicas según normativa AEA 90364-771.

## 🚀 Despliegue en Producción (GitHub Pages)

👉 **[https://federicocalonso.github.io/relevadorBIM/](https://federicocalonso.github.io/relevadorBIM/)**

---

## ✨ Módulos y Capacidades del Sistema

### 1. 🏛️ Arquitectura & Estructura (CAD / BIM)
- **Trazado Secuencial por Anclajes Físicos**: Medición tramo a tramo fijando rumbos ortogonales (Der 90°, Izq -90°, Recto 0° o ángulo libre de falsa escuadra).
- **Gestión Integral de Muros**: Edición paramétrica de longitud, espesores estándar (10, 15, 20, 30 cm), justificación de trazo (cara interior, eje medio, cara exterior), rotación e inversión de sentido.
- **Tipologías de Cerramientos**:
  - *Muro Estándar*: Hasta losa/techo.
  - *Muro Bajo / Antepecho*: Altura parametrizable (ej: 1.00 m) que condiciona bajadas de cañerías.
  - *Barandas y Rejas*: Cerramiento permeable con línea discontinua sin masa ciega para canalizaciones superficiales.
- **Entidades Estructurales e Interferencias**:
  - *Columnas H°A° y Acero*: Secciones rectangulares y cilíndricas ($\varnothing$), rotación sexagesimal y cálculo geométrico de sección interior que delimita **zonas de exclusión de canaleteado** (prohibido ranurar hormigón armado).
  - *Vigas Salientes Bajo Losa*: Cuelgues paramétricos ($15\times30$, $20\times30$, $20\times40$, $20\times50\text{ cm}$) con proyección de discontinuidad de cielorraso.
- **Aberturas Paramétricas**: Puertas batientes (con mano izquierda/derecha e interior/exterior), ventanas con antepecho y vanos libres acotados respecto a esquinas de muro.

### 2. 🧭 Ambientes y Recintos (BIM)
- **Detección Planar de Caras (Half-Edge Traversal)**: Identificación topológica rigurosa de recintos cerrados orientados en sentido antihorario.
- **Vacíos Arquitectónicos y Patios de Aire y Luz**: Representación técnica reglamentaria con aspa diagonal en cruz ("X") sobre huecos de losa.
- **Plenos Técnicos / Montantes MEP**: Tramado rayado mecánico para identificación de conductos y pases verticales entre plantas.
- **Cómputo Automático de Superficies**: Cálculo de perímetro, superficie ($m^2$) y tipología de cubierta (cubierto, semicubierto, descubierto, vacío).

### 3. ⚡ Instalaciones Eléctricas (Norma AEA 90364-771)
- **Simbología Oficial AEA 90364-771 Pura**: Catálogo vectorial completo de iluminación, tomacorrientes (TUG, TUE), tomas dedicados, interruptores y tableros.
- **Snap Magnético a Muros con Orientación Automática**: Detección de paramentos, posición flush sobre paramento y alineación angular de cajas.
- **Topología de Red y Canalizaciones**: Trazado ortogonal (90°) y esquemático curvo en piso, losa o pared; cálculo de longitud real $L = (|dx| + |dy| + \Delta Z) \times 1.10$.
- **Cálculo de Secciones y Ocupación de Cañerías**: Verificación del factor de llenado reglamentario, conductores unipolares IRAM NM 247-3, cables subterráneos IRAM 2178 y asignación de circuitos en tránsito.
- **Tableros Principales y Seccionales**: Distribución monofásica y trifásica, protecciones termomagnéticas y diferenciales.

### 4. 📐 Láminas de Fondo (Underlays PDF / Raster)
- Co-registro y calado de planos arquitectónicos existentes.
- Calibración de escala métrica de dos puntos y herramientas de alineación gráfica.

### 5. 📱 UX / UI Adaptativa Dual (MVVM)
- **Escritorio**: Inspector CAD lateral completo con atajos de teclado (`Enter`, `Ctrl+Z`, `Supr`, `Esc`, `Espacio` para paneo).
- **Móvil / Tablet**: `ThumbSurveyDock` ergonómico optimizado para campo en zona natural del pulgar e integración directa con distanciómetros láser Bluetooth (BLE).

---

## 🗺️ Plan Maestro de Desarrollo

El proyecto se estructura bajo el [Plan Maestro CAD/BIM](plan_maestro_cad_bim.md) y cuenta con directivas mandatorias de arquitectura MVVM y buenas prácticas en [AGENTS.md](AGENTS.md).

- **Fase 1**: Reorganización de Paneles y Nomenclatura BIM (Completada).
- **Fase 2**: Entidades Arquitectónicas y Estructurales de Interferencia (Completada).
- **Fase 3**: Vista de Alzado / Elevación de Caras de Muro (En curso).
- **Fase 4**: Ruteo Asistido / Pathfinding de Canalizaciones (Planificada).

---

## 🛠️ Comandos de Desarrollo

```bash
# Instalación de dependencias
npm install

# Servidor de desarrollo
npm run dev

# Pruebas unitarias (Vitest)
npm test -- --run

# Linter (Oxlint)
npm run lint

# Compilación TypeScript y Vite
npm run build

# Despliegue a GitHub Pages
npm run deploy
```
