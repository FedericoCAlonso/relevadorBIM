# Pipeline de reconocimiento de símbolos — Croquizador

## Contexto

Herramienta para extraer información de planos eléctricos (PDF / capturas) mediante muestreo de símbolos por el usuario. El usuario marca un símbolo con una herramienta de selección tipo "stencil" (tamaño fijo definido por la primera muestra, rotación libre) y la aplicación busca patrones similares en el resto del plano. La precisión mejora agregando más muestras.

**Problema actual a resolver:** el sistema funciona razonablemente bien, pero agregar muestras nuevas no mejora la precisión de forma significativa. Diagnóstico: las muestras no se alinean entre sí antes de compararse/combinarse, por lo que cada muestra nueva aporta tanto ruido (por desalineamiento) como señal útil.

**Stack:** TypeScript (PWA). Librerías sugeridas: `ml-matrix` (SVD, autovalores, álgebra matricial). El resto de las funciones de procesamiento de imagen se implementan a mano en TS puro, sin OpenCV.js — ver notas de implementación en cada paso. Se evita OpenCV.js deliberadamente por el peso del bundle WASM (~8-10MB) frente a un conjunto acotado de funciones que no lo justifican en una PWA.

---

## Paso 0 — Preprocesamiento individual de cada muestra

**Entrada:** recorte crudo (imagen RGB) tomado con el stencil.
**No depende de otras muestras — corre una vez por muestra, apenas se captura.**

1. **Extracción de color dominante** (antes de descartar color): sobre los píxeles que luego el Paso 0.3 identifique como parte del trazo, calcular el color dominante (moda o mediana en espacio Lab, no RGB, para tolerancia a antialiasing). Implementación: conversión RGB→Lab con la fórmula estándar (RGB→XYZ→Lab, constantes documentadas, ~30 líneas TS puro, sin librería), y cuantización por *nearest-neighbor* (distancia euclídea en Lab) contra una tabla fija y chica de colores candidatos — la paleta detectada en el plano, o la paleta ACI de AutoCAD si aplica. No hace falta k-means genérico: la paleta ya es chica y conocida de antemano. Guardar como metadato de la muestra — se usa en el Paso 6 como filtro previo, nunca como dependencia dura, porque el mapeo color→símbolo es arbitrario y puede no existir en todos los planos.
2. **Escala de grises + binarización.** Umbral de Otsu sobre el recorte → imagen binaria trazo/fondo. Implementación: histograma de 256 buckets + búsqueda del umbral que maximiza la varianza entre clases fondo/trazo — algoritmo corto y cerrado, ~20-30 líneas TS puro.
3. **Esqueletización** (thinning, algoritmo de Zhang-Suen). Reduce el trazo a líneas de 1 píxel de ancho — necesario para que el grosor variable del trazo (compresión del PDF, resolución de captura) no contamine los pasos geométricos siguientes. Implementación: recorrido iterativo de vecindario 3×3 sobre la imagen binaria hasta convergencia — más largo que los anteriores (~80-150 líneas con los casos borde bien cubiertos), pero mecánico y bien documentado; buscar una implementación TS pura de referencia (sin WASM) antes de escribirlo desde cero.
4. **Extracción de puntos.** De la imagen esqueletizada, extraer las coordenadas `(x, y)` de los píxeles activos → nube de puntos `P`.

**Salida por muestra:** nube de puntos `P`, color dominante cuantizado.

---

## Paso 1 — Alineación individual por ejes principales (PCA)

**Entrada:** nube de puntos `P` de la muestra.
**No depende de otras muestras — resuelve la alineación gruesa sin necesitar una referencia externa.**

1. Centroide: `p̄ = mean(P)`. Centrar: `P' = P - p̄`.
2. Matriz de covarianza 2×2: `C = (1/n) · P'ᵀ P'`.
3. Autovalores/autovectores de `C` (closed-form 2×2, o `eigh` de `ml-matrix`).
4. Resolver ambigüedad de signo del autovector principal: elegir el signo tal que la masa de puntos quede mayoritariamente del lado positivo del eje (criterio fijo, aplicado siempre igual).
5. Rotar `P'` para que el autovector principal coincida con el eje horizontal de referencia.

**Salida:** nube de puntos centrada y en orientación canónica + los dos autovalores de `C` (guardarlos — son un descriptor invariante a rotación, útil como filtro barato en el Paso 6).

**Caso borde:** si el cociente entre autovalor mayor/menor es cercano a 1 (símbolo casi simétrico), este paso es inestable. Marcar la muestra para no usarla en la alineación fina automática del Paso 3 (o para revisión manual).

---

## Paso 2 — Rasterizado a tamaño canónico

Convertir la nube de puntos alineada del Paso 1 de vuelta a una imagen de tamaño fijo (el tamaño del stencil), con interpolación bicúbica o Lanczos (nunca nearest-neighbor, para no degradar los bordes finos del trazo).

**Salida:** todas las muestras como imágenes del mismo tamaño, en orientación canónica — comparables entre sí, listas para vectorizar.

---

## Paso 3 — Refinamiento fino de alineación (Generalized Procrustes Analysis)

Corrige lo que el Paso 1 deja aproximado (asimetrías en el ruido que sesgan levemente el eje principal calculado).

1. Tomar cualquier muestra alineada como referencia inicial `R₀`.
2. Para cada muestra, calcular la transformación rígida óptima contra `R₀` vía **Kabsch/Procrustes ortogonal**: centrar ambas nubes de puntos correspondientes, `H = Pᵀ Q`, SVD de `H = U Σ Vᵀ`, rotación óptima `= V Uᵀ`.
3. Promediar todas las muestras ya alineadas → nueva referencia `R₁`.
4. Repetir 2–3 contra `R₁` hasta que la referencia deje de cambiar significativamente (pocas iteraciones, típicamente).

**Por qué importa:** ninguna muestra individual es "pura" (todas pueden tener oclusiones), así que la referencia no puede ser una muestra fija — tiene que emerger del consenso del promedio iterado.

**Salida:** conjunto de muestras finamente alineadas entre sí.

---

## Paso 4 — Separación símbolo/ruido (Robust PCA — implementar manualmente)

**Entrada:** matriz `A` (cada columna = una muestra alineada del Paso 3, vectorizada/aplanada).

Resolver Principal Component Pursuit: minimizar `‖L‖* + λ‖S‖₁` sujeto a `A = L + S`, vía Inexact Augmented Lagrange Multiplier (ALM). Es un loop corto que alterna:
- Soft-thresholding de los valores singulares de `(A - S + μ⁻¹Y)` para actualizar `L`.
- Soft-thresholding elemento a elemento de `(A - L + μ⁻¹Y)` para actualizar `S`.
- Actualización del multiplicador de Lagrange `Y` y del parámetro de penalización `μ`.

`λ` inicial sugerido: `1 / √(max(m, n))` (m = píxeles por muestra, n = cantidad de muestras) — ajustar empíricamente según cuánto ruido/oclusión haya en la práctica.

**Salida:** `L` = versión limpia de bajo rango del símbolo (estructura compartida por todas las muestras); `S` = lo que cada muestra tenía de particular (oclusiones, líneas cruzadas).

---

## Paso 5 — Construcción del descriptor de matching

1. SVD de `L` → los primeros vectores singulares (mayor valor singular) forman el **subespacio de referencia** del símbolo.
2. Guardar el promedio de los autovalores de covarianza del Paso 1 (sobre las muestras limpias) como descriptor invariante rápido, para el filtro barato del Paso 6.
3. Guardar también el/los color(es) dominante(s) cuantizado(s) recolectados en el Paso 0.

---

## Paso 6 — Matching contra el plano completo

Para cada región candidata detectada en el plano:

1. **Filtro de color (barato, opcional):** comparar el color dominante cuantizado de la región contra el guardado en el Paso 5. Si no coincide, descartar sin seguir procesando — esto ahorra el costo de los pasos geométricos en la mayoría de las regiones. Nunca usar como filtro absoluto si el plano no respeta convención de color consistente (configurable por plano, no global).
2. Repetir Pasos 0–2 sobre la región candidata (binarizar, esqueletizar, extraer puntos, alinear por PCA, rasterizar a tamaño canónico) — esto da la orientación del candidato automáticamente, sin necesidad de barrer ángulos.
3. **Filtro geométrico rápido:** comparar los autovalores de covarianza del candidato contra los del Paso 5 — descartar si están lejos (early rejection barato, antes de la proyección al subespacio).
4. **Filtro fino:** proyectar el candidato (vectorizado) sobre el subespacio de `L` del Paso 5, calcular el residuo de reconstrucción. Residuo bajo → match.

---

## Resumen de la causa raíz del síntoma actual

Si hoy el sistema no aplica alineación explícita (Pasos 1 y 3) antes de comparar o combinar muestras, cada muestra nueva queda en una orientación ligeramente distinta respecto a las anteriores — diluyendo la señal común en vez de reforzarla. Al introducir alineación por ejes principales + refinamiento Procrustes antes de la SVD/RPCA, cada muestra nueva aporta información al mismo subespacio compartido, que es el comportamiento esperado ("agregar muestras mejora la precisión").
