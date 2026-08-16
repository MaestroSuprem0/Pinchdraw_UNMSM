# PinchDraw — Reconocimiento molecular dibujando en el aire

Aplicación web educativa que reconoce moléculas dibujadas con la mano frente
a la cámara y predice sus propiedades químicas. Funciona enteramente en el
navegador: no requiere instalación ni servidor.

**Autor:** Isai Severiano Félix Sopla
**Universidad Nacional Mayor de San Marcos (UNMSM)** — Proyecto Final PT4

## Qué hace

- **Reconocimiento por trazo.** MediaPipe Hands sigue la mano a través de la
  cámara; el gesto de pinza o el índice extendido dibujan en el aire. La forma
  resultante se compara contra un catálogo de 250 moléculas ambientales.
- **Predicción de propiedades.** Tres redes neuronales de grafos (GNN)
  estiman solubilidad acuosa (logS), toxicidad (12 ensayos Tox21) y
  permeabilidad de la barrera hematoencefálica, a partir del SMILES.
- **Simulación de reacciones.** Plantillas SMARTS sobre RDKit: esterificación
  de Fischer, hidrólisis de éster y oxidación de alcoholes primarios.
- **Visualización 3D** de las estructuras, consultadas a PubChem.

## Cómo funciona

Todo el procesamiento ocurre en el navegador del usuario:

| Componente | Tecnología |
|---|---|
| Seguimiento de manos | MediaPipe Hands |
| Dibujo y canvas | p5.js |
| Química (SMILES, descriptores, reacciones) | RDKit compilado a WebAssembly |
| Predicción de propiedades | GNN implementada en JavaScript |
| Estructuras 3D | 3Dmol.js + PubChem |

Las redes son convolucionales sobre grafos (Kipf & Welling, 2017): tres capas
GCN sobre un featurizador de 37 dimensiones por átomo, con la adyacencia
ponderada por orden de enlace.

### Modelos

Entrenados con división por scaffold de Murcko (80/10/10):

| Propiedad | Dataset | Métrica en test |
|---|---|---|
| Solubilidad | ESOL / Delaney | RMSE 1.13 · MAE 0.92 |
| Toxicidad | Tox21 (12 ensayos) | ROC-AUC / PR-AUC por ensayo |
| Permeabilidad BBB | BBBP | ROC-AUC / PR-AUC |

Las predicciones son estimaciones con margen de error, pensadas como
herramienta educativa. No sustituyen determinaciones experimentales.

## Requisitos

- Navegador moderno con soporte de WebAssembly (Chrome, Edge, Firefox, Safari)
- Cámara web
- Conexión a internet, para las librerías externas y las consultas a PubChem

La cámara sólo funciona sobre HTTPS o `localhost`: abrir el archivo con doble
clic no basta.

## Origen

Este sitio es la versión web de un proyecto que originalmente usaba un backend
en Python (Flask + RDKit + PyTorch). La química se portó al navegador para
eliminar la instalación y la ventana de terminal. La equivalencia entre ambas
versiones está verificada sobre 270 moléculas.

## Créditos

**PinchDraw fue diseñado y desarrollado por Isai Severiano Félix Sopla**,
estudiante de la Universidad Nacional Mayor de San Marcos, como Proyecto Final
PT4. El diseño de la interacción, el catálogo de 250 moléculas, el
entrenamiento de las tres redes neuronales y la migración de la química al
navegador son trabajo propio.

Construido sobre hombros de gigantes: [RDKit](https://www.rdkit.org/),
[MediaPipe](https://developers.google.com/mediapipe),
[p5.js](https://p5js.org/), [3Dmol.js](https://3dmol.csb.pitt.edu/) y datos de
[PubChem](https://pubchem.ncbi.nlm.nih.gov/).

Datasets empleados para el entrenamiento: ESOL (Delaney, 2004), Tox21 (NIH) y
BBBP (Martins et al., 2012).

---

© 2026 Isai Severiano Félix Sopla. Si reutilizas este trabajo o partes de él, cita la fuente. (no te quieras pasar de listo XD)
