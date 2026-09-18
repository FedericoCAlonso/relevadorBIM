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

## 3. Relevamiento Electromecánico de Campo (Instalaciones Existentes y Nuevas)

1. **Enfoque Objetivo de Relevamiento (Cero Juicio Normativo):**
   - El sistema es una herramienta de **relevamiento físico objetivo**.
   - **Prohibido:** Mostrar semáforos verde/rojo de cumplimiento, banners de advertencia sobrepasada de normas o textos punitivos ("No reglamentario", etc.).
   - No forzar ni exigir selectores de tensión nominal de red ni normas específicas; la ocupación de conductos se presenta como dato técnico informativo y neutral.
2. **Catálogo Abierto en 3 Categorías Físicas Rígidas:**
   - **Canalizaciones:** Caños metálicos, plásticos, mangueras y bandejas perforadas. Permite agregar y quitar tipos personalizados.
   - **Conductores:** Unipolares, sintenax, taller, tela/goma y alambres. Abierto a nuevos tipos.
   - **Cajas y Gabinetes:** Rectangulares, octogonales, cuadradas de paso, mignon y gabinetes de tablero.
3. **Cálculo de Trayectorias Ortogonales:**
   - Las longitudes de cañería se miden siguiendo trayectorias ortogonales en escuadra:
     $$L = (|dx| + |dy| + \Delta Z_{\text{local}} + \Delta Z_{\text{losas}}) \times 1.10$$
   - Contempla el recorrido por pared/losa, los desniveles de montaje de las bocas y el factor del 10% por curvas y holgura.
4. **Cajas de Paso y Circuitos en Tránsito:**
   - **En Bocas:** Distinción explícita entre el circuito asignado de alimentación y los circuitos en tránsito / paso que solo atraviesan la caja física.
   - **Metadatos Técnicos y Mediciones Libres:** Las bocas cuentan con un arreglo clave-valor `attributes: Array<{ key: string; value: string }>` para registrar mediciones de campo (PAT en $\Omega$, tensiones $V_{fn}$, $V_{ft}$, $V_{nt}$, aislación en $\text{M}\Omega$, corriente, tiempos de disparo, etc.).

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

---

## 6. Principios SOLID e Higiene de Código (Clean Code)

1. **Responsabilidad Única (Single Responsibility Principle - SRP):**
   - Cada módulo, clase o función debe tener un único motivo de cambio.
   - Las responsabilidades de cálculo físico, ruteo métrico 3D, algoritmos CAD/SVG y etiquetado relacional deben vivir en submódulos de dominio aislados e independientes (ej. `conduitMetrics.ts`, `electricalPhysics.ts`, `cadGeometry.ts`, `elementLabelling.ts`), unificados mediante fachadas limpias si es necesario para retrocompatibilidad.
2. **Abierto / Cerrado (Open/Closed Principle - OCP):**
   - El sistema debe ser extensible a nuevos materiales, normas de cable, tipos de bocas o dispositivos de maniobra sin modificar los algoritmos centrales de cálculo ni las vistas.
   - Los catálogos y presets se consumen por inyección o registro, nunca mediante bifurcaciones `switch/case` rígidas en los componentes.
3. **Sustitución de Liskov (Liskov Substitution Principle - LSP):**
   - Las entidades que comparten interfaces polimórficas (ej. `SpatialElectricalNode` implementado por bocas y tableros) deben poder sustituirse mutuamente sin alterar el comportamiento de las canalizaciones ni requerir conversiones forzadas (`as any`).
4. **Segregación de Interfaces (Interface Segregation Principle - ISP):**
   - Preferir interfaces y props pequeñas, cohesivas y especializadas en lugar de contratos monolíticos con propiedades innecesarias.
5. **Inversión de Dependencias (Dependency Inversion Principle - DIP):**
   - Los módulos de alto nivel (vistas, orquestadores) no deben depender directamente de detalles de bajo nivel o mutaciones de estado no gestionadas. Toda comunicación fluye a través de contratos expuestos por el ViewModel y almacenes de estado centralizados.
6. **Higiene de Código y Cero Advertencias:**
   - **Cero código muerto:** Prohibido dejar funciones no invocadas, variables no leídas, imports huérfanos o archivos en desuso.
   - **Cero advertencias de linter (`oxlint` / `eslint`):** Ningún commit debe introducir advertencias de dependencias faltantes en hooks (`exhaustive-deps`), accesos fuera de tiempo (`TDZ`), impurezas en render ni llamadas síncronas a `setState` dentro de `useEffect`.
   - **Manejo de Eventos y Callbacks Estables:** Para listeners globales de ventana o gestos CAD de alta frecuencia, sincronizar funciones dinámicas mediante referencias estables (`useRef` / `useEffectEvent`) para evitar re-suscripciones innecesarias o invalidaciones en cascada de capas SVG memoizadas.
