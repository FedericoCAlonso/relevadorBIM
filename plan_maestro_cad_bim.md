# PLAN MAESTRO DE EVOLUCIÓN CAD/BIM Y REORGANIZACIÓN UI/UX
**Proyecto:** RelevadorBIM  
**Enfoque:** Relevamiento electromecánico y arquitectónico de campo  
**Arquitectura:** MVVM Estricto (React + Zustand + SVG CAD Engine)

---

## 1. Justificación y Objetivos Estratégicos

El objetivo de esta etapa es transformar el subsistema de muros y geometría en un **motor constructivo y arquitectónico riguroso** que:
1. Resuelva con precisión milimétrica las mediciones tomadas en obra (paramentos interiores y exteriores en lugar de ejes teóricos ciegos).
2. Genere encuentros limpios de esquinas en inglete (*Miter Joins*), eliminando las muescas y solapamientos actuales.
3. Reorganice los paneles de edición bajo una taxonomía limpia ("Arquitectura", "Instalaciones", "Ambientes"), eliminando rótulos técnicos obsoletos como "Muros & vano".
4. Integre la **vista de alzado / elevación de caras de muro** para inspección y replanteo vertical de cajas, cañerías y aberturas.
5. Siente las bases topológicas para la fase de **ruteo ortogonal automatizado de conductos (A\*)** considerando interferencias estructurales y constructivas.

---

## 2. Enjambre de Agentes Especialistas del Proyecto

Para asegurar que cada decisión técnica cuente con respaldo disciplinar riguroso y sin puntos ciegos, se formaliza el siguiente equipo de agentes:

```
                      ┌──────────────────────────────────────┐
                      │        COORDINADOR / LEAD BIM        │
                      └──────────────────┬───────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│   ARQUITECTURA   │           │  NORMATIVA AEA   │           │   UI/UX & MVVM   │
│   Y MEDIOS DE    │           │ ELECTROMECÁNICA  │           │   FRONTEND CAD   │
│  REPRESENTACIÓN  │           │                  │           │                  │
└──────────────────┘           └──────────────────┘           └──────────────────┘
```

### Roles y Responsabilidades:

1. **`arquitectura_bim_cad` (Especialista en Arquitectura y Medios de Representación):**
   - Vela por las convenciones de dibujo técnico (plano de corte a 1.20 m, espesores de trazo, proyecciones en cielorraso discontinuas, escaleras normalizadas y cotas).
   - Valida la topología de ingletes (*miter joins*), justificaciones de muro y cálculo de áreas útiles interiores.

2. **`normativa_aea_electromecanica` (Especialista en Normas AEA e Instalador Matriculado):**
   - Asegura el rigor de los cálculos eléctricos (caída de tensión, ocupación de cañerías, secciones admisibles según AEA 770/771).
   - Define las restricciones físicas reales de montaje: prohibición de picar hormigón, límites de 3 curvas y 12 m para cajas de paso, y distancias de resguardo en cuartos de baño.
   - Mantiene el enfoque de relevamiento objetivo (sin juicios punitivos de color rojo/verde).

3. **`ui_ux_frontend_mvvm` (Especialista en UI/UX y Arquitectura Frontend MVVM):**
   - Diseña interfaces minimalistas bajo el principio de *Progressive Disclosure* y *Cero Ruido Contextual*.
   - Optimiza la interacción táctil en la zona del pulgar (*Thumb-zone*) en móviles y paneles de inspección ágiles en escritorio.
   - Garantiza la separación estricta entre Modelos (`src/models/`), ViewModels (`src/viewmodels/`) y Vistas (`src/views/`).

4. **`negocio_producto_bim` (Especialista en Modelo de Negocio y Producto):**
   - Prioriza funcionalidades según el valor práctico real en campo para electricistas, arquitectos y peritos.
   - Supervisa que el flujo de cotización, cómputo de materiales y exportación de informes responda a la realidad comercial de obra.

---

## 3. Reorganización de UI/UX: Nueva Taxonomía de Paneles

### Situación Actual vs. Nueva Taxonomía Unificada:
Actualmente, el panel lateral y los selectores tienen divisiones técnicas históricas como `"Muros & vano"`, `"spaces"`, `"survey"`.

### Nueva Estructura de Pestañas y Paneles (Desktop & Mobile Drawer):

```
[ ☰ Menú ]   RelevadorBIM · Planta Baja       [ 👁 Capas ]  [ Cotas ]  [ ⛶ ]
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  TABS PRINCIPALES (Inspector Lateral):                                │
│  ┌─────────────────┬───────────────────┬─────────────────┐            │
│  │ 🏛 Arquitectura │ ⚡ Instalaciones   │ 📐 Ambientes    │            │
│  └─────────────────┴───────────────────┴─────────────────┘            │
│                                                                       │
│  SUB-SECCIÓN ARQUITECTURA:                                            │
│  • Trazado de Muros (con selector de justificación: Int / Eje / Ext)  │
│  • Tipología constructiva: Estándar | Muro bajo | Baranda/Reja | H°A° │
│  • Elementos Estructurales: Columnas y Vigas de cielorraso            │
│  • Aberturas: Puertas, Ventanas, Portones y Vanos                     │
│                                                                       │
│  SUB-SECCIÓN INSTALACIONES:                                           │
│  • Bocas, Tomas, Tableros y Equipamiento                              │
│  • Canalizaciones (Cañerías y Bandejas con selector de tecnología)   │
│  • Circuitos y Protecciones                                           │
│                                                                       │
│  SUB-SECCIÓN AMBIENTES:                                               │
│  • Nombres y Categorías funcionales                                   │
│  • Condición de cubierta: Cubierto | Semicubierto | Vacío / Patio     │
│  • Alturas de cielorraso y cotas de NPT                               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. Plan de Ejecución por Fases

### Fase 1: Geometría Crítica de Muros y Justificación de Paramentos (Completada)
1. **Línea de Justificación de Muro (`WallJustification`):**
   - Incorporación al modelo `Wall` de las opciones de referencia: `interior_face` (por defecto en relevamiento interno), `exterior_face` y `centerline`.
   - Ingreso de medidas métricas donde $L$ corresponde a la cara física seleccionada.
2. **Motor de Encuentros en Esquina (*Corner Miter Engine*):**
   - Intersección analítica de rectas de paramentos exteriores e interiores.
   - Prolongación geométrica con inglete en la bisectriz de esquina.
   - Eliminación de muescas vacías y solapamientos en SVG.
3. **Reorganización de UI:** Reestructuración de la pestaña `Arquitectura` en el inspector lateral y dock móvil.

### Fase 2: Elementos Constructivos y Restricciones Físicas de Montaje (Completada)
1. **Tipologías Constructivas de Muros:**
   - Variantes `low_wall` (muro bajo/antepecho $1.00\text{ m}$) y `railing` (baranda/reja) con grafismo diferenciado.
   - Restricción física de montaje: forzar montaje exterior en rejas y limitar cota $Z$ en muros bajos.
2. **Columnas de Hormigón Armado y Acero (`StructuralColumn`):**
   - Inserción con snap a vértices, secciones rectangulares y cilíndricas ($\varnothing$).
   - Representación maciza/rayada y delimitación de **zonas de exclusión de canaleteado** (prohibición de ranurado).
3. **Proyecciones de Cielorraso y Vigas (`Beam` / `CeilingProjection`):**
   - Vigas descolgadas bajo losa con trazo discontinuo (`- - - -`).
   - Caracterización reglamentaria de vacíos (aspa en cruz "X" en patios de aire y luz) y tramado en plenos técnicos.

### Fase 3: Vista de Alzado / Elevación de Caras de Muro (Wall Elevation View) (En curso / Próxima prioridad)
*(Inspección vertical, replanteo 2D a escala real y edición interactiva de paramentos)*
1. **Apertura de la Vista y Contexto Operativo:**
   - Disparador ergonómico al seleccionar un muro en planta: botón interactivo `[ ⊞ Ver Alzado ]` en inspector/sheet y atajo por doble clic/toque en lienzo.
   - Selector de visualización de paramento: **Cara Interior** (predeterminada de ambiente) vs **Cara Exterior**.
2. **Representación Física Real a Escala Constructiva (SVG 2D Desplegado):**
   - Desarrollo longitudinal de $0$ a $L$ en abscisa ($X$) y de $0.00\text{ m}$ (NPT) a $H$ (altura libre a losa/cielorraso) en ordenada ($Y$).
   - **Aberturas en Alzado:** Posicionamiento exacto de puertas, ventanas y vanos con su dintel, luz libre y antepecho (`sillHeight`).
   - **Cajas y Gabinetes Eléctricos:** Renderizado visual a escala 1:1 de cajas rectangulares ($5 \times 10\text{ cm}$ con troqueles), cuadradas de derivación ($10 \times 10\text{ cm}$), octogonales de apliques de pared y gabinetes de tablero secundario.
   - **Canalizaciones y Bajadas:** Trazado de cañerías en pared a escala métrica según diámetro comercial ($\varnothing 19$, $\varnothing 22$, $\varnothing 25\text{ mm}$), bajadas directas desde losa y recorridos ortogonales.
3. **Edición Bidireccional e Imantación Reglamentaria:**
   - Arrastre interactivo de cajas sobre el paramento:
     - Movimiento horizontal: actualiza la distancia a la esquina de referencia ($U$).
     - Movimiento vertical: actualiza la cota $Z$ con snap magnético a alturas estándar AEA ($0.30\text{ m}$ tomas, $1.10\text{ m}$ llaves/pulsadores, $2.00\text{ m}$ tomas altos, $2.20\text{ m}$ apliques).
   - Sincronización reactiva inmediata: los cambios efectuados en el alzado impactan en la planta CAD y en el cómputo métrico sin recargar la escena.
4. **Acotación Automática Integrada:**
   - Cotas lineales acumuladas desde la esquina de referencia a bordes de aberturas y ejes de cajas.
   - Cotas de nivel altimétricas reglamentarias respecto al piso terminado ($+0.00$, $+0.30$, $+1.10$, $+2.00$, $+H$).

### Fase 4: Motor de Ruteo Ortogonal de Conductos (A\* Pathfinding en Grafo 2.5D) (Planificada)
*(Generación asistida y optimizada de recorridos según restricciones de tecnología y normativa)*
1. **Grafo Ortogonal 2.5D:** Construcción de nodos de navegación tridimensional conectando planos de losa, contrapiso y paramentos verticales de muros.
2. **Matriz de Fricción y Costos:** Penalizaciones topológicas según tecnología de canalización (embutido en ladrillo vs a la vista vs bandeja perforada).
3. **Restricciones AEA Automatizadas:**
   - Inserción automática de cajas de paso intermedias al superar 3 curvas de 90° o tramos mayores a 12–15 metros.
   - Prohibición de cruces diagonales y zonas de exclusión por cañerías de agua o gas.
4. **Sugerencia Interactiva y Waypoints:** Previsualización de ruta óptima con anclajes elásticos para que el proyectista ajuste la trayectoria a criterio.

---

## 5. Criterios de Aceptación y Control de Calidad
- [x] Las esquinas de muros a 90° y ángulos oblicuos cierran de forma continua sin huecos en la cara exterior (Fase 1).
- [x] La medida ingresada en modo paramento interior refleja exactamente la luz libre del ambiente (Fase 1).
- [x] Las columnas, vigas, muros bajos, barandas y vacíos se modelan y renderizan en planta respetando convenciones gráficas (Fase 2).
- [ ] La vista de alzado de muro proyecta fielmente aberturas, cajas y cañerías con sus cotas $Z$ métricas reales (Fase 3).
- [ ] La manipulación de cajas en la vista de alzado actualiza bidireccionalmente la planta CAD y el estado centralizado del proyecto (Fase 3).
- [ ] Ningún cálculo de vectores ni opciones hardcodeadas residen en componentes `.tsx` de la vista.
- [ ] El suite completo de pruebas unitarias (`npm test`) y la compilación (`npm run build`) pasan al 100% sin advertencias.
