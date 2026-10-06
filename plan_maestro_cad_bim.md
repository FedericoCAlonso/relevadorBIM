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
4. Siente las bases topológicas para la futura fase de **ruteo ortogonal automatizado de conductos (A\*)** considerando interferencias estructurales y constructivas.

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

### Fase 1: Geometría Crítica de Muros y Justificación de Paramentos (Prioridad Inmediata)
> [!IMPORTANT]
> Esta fase resuelve el problema de fondo del dibujo de muros antes de avanzar con nuevas entidades.

1. **Línea de Justificación de Muro (`WallJustification`):**
   - Incorporar al modelo `Wall` la opción de referencia: `interior_face` (por defecto en relevamiento interno), `exterior_face` y `centerline`.
   - Ajustar el ingreso de medidas métricas para que $L$ corresponda a la cara seleccionada.
2. **Motor de Encuentros en Esquina (*Corner Miter Engine*):**
   - Calcular analíticamente la intersección de rectas de caras exteriores ($P_{\text{ext}} = L_{1,\text{ext}} \cap L_{2,\text{ext}}$) e interiores ($P_{\text{int}} = L_{1,\text{int}} \cap L_{2,\text{int}}$).
   - Alargar automáticamente la cara exterior con el inglete correspondiente a la bisectriz de la esquina.
   - Eliminar muescas vacías y solapamientos en el renderizado SVG.
3. **Reorganización de UI:** Renombrar y estructurar la pestaña `Arquitectura` en el inspector.

### Fase 2: Elementos Constructivos y Restricciones Físicas de Montaje
1. **Tipologías Constructivas de Muros:**
   - Variantes `low_wall` (muro bajo/antepecho $1.00\text{ m}$) y `railing` (baranda/reja) con grafismo diferenciado.
   - Restricción de montaje eléctrico: forzar montaje exterior en rejas y limitar cota $Z$ en muros bajos.
2. **Columnas de Hormigón Armado (`StructuralColumn`):**
   - Herramienta de inserción por estampado (*stamp tool*) con snap a vértices.
   - Representación gráfica maciza/rayada y sustracción del área útil del ambiente.
3. **Proyecciones de Cielorraso y Vigas (`Beam` / `CeilingProjection`):**
   - Trazo de eje a eje con línea discontinua (`- - - -`).
   - Caracterización de vacíos (cruz en aspa para patios de aire y luz en `Space`).

### Fase 3: Motor de Ruteo Ortogonal de Conductos (A\* Pathfinding en Grafo 2.5D)
*(Etapa planificada a futuro pero preparada a nivel topológico desde las Fases 1 y 2)*
1. Construcción del grafo ortogonal de navegación constructiva (Planos de Losa, Piso y Paredes verticales).
2. Asignación de costos de fricción y penalizaciones según la tecnología de canalización (embutido vs a la vista vs bandeja).
3. Detección automática de cajas de paso intermedias por regla AEA (máximo 3 curvas de 90° o 12-15 metros).
4. Sugerencia interactiva de ruta óptima con control elástico de *waypoints* para el usuario.

---

## 5. Criterios de Aceptación y Control de Calidad
- [ ] Las esquinas de muros a 90° y ángulos oblicuos cierran de forma continua sin huecos en la cara exterior.
- [ ] La medida ingresada en modo paramento interior refleja exactamente la luz libre del ambiente.
- [ ] Ningún cálculo de vectores ni opciones hardcodeadas residen en componentes `.tsx` de la vista.
- [ ] El suite completo de pruebas unitarias (`npm test`) y la compilación (`npm run build`) pasan al 100% sin advertencias.
