/*
 * ══════════════════════════════════════════════════════════════════════
 *  PINCHDRAW — QUÍMICA EN EL NAVEGADOR
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Reemplaza al backend Flask (servidor_reconocimiento.py) ejecutando en
 *  el navegador las tres cosas que hacía:
 *
 *    1. Validar SMILES y extraer info química   → RDKit.js (WebAssembly)
 *    2. Predecir solubilidad / toxicidad / BBBP → GNN reimplementada aquí
 *    3. Simular reacciones con plantillas SMARTS→ RDKit.js run_reactants
 *
 *  El reconocimiento del trazo NO vive aquí: sigue en pinch_draw.html,
 *  comparando contra molecules_250.js. Este módulo aporta el conocimiento
 *  químico, igual que hacía el servidor.
 *
 *  PARIDAD CON PYTHON
 *  ------------------
 *  El featurizador de 37 dimensiones y la adyacencia ponderada replican
 *  exactamente predictor_gnn.py. La hibridación y la pertenencia a anillo
 *  no se reimplementan a mano: se consultan al propio RDKit mediante
 *  SMARTS ([^1]..[^5] y [R]), de modo que se usa su algoritmo real.
 *  test/validar.js compara ambas implementaciones molécula a molécula.
 * ══════════════════════════════════════════════════════════════════════
 */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.PinchDrawQuimica = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  //  1. TABLA PERIÓDICA MÍNIMA
  //     Sólo se necesita para traducir número atómico → símbolo y para
  //     construir la fórmula molecular en notación de Hill.
  // ══════════════════════════════════════════════════════════════════

  const SIMBOLO_POR_Z = [
    '', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg',
    'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr',
    'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr',
    'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
    'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
    'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf',
    'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po',
    'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm',
    'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'
  ];

  // ══════════════════════════════════════════════════════════════════
  //  2. ESTADO DEL MÓDULO
  // ══════════════════════════════════════════════════════════════════

  let RDKit = null;              // instancia del módulo WASM
  const modelos = {};            // esol / tox21 / bbbp ya cargados
  const cacheQmol = new Map();   // consultas SMARTS reutilizables
  const cacheGrafo = new Map();  // grafos moleculares ya calculados

  let rutaModelos = 'modelos/';
  let rutaReacciones = 'reacciones.json';
  let progreso = function () {};

  // Promesa que se resuelve cuando RDKit y los tres modelos están listos.
  // El interceptor de fetch la espera, de modo que una llamada a /api/*
  // hecha durante el arranque no falla: simplemente se atiende un poco
  // más tarde, igual que si el servidor tardara en responder.
  let resolverListo;
  const listo = new Promise(function (res) { resolverListo = res; });

  // ══════════════════════════════════════════════════════════════════
  //  3. UTILIDADES RDKit
  // ══════════════════════════════════════════════════════════════════

  /** Consulta SMARTS cacheada (crearlas es caro y se reutilizan mucho). */
  function qmol(smarts) {
    if (!cacheQmol.has(smarts)) cacheQmol.set(smarts, RDKit.get_qmol(smarts));
    return cacheQmol.get(smarts);
  }

  /**
   * Índices de los átomos que casan con un SMARTS de un solo átomo.
   * Devuelve un Set para consultas O(1) desde el featurizador.
   */
  function atomosQueCasan(mol, smarts) {
    let crudo;
    try {
      crudo = mol.get_substruct_matches(qmol(smarts));
    } catch (e) {
      return new Set();
    }
    let lista;
    try {
      lista = JSON.parse(crudo);
    } catch (e) {
      return new Set();
    }
    if (!Array.isArray(lista)) return new Set();
    return new Set(lista.map(function (m) { return m.atoms[0]; }));
  }

  // ══════════════════════════════════════════════════════════════════
  //  4. FEATURIZADOR — 37 DIMENSIONES POR ÁTOMO
  //     Réplica exacta de featurizar_atomo() en predictor_gnn.py:
  //       símbolo(11) + grado(7) + hidrógenos(6) + carga(5)
  //       + hibridación(6) + aromático(1) + anillo(1) = 37
  // ══════════════════════════════════════════════════════════════════

  const SIMBOLOS = ['C', 'N', 'O', 'S', 'F', 'Si', 'P', 'Cl', 'Br', 'I'];

  /** Codificación one-hot; el último bit es "otro" si incluirOtro. */
  function oneHot(valor, validos, incluirOtro, destino) {
    let encontrado = false;
    for (let i = 0; i < validos.length; i++) {
      const hit = valor === validos[i];
      if (hit) encontrado = true;
      destino.push(hit ? 1 : 0);
    }
    if (incluirOtro) destino.push(encontrado ? 0 : 1);
  }

  /**
   * Convierte un SMILES en el grafo que espera la GNN.
   *
   * La adyacencia se pondera por orden de enlace (simple 1, doble 2,
   * triple 3, aromático 1.5) y luego se normaliza con el esquema de
   * Kipf & Welling:  A_norm = D^(-1/2) (A + I) D^(-1/2)
   */
  function smilesAGrafo(smiles) {
    if (cacheGrafo.has(smiles)) return cacheGrafo.get(smiles);

    const mol = RDKit.get_mol(smiles);
    if (!mol || !mol.is_valid()) {
      if (mol) mol.delete();
      return null;
    }

    let doc;
    try {
      doc = JSON.parse(mol.get_json());
    } catch (e) {
      mol.delete();
      return null;
    }

    const m = doc.molecules[0];
    const porDefecto = doc.defaults || { atom: {}, bond: {} };
    const defAtom = porDefecto.atom || {};
    const defBond = porDefecto.bond || {};
    const atomos = m.atoms || [];
    const enlaces = m.bonds || [];
    const N = atomos.length;

    if (N === 0) { mol.delete(); return null; }

    // ── Extensión rdkitRepresentation: aromaticidad y anillos ──────
    let ext = {};
    (m.extensions || []).forEach(function (e) {
      if (e.name === 'rdkitRepresentation') ext = e;
    });
    const aromAtomos = new Set(ext.aromaticAtoms || []);
    const aromEnlaces = new Set(ext.aromaticBonds || []);

    // ── Consultas a RDKit para lo que el JSON no expone ────────────
    // La hibridación y la pertenencia a anillo se piden al propio
    // RDKit vía SMARTS, para no reimplementar su lógica y arriesgar
    // divergencias silenciosas con la versión Python.
    const hib = [
      atomosQueCasan(mol, '[^1]'),   // SP
      atomosQueCasan(mol, '[^2]'),   // SP2
      atomosQueCasan(mol, '[^3]'),   // SP3
      atomosQueCasan(mol, '[^4]'),   // SP3D
      atomosQueCasan(mol, '[^5]')    // SP3D2
    ];
    const enAnillo = atomosQueCasan(mol, '[R]');

    // ── Grado y vecinos ────────────────────────────────────────────
    const grado = new Array(N).fill(0);
    const hExplicitos = new Array(N).fill(0);
    const z = atomos.map(function (a) {
      return a.z !== undefined ? a.z : (defAtom.z !== undefined ? defAtom.z : 6);
    });

    enlaces.forEach(function (b) {
      const i = b.atoms[0], j = b.atoms[1];
      grado[i]++; grado[j]++;
      if (z[j] === 1) hExplicitos[i]++;
      if (z[i] === 1) hExplicitos[j]++;
    });

    // ── Vector de features por átomo ───────────────────────────────
    const feats = new Float32Array(N * 37);
    for (let i = 0; i < N; i++) {
      const a = atomos[i];
      const fila = [];

      const simbolo = SIMBOLO_POR_Z[z[i]] || 'X';
      oneHot(simbolo, SIMBOLOS, true, fila);                        // 11

      oneHot(Math.min(grado[i], 5), [0, 1, 2, 3, 4, 5], true, fila); // 7

      const impHs = a.impHs !== undefined ? a.impHs
        : (defAtom.impHs !== undefined ? defAtom.impHs : 0);
      const totalHs = Math.min(impHs + hExplicitos[i], 4);
      oneHot(totalHs, [0, 1, 2, 3, 4], true, fila);                 // 6

      const chgBruta = a.chg !== undefined ? a.chg
        : (defAtom.chg !== undefined ? defAtom.chg : 0);
      const chg = Math.max(-2, Math.min(2, chgBruta));
      oneHot(chg, [-2, -1, 0, 1, 2], false, fila);                  // 5

      // Hibridación: se emite el one-hot en el mismo orden que Python
      // (SP, SP2, SP3, SP3D, SP3D2, otro).
      let vistoHib = false;
      for (let k = 0; k < 5; k++) {
        const hit = hib[k].has(i);
        if (hit) vistoHib = true;
        fila.push(hit ? 1 : 0);
      }
      fila.push(vistoHib ? 0 : 1);                                  // 6

      fila.push(aromAtomos.has(i) ? 1 : 0);                         // 1
      fila.push(enAnillo.has(i) ? 1 : 0);                           // 1

      for (let k = 0; k < 37; k++) feats[i * 37 + k] = fila[k];
    }

    // ── Adyacencia ponderada + normalización Kipf & Welling ────────
    const adj = new Float32Array(N * N);
    enlaces.forEach(function (b, idx) {
      const i = b.atoms[0], j = b.atoms[1];
      const bo = b.bo !== undefined ? b.bo
        : (defBond.bo !== undefined ? defBond.bo : 1);
      let peso;
      if (aromEnlaces.has(idx)) peso = 1.5;
      else if (bo === 2) peso = 2.0;
      else if (bo === 3) peso = 3.0;
      else peso = 1.0;
      adj[i * N + j] = peso;
      adj[j * N + i] = peso;
    });

    // Â = A + I, luego D^(-1/2) Â D^(-1/2)
    const grados = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      adj[i * N + i] += 1.0;
      let s = 0;
      for (let j = 0; j < N; j++) s += adj[i * N + j];
      grados[i] = 1.0 / Math.sqrt(Math.max(s, 1e-8));
    }
    const adjNorm = new Float32Array(N * N);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        adjNorm[i * N + j] = grados[i] * adj[i * N + j] * grados[j];
      }
    }

    // ── Metadatos de la molécula ───────────────────────────────────
    let desc = {};
    try { desc = JSON.parse(mol.get_descriptors()); } catch (e) {}

    const grafo = {
      smiles: smiles,
      N: N,
      feats: feats,
      adjNorm: adjNorm,
      formula: formulaHill(atomos, defAtom, z),
      pesoMolecular: Math.round((desc.exactmw || 0) * 1000) / 1000,
      pesoPromedio: Math.round((desc.amw || 0) * 1000) / 1000,
      numAtomos: N,
      numEnlaces: enlaces.length,
      numAnillos: (ext.atomRings || []).length,
      tieneAromaticos: aromAtomos.size > 0,
      smilesCanonico: mol.get_smiles()
    };

    mol.delete();
    cacheGrafo.set(smiles, grafo);
    return grafo;
  }

  /**
   * Fórmula molecular en notación de Hill (C, luego H, luego el resto
   * alfabético), con la carga total al final. Equivale a
   * rdMolDescriptors.CalcMolFormula.
   */
  function formulaHill(atomos, defAtom, z) {
    const cuenta = {};
    let carga = 0;
    let hImplicitos = 0;

    for (let i = 0; i < atomos.length; i++) {
      const a = atomos[i];
      const sim = SIMBOLO_POR_Z[z[i]] || 'X';
      cuenta[sim] = (cuenta[sim] || 0) + 1;
      const chg = a.chg !== undefined ? a.chg
        : (defAtom.chg !== undefined ? defAtom.chg : 0);
      carga += chg;
      const impHs = a.impHs !== undefined ? a.impHs
        : (defAtom.impHs !== undefined ? defAtom.impHs : 0);
      hImplicitos += impHs;
    }
    if (hImplicitos > 0) cuenta.H = (cuenta.H || 0) + hImplicitos;

    const partes = [];
    const trozo = function (sim) {
      const n = cuenta[sim];
      if (!n) return;
      partes.push(sim + (n > 1 ? n : ''));
      delete cuenta[sim];
    };
    trozo('C');
    trozo('H');
    Object.keys(cuenta).sort().forEach(trozo);

    let texto = partes.join('');
    if (carga !== 0) {
      // RDKit escribe el signo primero y la magnitud después ("C12H14N2+2"),
      // y omite la magnitud cuando es 1 ("H4N+").
      const abs = Math.abs(carga);
      texto += (carga > 0 ? '+' : '-') + (abs > 1 ? abs : '');
    }
    return texto;
  }

  // ══════════════════════════════════════════════════════════════════
  //  5. LA GNN EN JAVASCRIPT
  //     Arquitectura idéntica a ModeloGNN de predictor_gnn.py:
  //       3 × [ A_norm·H·W → LayerNorm → ReLU ]
  //       → mean pooling → fc1 + ReLU → fc2 (logits)
  //     Dropout se omite: en inferencia es la identidad.
  // ══════════════════════════════════════════════════════════════════

  /** Decodifica base64 → Float32Array (los pesos viajan así, sin pérdida). */
  function b64AFloat32(b64) {
    const bin = typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  }

  /** C[n×p] = A[n×m] · B[m×p] */
  function matmul(A, B, n, m, p) {
    const C = new Float32Array(n * p);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < m; k++) {
        const a = A[i * m + k];
        if (a === 0) continue;
        const off = k * p;
        for (let j = 0; j < p; j++) C[i * p + j] += a * B[off + j];
      }
    }
    return C;
  }

  /** Y[n×dOut] = X[n×dIn] · W[dOut×dIn]^T + b */
  function lineal(X, W, b, n, dIn, dOut) {
    const Y = new Float32Array(n * dOut);
    for (let i = 0; i < n; i++) {
      for (let o = 0; o < dOut; o++) {
        let s = b[o];
        const offW = o * dIn, offX = i * dIn;
        for (let k = 0; k < dIn; k++) s += X[offX + k] * W[offW + k];
        Y[i * dOut + o] = s;
      }
    }
    return Y;
  }

  /** LayerNorm sobre la última dimensión (eps 1e-5, igual que PyTorch). */
  function layerNorm(X, w, b, n, d) {
    const Y = new Float32Array(n * d);
    for (let i = 0; i < n; i++) {
      const off = i * d;
      let media = 0;
      for (let k = 0; k < d; k++) media += X[off + k];
      media /= d;
      let varianza = 0;
      for (let k = 0; k < d; k++) {
        const t = X[off + k] - media;
        varianza += t * t;
      }
      varianza /= d;
      const inv = 1.0 / Math.sqrt(varianza + 1e-5);
      for (let k = 0; k < d; k++) {
        Y[off + k] = (X[off + k] - media) * inv * w[k] + b[k];
      }
    }
    return Y;
  }

  function reluEnSitio(X) {
    for (let i = 0; i < X.length; i++) if (X[i] < 0) X[i] = 0;
    return X;
  }

  function sigmoide(x) { return 1 / (1 + Math.exp(-x)); }

  function Modelo(paquete) {
    this.config = paquete.config || {};
    this.formas = paquete.formas;
    this.p = {};
    const self = this;
    Object.keys(paquete.pesos_b64).forEach(function (k) {
      self.p[k] = b64AFloat32(paquete.pesos_b64[k]);
    });
  }

  Modelo.prototype.capaGCN = function (H, adjNorm, N, dIn, dOut, pref) {
    const agregado = matmul(adjNorm, H, N, N, dIn);
    const lin = lineal(agregado, this.p[pref + '.linear.weight'],
      this.p[pref + '.linear.bias'], N, dIn, dOut);
    return reluEnSitio(layerNorm(lin, this.p[pref + '.ln.weight'],
      this.p[pref + '.ln.bias'], N, dOut));
  };

  /** Devuelve los logits crudos, igual que el forward de PyTorch. */
  Modelo.prototype.forward = function (grafo) {
    const N = grafo.N;
    const dOculta = this.formas['gcn1.linear.weight'][0];   // 128
    const dSalida3 = this.formas['gcn3.linear.weight'][0];  // 64
    const nTareas = this.formas['fc2.weight'][0];

    let h = this.capaGCN(grafo.feats, grafo.adjNorm, N, 37, dOculta, 'gcn1');
    h = this.capaGCN(h, grafo.adjNorm, N, dOculta, dOculta, 'gcn2');
    h = this.capaGCN(h, grafo.adjNorm, N, dOculta, dSalida3, 'gcn3');

    // Global mean pooling: N átomos → un vector de molécula
    const mol = new Float32Array(dSalida3);
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < dSalida3; k++) mol[k] += h[i * dSalida3 + k];
    }
    for (let k = 0; k < dSalida3; k++) mol[k] /= N;

    const o1 = reluEnSitio(lineal(mol, this.p['fc1.weight'],
      this.p['fc1.bias'], 1, dSalida3, 32));
    const o2 = lineal(o1, this.p['fc2.weight'], this.p['fc2.bias'], 1, 32, nTareas);

    return Array.prototype.slice.call(o2);
  };

  // ══════════════════════════════════════════════════════════════════
  //  6. INTERPRETACIONES (copiadas de PredictorMolecular)
  // ══════════════════════════════════════════════════════════════════

  /*
   * Categorías de solubilidad, de más a menos soluble. El límite es el logS
   * mínimo que entra en cada una.
   */
  const CATEGORIAS_LOGS = [
    [0,  'Muy soluble (>1 mol/L)', 'muy soluble'],
    [-1, 'Soluble',                'soluble'],
    [-2, 'Moderadamente soluble',  'moderadamente soluble'],
    [-3, 'Poco soluble',           'poco soluble'],
    [-4, 'Escasamente soluble',    'escasamente soluble'],
    [-6, 'Insoluble',              'insoluble'],
    [-Infinity, 'Prácticamente insoluble', 'prácticamente insoluble']
  ];

  function categoriaLogS(logS) {
    for (let i = 0; i < CATEGORIAS_LOGS.length; i++) {
      if (logS >= CATEGORIAS_LOGS[i][0]) return CATEGORIAS_LOGS[i];
    }
    return CATEGORIAS_LOGS[CATEGORIAS_LOGS.length - 1];
  }

  /*
   * Adjetivo de solubilidad, coherente con el error del modelo.
   *
   * Las categorías tienen 1 unidad de logS de ancho y el RMSE del modelo es
   * 1,13: la banda de error casi siempre cubre más de una. Decir "Soluble"
   * para un logS de -0,95 y "Moderadamente soluble" para -1,05 es fingir que
   * se distingue algo que el modelo no distingue — es el mismo error que
   * cometía el adjetivo de los clasificadores antes de calibrarse.
   *
   * Sin RMSE se comporta como siempre: una sola categoría.
   */
  function interpretarLogS(logS, rmse) {
    const cat = categoriaLogS(logS);
    if (!isFinite(rmse) || rmse <= 0) return cat[1];

    const alta = categoriaLogS(logS + rmse);   // extremo más soluble
    const baja = categoriaLogS(logS - rmse);   // extremo menos soluble
    if (alta[1] === baja[1]) return alta[1];
    return 'Entre ' + alta[2] + ' y ' + baja[2];
  }

  /*
   * El mensaje para niños se deja como estaba a propósito. Sus cuatro tramos
   * son de 2 unidades de logS y su lenguaje ya es vago ("se disuelve un poco"),
   * así que no afirma una categoría que el modelo no sostenga. Hedgearlo más
   * — "entre disolverse un poco y no disolverse" — lo volvería ininteligible
   * para quien está pensado, sin ganar honestidad.
   */
  function mensajeNinoLogS(logS) {
    if (logS >= 0) return '¡Se disuelve en agua como el azúcar!';
    if (logS >= -2) return 'Se disuelve un poco en agua.';
    if (logS >= -4) return 'Cuesta disolverse en agua.';
    return '¡No se disuelve en agua!';
  }

  /*
   * ── Vocabulario calibrado según lo bien que discrimina el modelo ────
   *
   * Antes esta función era una escala fija de cinco adjetivos, la misma para
   * los tres modelos. El resultado era que BBBP, con ROC-AUC 0,641 —donde 0,5
   * es tirar una moneda—, decía "Muy probable" en cuanto la sigmoide pasaba de
   * 0,8. Esa palabra afirma una certeza que el modelo no tiene, y no la
   * arregla ninguna nota al pie.
   *
   * La probabilidad que devuelve un clasificador y su capacidad de acertar son
   * cosas distintas: un modelo puede estar muy seguro y equivocarse a menudo.
   * Así que el adjetivo lo elige el ROC-AUC, no la sigmoide: cuanto peor
   * discrimina el modelo, menos le dejamos afirmar.
   *
   * Los umbrales de ROC-AUC son los habituales al leer una curva ROC: por
   * debajo de 0,65 se considera que el modelo apenas supera el azar, y a
   * partir de 0,85 que separa bien las clases.
   *
   * Nada está codificado por modelo. Si un reentrenamiento sube BBBP a 0,88,
   * el vocabulario se amplía solo.
   */
  const NIVELES_DISCRIMINACION = [
    {
      id: 'alta',
      minRoc: 0.85,
      etiqueta: 'discriminación alta',
      descripcion: 'El modelo separa bien las clases (ROC-AUC ≥ 0,85).',
      vocabulario: ['Muy probable', 'Probable', 'Incierto', 'Poco probable', 'Muy poco probable'],
      decidir: function (p) {
        if (p >= 0.8) return 'Muy probable';
        if (p >= 0.6) return 'Probable';
        if (p >= 0.4) return 'Incierto';
        if (p >= 0.2) return 'Poco probable';
        return 'Muy poco probable';
      }
    },
    {
      id: 'moderada',
      minRoc: 0.75,
      etiqueta: 'discriminación moderada',
      descripcion: 'El modelo discrimina de forma moderada (ROC-AUC 0,75–0,85). '
        + 'No se usan los extremos del vocabulario.',
      vocabulario: ['Probable', 'Incierto', 'Poco probable'],
      decidir: function (p) {
        if (p >= 0.65) return 'Probable';
        if (p >= 0.35) return 'Incierto';
        return 'Poco probable';
      }
    },
    {
      id: 'baja',
      minRoc: 0.65,
      etiqueta: 'discriminación baja',
      descripcion: 'El modelo discrimina poco (ROC-AUC 0,65–0,75). '
        + 'Sólo se usa lenguaje tentativo.',
      vocabulario: ['Posible', 'Incierto', 'Poco probable'],
      decidir: function (p) {
        if (p >= 0.65) return 'Posible';
        if (p >= 0.35) return 'Incierto';
        return 'Poco probable';
      }
    },
    {
      /*
       * Aquí no se afirma nada. El modelo apenas supera el azar, así que lo
       * único honesto que se puede decir es hacia dónde se inclina y con qué
       * poca fuerza. La dirección la aporta el porcentaje, que se muestra al
       * lado; el adjetivo sólo dice cuánto crédito merece.
       */
      id: 'muy_baja',
      minRoc: -Infinity,
      etiqueta: 'discriminación muy baja',
      descripcion: 'El modelo apenas supera el azar (ROC-AUC < 0,65; 0,5 sería '
        + 'lanzar una moneda). Su salida es un indicio, no una conclusión.',
      vocabulario: ['Indicio débil', 'No concluyente'],
      decidir: function (p) {
        return (p >= 0.65 || p <= 0.35) ? 'Indicio débil' : 'No concluyente';
      }
    }
  ];

  /*
   * Nivel de discriminación a partir del ROC-AUC del modelo.
   *
   * Sin ROC-AUC se devuelve el nivel más conservador a propósito: un modelo
   * de calidad desconocida no puede ganarse el derecho a afirmar. Es la
   * misma razón por la que la métrica se lee del config y no se escribe a
   * mano.
   */
  function nivelDiscriminacion(rocAuc) {
    const roc = Number(rocAuc);
    if (!isFinite(roc)) return NIVELES_DISCRIMINACION[NIVELES_DISCRIMINACION.length - 1];
    for (let i = 0; i < NIVELES_DISCRIMINACION.length; i++) {
      if (roc >= NIVELES_DISCRIMINACION[i].minRoc) return NIVELES_DISCRIMINACION[i];
    }
    return NIVELES_DISCRIMINACION[NIVELES_DISCRIMINACION.length - 1];
  }

  function interpretarProbabilidad(p, rocAuc) {
    return nivelDiscriminacion(rocAuc).decidir(p);
  }

  const TAREAS_TOX21 = [
    'NR-AR', 'NR-AR-LBD', 'NR-AhR', 'NR-Aromatase', 'NR-ER', 'NR-ER-LBD',
    'NR-PPAR-gamma', 'SR-ARE', 'SR-ATAD5', 'SR-HSE', 'SR-MMP', 'SR-p53'
  ];

  // ══════════════════════════════════════════════════════════════════
  //  7. PREDICCIÓN DE PROPIEDADES  (equivale a POST /api/propiedades)
  // ══════════════════════════════════════════════════════════════════

  function predecirTodo(smiles) {
    const grafo = smilesAGrafo(smiles);
    if (!grafo) throw new Error("SMILES inválido: '" + smiles + "'");

    const propiedades = {};
    const metricas = {};

    /*
     * Las métricas viajan junto al split con el que se midieron.
     *
     * Sin el split, "ROC-AUC 0,73" no dice nada: sobre un split aleatorio ese
     * número sería flojo y sobre uno por scaffold de Murcko es honesto, porque
     * el test contiene esqueletos moleculares que el modelo no vio nunca. Es
     * dato del config.json, no una cadena escrita en la interfaz, para que si
     * alguien reentrena con otro split la pantalla no siga afirmando el viejo.
     */
    function conSplit(cfg) {
      const m = cfg.metricas || {};
      return cfg.split ? Object.assign({}, m, { split: cfg.split }) : m;
    }

    // ── Solubilidad (regresión: hay que desnormalizar) ─────────────
    if (modelos.esol) {
      const bruto = modelos.esol.forward(grafo)[0];
      const esc = modelos.esol.config.scaler || {};
      const logS = bruto * (esc.std !== undefined ? esc.std : 1) +
        (esc.media !== undefined ? esc.media : 0);
      propiedades.solubilidad = {
        log_s: logS,
        sol_mol_l: Number(Math.pow(10, logS).toPrecision(3)),
        interpretacion: interpretarLogS(logS, (modelos.esol.config.metricas || {}).rmse),
        mensaje_nino: mensajeNinoLogS(logS)
      };
      metricas.solubilidad = conSplit(modelos.esol.config);
    }

    // ── Toxicidad (12 ensayos Tox21: logits → sigmoide) ────────────
    if (modelos.tox21) {
      const logits = modelos.tox21.forward(grafo);
      const probs = logits.map(sigmoide);
      const etiquetas = modelos.tox21.config.label_cols || TAREAS_TOX21;
      const global = Math.max.apply(null, probs);
      const porEnsayo = {};
      probs.forEach(function (p, i) {
        porEnsayo[etiquetas[i] || ('tarea_' + i)] = p;
      });
      /*
       * El máximo de los 12 ensayos NO es "la toxicidad" de la molécula.
       *
       * Es un estadístico de orden extremo: el máximo de N variables tiende al
       * alza sólo por ser el máximo, y con N=12 empuja hacia arriba a casi
       * cualquier molécula aunque los doce ensayos fueran ruido. Con un PR-AUC
       * de 0,286 el modelo acierta poco en la clase positiva, que es justo la
       * que ese máximo amplifica.
       *
       * El número se sigue calculando —es útil saber qué ensayo destaca— pero
       * se devuelve diciendo lo que es: la señal más alta, de qué ensayo, y
       * cuántos de los doce superan el umbral. Ese recuento es lo que da
       * contexto: "0,73 en SR-MMP, 1 de 12 por encima de 0,5" y "0,73 en
       * SR-MMP, 9 de 12 por encima de 0,5" son situaciones muy distintas que
       * el máximo suelto no distinguía.
       */
      const UMBRAL_POSITIVO = 0.5;
      const ordenados = etiquetas
        .map(function (nombre, i) { return { ensayo: nombre, prob: probs[i] }; })
        .sort(function (a, b) { return b.prob - a.prob; });

      propiedades.toxicidad = {
        ensayo_mas_alto: etiquetas[probs.indexOf(global)] || null,
        prob_ensayo_mas_alto: global,
        prediccion: interpretarProbabilidad(global, (modelos.tox21.config.metricas || {}).roc_auc),
        ensayos: porEnsayo,
        ensayos_ordenados: ordenados,
        n_ensayos: probs.length,
        umbral_positivo: UMBRAL_POSITIVO,
        n_sobre_umbral: probs.filter(function (p) { return p >= UMBRAL_POSITIVO; }).length
      };
      metricas.toxicidad = conSplit(modelos.tox21.config);
    }

    // ── Permeabilidad de la barrera hematoencefálica ───────────────
    if (modelos.bbbp) {
      const prob = sigmoide(modelos.bbbp.forward(grafo)[0]);
      propiedades.bbbp = {
        probabilidad: prob,
        prediccion: interpretarProbabilidad(prob, (modelos.bbbp.config.metricas || {}).roc_auc),
        cruza_bbb: prob >= 0.5
      };
      metricas.bbbp = conSplit(modelos.bbbp.config);
    }

    return {
      smiles: smiles,
      formula: grafo.formula,
      peso_molecular: grafo.pesoMolecular,
      num_atomos: grafo.numAtomos,
      num_enlaces: grafo.numEnlaces,
      num_anillos: grafo.numAnillos,
      propiedades: propiedades,
      metricas_modelos: metricas
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  8. VALIDACIÓN DE SMILES  (equivale a POST /validar-smiles)
  // ══════════════════════════════════════════════════════════════════

  function validarSmiles(smiles) {
    const grafo = smilesAGrafo(smiles);
    if (!grafo) return { valido: false, info: {} };
    return {
      valido: true,
      info: {
        smiles: smiles,
        smiles_canonico: grafo.smilesCanonico,
        formula: grafo.formula,
        num_atomos: grafo.numAtomos,
        num_enlaces: grafo.numEnlaces,
        peso_molecular: grafo.pesoPromedio,
        anillos: grafo.numAnillos,
        tiene_aromaticos: grafo.tieneAromaticos
      }
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  9. REACCIONES  (equivale a POST /api/reaccion)
  //     Catálogo y textos copiados de reacciones.py.
  // ══════════════════════════════════════════════════════════════════

  // El catálogo NO se escribe a mano aquí: se carga de reacciones.json,
  // que genera exportar_reacciones.py a partir de REACCIONES_DISPONIBLES
  // en reacciones.py. Así los ids, SMARTS y textos educativos no pueden
  // divergir de la versión Python.
  let REACCIONES = {};

  function listarReacciones() {
    return Object.keys(REACCIONES).map(function (k) {
      const r = REACCIONES[k];
      return {
        id: k,
        nombre: r.nombre,
        descripcion: r.descripcion,
        num_reactantes: r.num_reactantes,
        grupos_requeridos: r.grupos_requeridos
      };
    });
  }

  /** Molécula con hidrógenos explícitos: los SMARTS usan [H:5] como nodo. */
  function conHidrogenos(smiles) {
    const m = RDKit.get_mol(smiles);
    if (!m || !m.is_valid()) { if (m) m.delete(); return null; }
    try { m.add_hs_in_place(); } catch (e) {}
    return m;
  }

  /** Info de un producto para la tarjeta del frontend (SVG en vez de PNG). */
  function infoMolecula(smiles) {
    const g = smilesAGrafo(smiles);
    let svg = null;
    const m = RDKit.get_mol(smiles);
    if (m && m.is_valid()) {
      try {
        svg = 'data:image/svg+xml;charset=utf-8,' +
          encodeURIComponent(m.get_svg(360, 300));
      } catch (e) {}
    }
    if (m) m.delete();
    return {
      smiles: smiles,
      formula: g ? g.formula : '',
      imagen_2d: svg,           // data-URI listo para <img src="...">
      molblock_3d: null         // el 3D lo resuelve el frontend vía PubChem
    };
  }

  /**
   * Convierte un producto crudo de run_reactants en un SMILES presentable.
   *
   * Las plantillas SMARTS generan subproductos con valencias forzadas (el
   * agua sale como [H][OH2][H]). reacciones.py los conserva marcándolos
   * con una advertencia en vez de descartarlos; aquí se hace lo mismo:
   * primero se intenta la forma limpia, y si no sanea se devuelve la
   * versión con hidrógenos explícitos junto con el aviso.
   */
  function normalizarProducto(p) {
    let conH = null;
    try { conH = p.get_smiles(); } catch (e) { return null; }
    if (!conH) return null;

    // Intento 1: quitar los H explícitos que añadió add_hs_in_place.
    let limpio = null;
    try {
      p.remove_hs_in_place();
      limpio = p.get_smiles();
    } catch (e) {}

    if (limpio) {
      const rc = RDKit.get_mol(limpio);
      if (rc && rc.is_valid()) {
        const canonico = rc.get_smiles();
        rc.delete();
        return { smiles: canonico, advertencia: null };
      }
      if (rc) rc.delete();
    }

    // Intento 2: dejarlo tal cual, avisando de la valencia rara.
    return {
      smiles: limpio || conH,
      advertencia: 'Subproducto representado de forma simplificada ' +
        '(advertencia de valencia).'
    };
  }

  function simularReaccion(smiles1, smiles2, tipo) {
    const def = REACCIONES[tipo];
    if (!def) {
      return {
        status: 'error',
        message: "Tipo de reacción '" + tipo + "' no reconocido.",
        tipos_disponibles: Object.keys(REACCIONES)
      };
    }

    const g1 = smiles1 ? smilesAGrafo(smiles1) : null;
    if (smiles1 && !g1) {
      return { status: 'error', message: "'" + smiles1 + "' no es una molécula válida (reactante 1)." };
    }
    const g2 = smiles2 ? smilesAGrafo(smiles2) : null;
    if (smiles2 && !g2) {
      return { status: 'error', message: "'" + smiles2 + "' no es una molécula válida (reactante 2)." };
    }
    if (def.num_reactantes === 2 && !g2) {
      return {
        status: 'error',
        message: "La reacción '" + def.nombre + "' necesita dos reactantes (" +
          def.grupos_requeridos.join(', ') + '), pero solo se recibió uno.'
      };
    }

    const rxn = RDKit.get_rxn(def.smarts);
    if (!rxn) return { status: 'error', message: 'No se pudo construir la reacción.' };

    const m1 = conHidrogenos(smiles1);
    const m2 = smiles2 ? conHidrogenos(smiles2) : null;

    // Se prueban ambos órdenes: el usuario puede dibujar el ácido o el
    // alcohol primero, y la plantilla SMARTS sí distingue el orden.
    let combos;
    if (def.num_reactantes === 2) combos = [[m1, m2], [m2, m1]];
    else combos = m2 ? [[m1], [m2]] : [[m1]];

    const conjuntos = new Map();

    combos.forEach(function (combo) {
      if (combo.some(function (x) { return !x; })) return;
      let salida;
      try {
        const lista = new RDKit.MolList();
        combo.forEach(function (x) { lista.append(x); });
        salida = rxn.run_reactants(lista, 1000);
      } catch (e) { return; }
      if (!salida) return;

      for (let i = 0; i < salida.size(); i++) {
        const prods = salida.get(i);
        const productos = [];
        for (let k = 0; k < prods.size(); k++) {
          const norm = normalizarProducto(prods.at(k));
          if (norm) productos.push(norm);
        }
        if (!productos.length) continue;
        const clave = productos.map(function (x) { return x.smiles; })
          .slice().sort().join('.');
        if (!conjuntos.has(clave)) conjuntos.set(clave, productos);
      }
    });

    if (m1) m1.delete();
    if (m2) m2.delete();

    if (!conjuntos.size) {
      return {
        status: 'no_reaccion',
        message: def.sugerencia_error,
        tipo_reaccion: def.nombre,
        grupos_requeridos: def.grupos_requeridos
      };
    }

    const listas = Array.from(conjuntos.values()).map(function (arr) {
      return arr.map(function (prod) {
        const info = infoMolecula(prod.smiles);
        if (prod.advertencia) info.advertencia = prod.advertencia;
        return info;
      });
    });

    return {
      status: 'success',
      tipo_reaccion: def.nombre,
      descripcion: def.descripcion,
      mensaje_educativo: def.explicacion,
      reactante_1: smiles1 ? infoMolecula(g1.smilesCanonico) : null,
      reactante_2: smiles2 ? infoMolecula(g2.smilesCanonico) : null,
      productos_principales: listas[0],
      todas_las_posibilidades: listas,
      num_posibilidades: listas.length
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  10. ARRANQUE
  // ══════════════════════════════════════════════════════════════════

  function cargarJSON(url) {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch(url).then(function (r) {
        if (!r.ok) throw new Error('No se pudo cargar ' + url);
        return r.json();
      });
    }
    // Entorno Node (sólo para los tests de validación)
    return Promise.resolve(JSON.parse(require('fs').readFileSync(url, 'utf8')));
  }

  function initRDKitGlobal() {
    if (typeof initRDKitModule !== 'function') {
      return Promise.reject(new Error('RDKit_minimal.js no está cargado'));
    }
    return initRDKitModule();
  }

  /**
   * Inicializa RDKit y carga los tres modelos.
   *
   * opciones.rdkit       instancia ya inicializada de RDKit (opcional)
   * opciones.rutaModelos carpeta donde viven esol/tox21/bbbp .json
   * opciones.progreso    callback(texto, fraccion) para la pantalla de carga
   */
  function iniciar(opciones) {
    opciones = opciones || {};
    // Se comprueba contra undefined, no con ||: la cadena vacía es un valor
    // legítimo (significa "los archivos están junto al HTML, sin subcarpeta")
    // y con || se descartaría por ser falsy, volviendo al valor por defecto.
    if (opciones.rutaModelos !== undefined) rutaModelos = opciones.rutaModelos;
    if (opciones.rutaReacciones !== undefined) rutaReacciones = opciones.rutaReacciones;
    progreso = opciones.progreso || progreso;

    let listoRDKit;
    if (opciones.rdkit) {
      listoRDKit = Promise.resolve(opciones.rdkit);
    } else {
      progreso('Cargando RDKit…', 0.1);
      listoRDKit = initRDKitGlobal();
    }

    return listoRDKit.then(function (instancia) {
      RDKit = instancia;
      progreso('Cargando modelos…', 0.45);

      const nombres = ['esol', 'tox21', 'bbbp'];
      const cargas = nombres.map(function (n, i) {
        return cargarJSON(rutaModelos + n + '.json').then(function (paquete) {
          modelos[n] = new Modelo(paquete);
          progreso('Modelo ' + n + ' listo', 0.45 + 0.15 * (i + 1));
        });
      });

      // El catálogo de reacciones viene del mismo sitio que en Python.
      cargas.push(
        cargarJSON(rutaReacciones).then(function (catalogo) {
          REACCIONES = catalogo;
        })
      );

      return Promise.all(cargas);
    }).then(function () {
      progreso('Química lista', 1);
      if (typeof window !== 'undefined') window.PINCHDRAW_QUIMICA_LISTA = true;
      resolverListo(API);
      return API;
    });
  }

  // ══════════════════════════════════════════════════════════════════
  //  11. INTERCEPTOR DE fetch
  //      El frontend sigue llamando a /api/propiedades, /api/reaccion,
  //      etc. En vez de reescribir pinch_draw.html, se interceptan esas
  //      rutas y se responden en local con el mismo contrato JSON.
  //      Cualquier otra URL (PubChem, CDNs) pasa sin tocarse.
  // ══════════════════════════════════════════════════════════════════

  function respuesta(objeto, estado) {
    return new Response(JSON.stringify(objeto), {
      status: estado || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const RUTAS = {
    '/status': function () {
      return respuesta({
        servidor: 'local',
        rdkit: !!RDKit,
        gnn: !!modelos.esol,
        reacciones: !!RDKit
      });
    },
    '/validar-smiles': function (cuerpo) {
      const smiles = (cuerpo.smiles || '').trim();
      if (!smiles) return respuesta({ status: 'error', message: 'No se recibió ningún SMILES' }, 400);
      const r = validarSmiles(smiles);
      if (!r.valido) {
        return respuesta({
          status: 'error',
          message: '"' + smiles + '" no es un SMILES válido.',
          consejo: 'Verifica la sintaxis en: https://www.daylight.com/dayhtml/doc/theory/theory.smiles.html'
        });
      }
      return respuesta({ status: 'success', smiles: smiles, info: r.info });
    },
    '/api/propiedades': function (cuerpo) {
      const smiles = (cuerpo.smiles || '').trim();
      if (!smiles) return respuesta({ status: 'error', message: 'SMILES vacío' }, 400);
      try {
        const r = predecirTodo(smiles);
        r.status = 'success';
        return respuesta(r);
      } catch (e) {
        return respuesta({ status: 'error', message: e.message }, 400);
      }
    },
    '/api/reaccion': function (cuerpo) {
      const s1 = (cuerpo.smiles1 || '').trim();
      const s2 = (cuerpo.smiles2 || '').trim();
      const tipo = (cuerpo.tipo_reaccion || 'esterificacion').trim();
      if (!s1) return respuesta({ status: 'error', message: 'Falta el SMILES del reactante 1.' }, 400);
      try {
        return respuesta(simularReaccion(s1, s2 || null, tipo));
      } catch (e) {
        return respuesta({ status: 'error', message: 'Error al simular: ' + e.message }, 500);
      }
    },
    '/api/reacciones-disponibles': function () {
      return respuesta({ status: 'success', reacciones: listarReacciones() });
    }
  };

  function instalarInterceptor() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      // Sin fetch no hay nada que interceptar. Se avisa y se sigue: la API
      // programática (predecirTodo, simularReaccion) funciona igual, y así
      // un entorno raro no tumba el arranque entero de la aplicación.
      if (typeof console !== 'undefined') {
        console.warn('PinchDrawQuimica: window.fetch no existe; no se instaló el interceptor.');
      }
      return false;
    }

    const original = window.fetch.bind(window);

    window.fetch = function (entrada, init) {
      const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
      let ruta;
      try {
        ruta = new URL(url, window.location.href).pathname;
      } catch (e) {
        return original(entrada, init);
      }

      // Se acepta tanto "/api/x" como ".../carpeta/api/x": GitHub Pages
      // sirve el sitio bajo un subdirectorio con el nombre del repo.
      let clave = null;
      Object.keys(RUTAS).forEach(function (k) {
        if (!clave && (ruta === k || ruta.endsWith(k))) clave = k;
      });
      if (!clave) return original(entrada, init);

      let cuerpo = {};
      if (init && init.body) {
        try { cuerpo = JSON.parse(init.body); } catch (e) {}
      }

      // Si la petición llega antes de que RDKit haya terminado de cargar,
      // se espera en vez de fallar. Para el frontend es indistinguible de
      // un servidor que tarda un poco en arrancar.
      return listo.then(function () {
        return RUTAS[clave](cuerpo);
      });
    };

    return true;
  }

  // ══════════════════════════════════════════════════════════════════
  //  API PÚBLICA
  // ══════════════════════════════════════════════════════════════════

  const API = {
    iniciar: iniciar,
    instalarInterceptor: instalarInterceptor,
    predecirTodo: predecirTodo,
    validarSmiles: validarSmiles,
    simularReaccion: simularReaccion,
    listarReacciones: listarReacciones,
    smilesAGrafo: smilesAGrafo,
    // Expuestas para que la interfaz marque el modelo débil y las pruebas
    // comprueben la calibración contra la misma tabla que usa el motor. Si se
    // duplicaran los umbrales, acabarían discrepando.
    interpretarProbabilidad: interpretarProbabilidad,
    nivelDiscriminacion: nivelDiscriminacion,
    interpretarLogS: interpretarLogS,
    Modelo: Modelo,
    _modelos: modelos,
    _fijarRDKit: function (r) { RDKit = r; },
    _cargarModelo: function (n, paquete) { modelos[n] = new Modelo(paquete); },
    _cargarReacciones: function (catalogo) { REACCIONES = catalogo; }
  };

  return API;
});
