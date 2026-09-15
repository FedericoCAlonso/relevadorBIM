# DIRECTIVAS MANDATORIAS PARA AGENTES — RELEVADORBIM

Este documento establece las directivas técnicas, arquitectónicas, normativas y de experiencia de usuario que **TODO AGENTE** debe cumplir de forma irrestricta en todas las encomiendas sobre este proyecto.

---

## 1. Arquitectura y Patrón MVVM Estricto

1. **Separación de Responsabilidades:**
   - **Modelo (`src/models/`):** Entidades de dominio puro (arquitectura, electricidad, relevamiento), constantes de cálculo, catálogos oficiales y fórmulas matemáticas/geométricas puras.
   - **ViewModel (`src/viewmodels/`):** Gestión del estado reactivo (Zustand y custom hooks), orquestación de comandos, validaciones de negocio y derivaciones calculadas.
   - **Vista (`src/views/`):** Componentes React puramente declarativos.
2. **Prohibición Terminante de Código Hardcodeado:**
   - **Cero números mágicos:** Toda constante física, factor reglamentario o valor por defecto debe provenir de catálogos y constantes centralizadas en el Modelo (ej. `AEA_CALCULATION_CONSTANTS`, `electricalStandards.ts`).
   - **Cero opciones o strings mágicos en vistas:** Ningún componente `.tsx` de la vista debe definir arreglos de opciones, listas de materiales, colores hexadecimales manuales ni textos normativos incrustados. Todo se consume desde el ViewModel o los catálogos del Modelo.
   - **Cero lógica de cálculo en vistas:** Las vistas nunca proyectan vectores, no suman metros, no calculan caídas de tensión ni porcentajes de ocupación; únicamente renderizan propiedades expuestas por el ViewModel.

---

## 2. Experiencia de Usuario (UI / UX) y Principio de Cero Ruido Contextual

1. **Divulgación Progresiva (*Progressive Disclosure*):**
   - El usuario solo debe ver la información y controles estrictamente necesarios para la tarea que está ejecutando en ese contexto.
   - Evitar saturar la pantalla con explicaciones extensas, badges innecesarios o botones administrativos fuera de lugar.
2. **Contexto de Relevamiento / Dibujo (Lienzo CAD):**
   - El plano debe tener el **máximo espacio visual libre**.
   - **Barra Superior (`TopStatusBar`):** Mantenerla minimalista y compacta:
     ```
     [ ☰ Menú ]   RelevadorBIM · Nivel               [ Cotas ]  [ ⛶ ]
     ```
   - **Prohibido:** Colocar botones de cotización, exportación o reseteo flotando permanentemente sobre el área de dibujo.
3. **Menú Desplegable / Drawer Principal:**
   - Las operaciones globales de archivo, configuración y exportación deben vivir resguardadas dentro del menú desplegable accesible mediante `[ ☰ ]`.
   - En dispositivos móviles, presentar como un Bottom Sheet táctil optimizado para operación con pulgar.
4. **Contexto de Modales de Inspección:**
   - Mostrar únicamente los controles aplicables al elemento seleccionado (ocultar opciones de pared si la boca es de techo, etc.).
   - Entradas numéricas claras con pasos lógicos y presets de un toque.

---

## 3. Reglamentación Eléctrica Argentina (AEA 90364-771 e IRAM)

1. **Prioridad y Catálogo de Canalizaciones:**
   El orden de presentación y selección en todo el sistema debe respetar estrictamente:
   1. **Caño Hierro Semipesado RS (IRAM-IAS U 500-2604)** — *Opción por defecto en toda cañería nueva*.
   2. **Hierro Liviano RL (IRAM-IAS U 500-2005)**.
   3. **Caño PVC Rígido Métrico (IRAM 62386-21)**.
   4. **Corrugado Blanco PVC (IRAM 62386-22)**.
   5. **Bandeja Perforada de 20 (IRAM / AEA 771.12.5)**.
2. **Medidas Específicas según Material de Conducto:**
   - Cada material posee su propia lista de calibres normalizados (`CONDUIT_SIZES_BY_MATERIAL`).
   - Los caños cilíndricos utilizan diámetros nominales (RS 16 a RS 51, métricos Ø16 a Ø63 mm).
   - Las **bandejas perforadas** utilizan dimensiones rectangulares reales ($Ancho \times Ala 20\text{ mm}$, ej: 50×20, 100×20, 200×20 mm) y su sección útil para cálculo de llenado es su área rectangular ($W \times H$).
3. **Cálculo de Trayectorias Ortogonales:**
   - Las longitudes de cañería deben medirse siguiendo trayectorias ortogonales estrictas:
     $$L = (|dx| + |dy| + \Delta Z_{\text{local}} + \Delta Z_{\text{losas}}) \times 1.10$$
   - Contempla el recorrido en escuadra por pared/losa, los desniveles de montaje de las bocas y el factor reglamentario del 10% por curvas y desperdicios.
4. **Factor de Ocupación Reglamentario:**
   - Límite máximo admisible del **35%** de la sección interna útil de la cañería (AEA 90364-771.12.3.4).
5. **Circuitos Múltiples y Cajas de Paso:**
   - **En Cañerías:** Soporte de multi-circuito con advertencia preventiva si se superan los 3 circuitos terminales monofásicos del mismo tablero (AEA 771.12.3).
   - **En Bocas:** Distinción explícita entre el **circuito asignado de alimentación** (energiza el artefacto local) y los **circuitos en tránsito / paso** (conductores que atraviesan la caja física).
   - **Metadatos Técnicos Libres:** Las bocas deben soportar un arreglo clave-valor `attributes: Array<{ key: string; value: string }>` (modelo TRAZA), inicializado en `[]` por defecto, con capacidad completa de alta, baja y modificación.

---

## 4. Algoritmos Geométricos y Ambientes (BIM)

1. **Detección Planar de Recintos Cerrados:**
   - La identificación de ambientes debe realizarse mediante **Extracción de Caras Planas de un Grafo de Muros (Half-Edge Planar Traversal)** con ordenación angular polar y giro a la izquierda.
   - **Prohibido:** Usar algoritmos de búsqueda DFS ingenua de ciclos en grafos que generen falsos ambientes compuestos (unión de habitaciones adyacentes) o que detecten el perímetro exterior como ambiente.
   - Solo se registran como ambientes los ciclos con orientación antihoraria y área positiva mayor a $0.05 \text{ m}^2$.
2. **Preservación Multinivel:**
   - La autodetección de ambientes en el nivel activo nunca debe sobrescribir ni eliminar los ambientes de otros niveles/plantas del proyecto.

---

## 5. Pruebas Unitarias, Control de Calidad y Despliegue Remoto

1. **TDD y Cobertura Automatizada:**
   - Toda nueva lógica de cálculo, catalogación o algoritmo geométrico debe contar con sus correspondientes pruebas unitarias en **Vitest** (`src/**/__tests__/*.test.ts`).
   - El test suite (`npm test`) y la compilación TypeScript (`npm run build`) deben pasar al 100% sin advertencias ni errores antes de confirmar cambios.
2. **Sincronización y Despliegue Continuo (CI/CD Local):**
   - Dado que el usuario opera en remoto, al finalizar cada bloque funcional se debe:
     1. Ejecutar `npm test -- --run && npm run build`.
     2. Hacer commit descriptivo (`git commit -m "..."`).
     3. Subir a GitHub (`git push origin main`).
     4. Desplegar a GitHub Pages (`npm run deploy`).
3. **Respeto a las Instrucciones del Usuario:**
   - Si el usuario indica *"no programes"*, priorizar el análisis arquitectónico, conceptual y de diseño. No ejecutar escrituras ni modificaciones de código hasta recibir la confirmación explícita.
