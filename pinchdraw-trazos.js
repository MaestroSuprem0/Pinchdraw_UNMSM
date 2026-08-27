/*
 * PinchDraw — reconocimiento de trazos.
 * =====================================
 *
 * Este archivo vive fuera del HTML para que las pruebas puedan cargarlo en
 * Node sin arrancar la página entera. En el navegador se expone en
 * window.PINCHDRAW_TRAZOS; en Node se exporta con module.exports.
 *
 * No toca química: sólo geometría del dibujo.
 *
 *
 * QUÉ DESCRIPTORES USA EL RECONOCEDOR (y por qué sólo estos)
 * ----------------------------------------------------------
 * Un trazo hecho con el dedo en el aire, por alguien sin entrenamiento, sólo
 * transmite unas pocas señales fiables. El descriptor se limita a ellas:
 *
 *   nTrazos       cuántos trazos separados hay (1, 2, 3+). Es la señal MÁS
 *                 fiable del sistema: es discreta y la decide la persona.
 *   cerrado       si el trazo principal vuelve a su punto de partida.
 *   esquinas      cuántos giros claros tiene el trazo principal.
 *   redondez      si esos giros están concentrados (polígono) o repartidos
 *                 (círculo).
 *   anchura       cuánto se alarga el trazo principal: 0 = tan alto como
 *                 ancho, 1 = una raya.
 *   cruce         si dos trazos se cortan (la cruz del metano).
 *   relSecundario largo del segundo trazo respecto al principal: distingue
 *                 un punto (0.2) de una cola (0.5) de otra línea igual (1).
 *   anclaSec      dónde se apoya el segundo trazo sobre el principal:
 *                 0 = en un extremo (cola), 1 = en el centro (la T).
 *   secDentro     si el segundo trazo cae DENTRO del principal (el círculo
 *                 del benceno) o fuera (la cola del tolueno).
 *
 * Lo que deliberadamente NO se usa, porque a mano alzada no es legible:
 *   - el número exacto de lados de un polígono (pentágono vs hexágono)
 *   - ángulos concretos
 *   - longitudes absolutas
 *
 *
 * CÓMO RECONOCE
 * -------------
 * No hay funciones de puntuación escritas a mano. Cada molécula dibujable
 * trae su trazo canónico como lista de puntos (PLANTILLAS). El mismo
 * extractor que analiza el dibujo de la persona analiza esa plantilla, y se
 * elige la plantilla cuyo descriptor queda más cerca.
 *
 * La consecuencia es que la animación de la guía y el reconocedor comparten
 * una única fuente de verdad: lo que la guía enseña a dibujar es exactamente
 * lo que el reconocedor mide.
 */
(function (raiz, fabrica) {
  'use strict';
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.PINCHDRAW_TRAZOS = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ══════════════════════════════════════════════════════
  //  Geometría auxiliar
  // ══════════════════════════════════════════════════════

  function longitud(pts) {
    let t = 0;
    for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return t;
  }

  function caja(pts) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }

  function distPuntoSegmento(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    if (!l) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // Ramer–Douglas–Peucker iterativo: la versión recursiva desborda la pila con
  // trazos largos y aquí puede llegar cualquier cosa que dibuje la persona.
  function simplificar(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const conservar = new Array(pts.length).fill(false);
    conservar[0] = conservar[pts.length - 1] = true;
    const pila = [[0, pts.length - 1]];
    while (pila.length) {
      const [ini, fin] = pila.pop();
      let peor = 0, idx = -1;
      for (let i = ini + 1; i < fin; i++) {
        const d = distPuntoSegmento(pts[i], pts[ini], pts[fin]);
        if (d > peor) { peor = d; idx = i; }
      }
      if (idx > 0 && peor > eps) {
        conservar[idx] = true;
        pila.push([ini, idx], [idx, fin]);
      }
    }
    return pts.filter((_, i) => conservar[i]);
  }

  /*
   * Reparte puntos equiespaciados sobre la polilínea.
   *
   * Sin esto el descriptor dependería de cuántos puntos trajera el trazo: una
   * plantilla es una recta de dos puntos y un dibujo real trae cientos, así
   * que medidas como "¿se tocan estos dos trazos?" daban resultados distintos
   * para la misma figura. Además, dibujar despacio genera muchos más puntos
   * que dibujar rápido, y eso tampoco debe cambiar nada.
   */
  function remuestrear(pts, paso) {
    if (pts.length < 2) return pts.slice();
    const salida = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(d / paso));
      for (let k = 1; k <= n; k++) {
        salida.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
      }
    }
    return salida;
  }

  // Ángulo de giro (en grados) en cada vértice interior de una polilínea.
  function girosEnVertices(pts) {
    const giros = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const v1 = { x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y };
      const v2 = { x: pts[i + 1].x - pts[i].x, y: pts[i + 1].y - pts[i].y };
      const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
      if (l1 < 1e-9 || l2 < 1e-9) continue;
      const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (l1 * l2)));
      giros.push(Math.acos(cos) * 180 / Math.PI);
    }
    return giros;
  }

  /*
   * ¿Se cortan los segmentos a1a2 y b1b2?
   *
   * Los signos se comparan con <= y >= a propósito. Con > y < estricto, un
   * vértice que cae justo encima del otro segmento no cuenta como corte, y eso
   * pasa siempre en las plantillas, cuyas coordenadas son exactas: la cruz del
   * metano no se detectaba como cruce mientras que cualquier dibujo real, con
   * su ruido, sí. Se descarta aparte el caso degenerado de segmentos alineados.
   */
  function seCortan(a1, a2, b1, b2) {
    const d = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = d(b1, b2, a1), d2 = d(b1, b2, a2), d3 = d(a1, a2, b1), d4 = d(a1, a2, b2);
    if (!d1 && !d2 && !d3 && !d4) return false;
    return ((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0))
        && ((d3 <= 0 && d4 >= 0) || (d3 >= 0 && d4 <= 0));
  }

  // ══════════════════════════════════════════════════════
  //  Descriptor
  // ══════════════════════════════════════════════════════

  // Umbrales, todos sobre coordenadas normalizadas (el dibujo se escala a 1).
  const EPS_SIMPLIFICAR = 0.045;  // ruido de mano que se descarta antes de contar esquinas
  const GIRO_ESQUINA    = 38;     // grados a partir de los cuales un giro es "una esquina"
  /*
   * Un trazo es cerrado si sus extremos acaban cerca, medido sobre el dibujo
   * escalado a 1. Es a propósito una distancia absoluta y no una fracción del
   * recorrido: un zig-zag largo recorre mucho camino y acaba cerca de donde
   * empezó, y con un criterio relativo se leería como un anillo.
   *
   * El valor está medido, no elegido a ojo: dibujando cada figura 400 veces
   * con ruido fuerte, las cerradas llegan como mucho a 0.62 de separación y
   * las abiertas no bajan de 0.55. 0.50 cae dentro de esa franja y deja cerrar
   * un anillo con un hueco bien visible, que es como salen a mano alzada.
   */
  const CIERRE_MAX      = 0.50;
  const PASO_REMUESTREO = 0.02;   // separación entre puntos tras normalizar
  const TOQUE_MAX       = 0.15;   // a qué distancia se considera que dos trazos se tocan
  const BORDE_CRUCE     = 0.18;   // fracción de cada extremo que no cuenta como cruce
  const MAX_TRAZOS      = 3;      // por encima de 3 trazos ya no se distingue nada más
  // Se cuentan 0, 1, 2 o "3 o más". Afinar por encima de eso sería distinguir
  // un pentágono de un hexágono, que a mano alzada nadie produce ni lee.
  const MAX_ESQUINAS    = 3;

  /*
   * Pesos de cada campo en la distancia. Reflejan cuánta confianza merece la
   * señal, no cuánta información llevaría en teoría: el número de trazos es
   * deliberado y por eso pesa el triple que la redondez, que depende del pulso.
   */
  const PESOS = {
    nTrazos: 3.0,
    cerrado: 2.5,
    cruce: 2.0,
    esquinas: 1.4,
    anchura: 1.2,
    // Baja a propósito: el largo del segundo trazo es de lo que menos controla
    // la mano. Basta para separar un punto de una línea entera, pero no debe
    // decidir por sí solo si una T es una T.
    relSecundario: 0.8,
    secToca: 1.5,
    anclaSec: 1.2,
    secDentro: 1.5,
    redondez: 0.8
  };
  const CAMPOS = Object.keys(PESOS);

  function normalizar(strokes) {
    const limpios = (strokes || [])
      .map(s => (Array.isArray(s) ? s : (s && s.pts)) || [])
      .filter(pts => pts.length >= 2);
    if (!limpios.length) return null;
    const todos = limpios.flat();
    const c = caja(todos);
    const escala = Math.max(c.w, c.h);
    if (!(escala > 0)) return null;
    return {
      trazos: limpios.map(pts => remuestrear(
        pts.map(p => ({ x: (p.x - c.x0) / escala, y: (p.y - c.y0) / escala })),
        PASO_REMUESTREO
      ))
    };
  }

  function descriptor(strokes) {
    const norm = normalizar(strokes);
    if (!norm) return null;
    const trazos = norm.trazos;

    // El trazo principal es el más largo: es el esqueleto. Los demás son
    // marcas de grupo funcional.
    const largos = trazos.map(longitud);
    const iPrincipal = largos.indexOf(Math.max(...largos));
    const principal = simplificar(trazos[iPrincipal], EPS_SIMPLIFICAR);
    const largoPrincipal = largos[iPrincipal];

    /*
     * ── proporción ────────────────────────────────────
     *
     * Se mide sobre el TRAZO PRINCIPAL, no sobre el dibujo entero. El
     * esqueleto es lo que la persona proporciona a propósito; la marca del
     * grupo funcional sale del largo que salga. Midiendo el conjunto, una T
     * cambiaba de proporción según lo corto que quedara el palo, y era el palo
     * corto justamente lo que había que perdonar.
     */
    const cajaPrincipal = caja(trazos[iPrincipal]);
    const ladoMayor = Math.max(cajaPrincipal.w, cajaPrincipal.h);
    const suma = cajaPrincipal.w + cajaPrincipal.h;
    /*
     * Se mide lo ALARGADO que es, sin mirar hacia dónde: 0 = tan alto como
     * ancho (un anillo), 1 = una raya. Distinguir apaisado de vertical parece
     * más informativo, pero no lo es: cuando dos trazos miden casi lo mismo
     * —la cruz del metano, las dos paralelas del etileno— cuál de ellos sale
     * "principal" cambia de un dibujo a otro, y con él la orientación. Medir
     * sólo el alargamiento deja el descriptor quieto.
     */
    const anchura = suma > 0 ? (ladoMayor / suma - 0.5) * 2 : 0;

    // ── cerrado ────────────────────────────────────────
    const a = principal[0], b = principal[principal.length - 1];
    const separacionExtremos = Math.hypot(a.x - b.x, a.y - b.y);
    const cerrado = separacionExtremos < CIERRE_MAX ? 1 : 0;

    // ── esquinas y redondez ────────────────────────────
    const giros = girosEnVertices(principal);
    // En un trazo cerrado el punto de unión también es una esquina real; se
    // añade el giro entre el último y el primer segmento.
    if (cerrado && principal.length >= 3) {
      const cierre = girosEnVertices([
        principal[principal.length - 2], principal[0], principal[1]
      ]);
      giros.push(...cierre);
    }
    const esquinas = Math.min(MAX_ESQUINAS, giros.filter(g => g > GIRO_ESQUINA).length);
    // Un polígono concentra el giro en pocos vértices (triángulo: 120° cada
    // uno); un círculo lo reparte. redondez 0 = muy anguloso, 1 = redondo.
    const giroMax = giros.length ? Math.max(...giros) : 0;
    const redondez = Math.max(0, Math.min(1, 1 - giroMax / 150));

    // ── segundo trazo ──────────────────────────────────
    let relSecundario = 0, anclaSec = 0, secDentro = 0, secToca = 0;
    const otros = trazos.filter((_, i) => i !== iPrincipal);
    if (otros.length) {
      const iSec = largos
        .map((l, i) => ({ l, i }))
        .filter(o => o.i !== iPrincipal)
        .sort((p, q) => q.l - p.l)[0].i;
      const sec = trazos[iSec];
      relSecundario = Math.min(1, largos[iSec] / largoPrincipal);

      // Punto del trazo principal más cercano al secundario, expresado como
      // recorrido 0..1 a lo largo del principal.
      let mejorD = Infinity, mejorT = 0, recorrido = 0;
      const bruto = trazos[iPrincipal];
      for (let i = 1; i < bruto.length; i++) {
        const seg = Math.hypot(bruto[i].x - bruto[i - 1].x, bruto[i].y - bruto[i - 1].y);
        for (const p of sec) {
          const d = distPuntoSegmento(p, bruto[i - 1], bruto[i]);
          if (d < mejorD) { mejorD = d; mejorT = largoPrincipal ? (recorrido + seg / 2) / largoPrincipal : 0; }
        }
        recorrido += seg;
      }
      /*
       * Sólo tiene sentido preguntar DÓNDE se apoya el segundo trazo si de
       * verdad toca al principal. Dos líneas paralelas no se tocan, y sin esta
       * comprobación el punto "más cercano" caía en cualquier sitio y el
       * descriptor bailaba de un dibujo a otro.
       */
      secToca = mejorD < TOQUE_MAX ? 1 : 0;
      // 0 = se apoya en un extremo (cola); 1 = se apoya en el centro (la T).
      anclaSec = secToca ? 1 - Math.min(1, Math.abs(mejorT - 0.5) * 2) : 0;

      // ¿Cae dentro del principal? Se compara contra su caja encogida, que
      // para un anillo dibujado a mano aproxima bien "en el interior".
      const cp = caja(bruto);
      const margen = 0.22;
      const cs = caja(sec);
      const cxs = (cs.x0 + cs.x1) / 2, cys = (cs.y0 + cs.y1) / 2;
      secDentro = (cerrado &&
        cxs > cp.x0 + cp.w * margen && cxs < cp.x1 - cp.w * margen &&
        cys > cp.y0 + cp.h * margen && cys < cp.y1 - cp.h * margen) ? 1 : 0;

      /*
       * "Está dentro" y "toca" describen relaciones distintas y excluyentes.
       * El círculo del benceno queda dentro del anillo, y si además se mide si
       * roza el borde, el descriptor depende de lo grande que salga el círculo
       * — que es justo lo que nadie controla dibujando en el aire. Dentro
       * manda: cuando lo está, las medidas de contacto se anulan.
       */
      if (secDentro) { secToca = 0; anclaSec = 0; }
    }

    /*
     * ── cruce entre trazos distintos ──────────────────
     *
     * Sólo cuenta como cruce si los dos trazos se cortan POR EL MEDIO. Una T
     * también se toca, pero el palo termina donde empieza la barra: si eso
     * contara como cruce, la T y la cruz del metano serían la misma cosa cada
     * vez que a alguien se le pasa un poco el palo. Al exigir que el corte
     * caiga lejos de los extremos de ambos trazos, la T deja de bailar.
     */
    let cruce = 0;
    for (let i = 0; i < trazos.length && !cruce; i++) {
      for (let j = i + 1; j < trazos.length && !cruce; j++) {
        const A = trazos[i], B = trazos[j];   // ya remuestreados: el índice es la posición
        for (let m = 1; m < A.length && !cruce; m++) {
          const tA = m / (A.length - 1);
          if (tA < BORDE_CRUCE || tA > 1 - BORDE_CRUCE) continue;
          for (let n = 1; n < B.length && !cruce; n++) {
            const tB = n / (B.length - 1);
            if (tB < BORDE_CRUCE || tB > 1 - BORDE_CRUCE) continue;
            if (seCortan(A[m - 1], A[m], B[n - 1], B[n])) cruce = 1;
          }
        }
      }
    }

    return {
      nTrazos: (Math.min(MAX_TRAZOS, trazos.length) - 1) / (MAX_TRAZOS - 1),
      cerrado,
      cruce,
      esquinas: esquinas / MAX_ESQUINAS,
      anchura,
      relSecundario,
      secToca,
      anclaSec,
      secDentro,
      redondez,
      // Crudos, para depurar y para los mensajes de ayuda.
      _crudo: { trazos: trazos.length, esquinas, cerrado: !!cerrado, cruce: !!cruce, giroMax }
    };
  }

  // Distancia euclídea ponderada. La escala está calibrada en test/trazos.js:
  // ahí se mide cuánto se dispersa una misma forma repetida y cuánto se
  // separan formas distintas.
  function distancia(d1, d2) {
    if (!d1 || !d2) return Infinity;
    let suma = 0, pesos = 0;
    for (const campo of CAMPOS) {
      const dif = (d1[campo] - d2[campo]) * PESOS[campo];
      suma += dif * dif;
      pesos += PESOS[campo] * PESOS[campo];
    }
    return Math.sqrt(suma / pesos);
  }

  // ══════════════════════════════════════════════════════
  //  Plantillas: el conjunto dibujable
  // ══════════════════════════════════════════════════════

  const P = (...pares) => pares.map(([x, y]) => ({ x, y }));

  function poligono(cx, cy, r, lados, rot) {
    const pts = [];
    const giro = rot === undefined ? -Math.PI / 2 : rot;
    for (let i = 0; i <= lados; i++) {
      const ang = giro + Math.PI * 2 * (i % lados) / lados;
      pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    return pts;
  }

  function circulo(cx, cy, r) {
    return poligono(cx, cy, r, 24);
  }

  function zigzag(x0, x1, yAlto, yBajo, picos) {
    const pts = [];
    const n = picos + 1;
    for (let i = 0; i <= n; i++) {
      pts.push({ x: x0 + (x1 - x0) * i / n, y: i % 2 ? yAlto : yBajo });
    }
    return pts;
  }

  /*
   * El conjunto dibujable.
   *
   * Cada entrada declara:
   *   smiles   la molécula del catálogo a la que corresponde (es la clave que
   *            enlaza con molecules_250.js y con dibujable:true)
   *   trazos   el trazo canónico, en coordenadas 0..1
   *   porque   por qué ESA forma corresponde a ESA molécula. No es adorno:
   *            es lo que convierte el gesto en química aprendida en lugar de
   *            un símbolo memorizado.
   *
   * El conjunto salió de una propuesta de 22 y quedó en las que superan la
   * prueba de separación de test/trazos.js. Las descartadas y el motivo están
   * documentados en informes/separacion.txt.
   */
  const PLANTILLAS = [
    /*
     * ══ UN TRAZO, ABIERTO ════════════════════════════
     *
     * Aquí falta el propano (zig-zag corto de dos picos), que sí estaba en la
     * propuesta inicial. Se cayó al medirlo: tiene una esquina más que la V
     * del agua y una menos que el zig-zag largo del octano, y nada más lo
     * separa de ninguno de los dos. Distinguir "una esquina más" es justo lo
     * que a mano alzada no se produce ni se lee.
     */
    {
      id: 'co2', nombre: 'Dióxido de carbono', formula: 'CO₂', smiles: 'O=C=O',
      nombre_en: 'carbon dioxide',
      familia: 'Gas de efecto invernadero', color: '#ef233c', icono: '↔',
      gesto: 'Una línea recta, larga y horizontal',
      porque: 'La molécula es lineal: el ángulo O=C=O mide 180°. El trazo es literalmente su geometría.',
      trazos: [P([0.04, 0.5], [0.96, 0.5])]
    },
    {
      id: 'agua', nombre: 'Agua', formula: 'H₂O', smiles: 'O',
      nombre_en: 'water',
      familia: 'Inorgánico esencial', color: '#48cae4', icono: '💧',
      gesto: 'Una V abierta y ancha, con una sola esquina',
      porque: 'El agua es angular: el ángulo H-O-H mide 104,5°. La V es ese ángulo dibujado.',
      trazos: [P([0.06, 0.08], [0.5, 0.92], [0.94, 0.08])]
    },
    {
      id: 'octano', nombre: 'Octano', formula: 'C₈H₁₈', smiles: 'CCCCCCCC',
      nombre_en: 'octane',
      familia: 'Alcano / combustible', color: '#fb8500', icono: '⌁',
      gesto: 'Un zig-zag largo y bajo, de cinco picos o más',
      porque: 'Misma notación que el propano, pero con más vértices: más carbonos, cadena más larga.',
      trazos: [zigzag(0.02, 0.98, 0.18, 0.82, 6)]
    },

    {
      id: 'amoniaco', nombre: 'Amoníaco', formula: 'NH₃', smiles: 'N',
      nombre_en: 'ammonia',
      familia: 'Base inorgánica', color: '#9d4edd', icono: '⑂',
      gesto: 'Una Y: un tallo que se abre en dos ramas arriba',
      porque: 'El nitrógeno tiene tres enlaces y un par de electrones libres, así que la molécula es una pirámide. La Y son esos tres enlaces vistos de lado.',
      trazos: [P([0.5, 0.96], [0.5, 0.5], [0.04, 0.04]), P([0.5, 0.5], [0.96, 0.04])]
    },

    /*
     * ══ UN TRAZO, CERRADO ════════════════════════════
     *
     * Una sola figura, y no es un capricho: a mano alzada, un triángulo, un
     * cuadrado, un pentágono, un hexágono y un círculo son la misma cosa. Al
     * medirlos quedan a 0,02-0,07 de distancia cuando el umbral exigido es
     * 0,09. De los cinco candidatos sobrevive el triángulo por ser el más
     * robusto: sus giros de 120° siguen leyéndose aunque el pulso los redondee.
     * Ciclohexano, glucosa y cloruro de sodio pasan a ser sólo de catálogo.
     */
    {
      id: 'ciclopropano', nombre: 'Ciclopropano', formula: 'C₃H₆', smiles: 'C1CC1',
      nombre_en: 'cyclopropane',
      familia: 'Cicloalcano tensionado', color: '#ff9f1c', icono: '▲',
      gesto: 'Un triángulo cerrado',
      porque: 'Tres carbonos en anillo. Sus ángulos de 60° son los que hacen la molécula tan tensa y reactiva.',
      trazos: [poligono(0.5, 0.52, 0.46, 3)]
    },
    // ══ DOS TRAZOS ════════════════════════════════════
    {
      id: 'metano', nombre: 'Metano', formula: 'CH₄', smiles: 'C',
      nombre_en: 'methane',
      familia: 'Alcano simple', color: '#ffb703', icono: '✳',
      gesto: 'Una cruz: dos trazos que se cortan por el medio',
      porque: 'El metano es tetraédrico. La cruz es su proyección en el plano: cuatro enlaces saliendo de un carbono central.',
      trazos: [P([0.04, 0.5], [0.96, 0.5]), P([0.5, 0.04], [0.5, 0.96])]
    },
    {
      id: 'acetona', nombre: 'Acetona', formula: 'C₃H₆O', smiles: 'CC(=O)C',
      nombre_en: 'acetone',
      familia: 'Cetona', color: '#f15bb5', icono: '⊤',
      gesto: 'Una T: barra horizontal y un palo que sube desde el centro',
      porque: 'La barra son los dos CH₃ con el carbono central; el palo es el oxígeno del carbonilo, que sale justo del medio.',
      // El palo mide la mitad que la barra a propósito: así una T con el palo
      // largo y otra con el palo corto quedan igual de cerca de la plantilla.
      trazos: [P([0.04, 0.78], [0.96, 0.78]), P([0.5, 0.78], [0.5, 0.30])]
    },
    {
      id: 'eteno', nombre: 'Etileno', formula: 'C₂H₄', smiles: 'C=C',
      nombre_en: 'ethylene',
      familia: 'Alqueno', color: '#4cc9f0', icono: '⚌',
      gesto: 'Dos líneas rectas paralelas, sin tocarse',
      porque: 'Dos líneas es exactamente cómo se escribe un doble enlace C=C, que es lo que define a los alquenos.',
      trazos: [P([0.04, 0.32], [0.96, 0.32]), P([0.04, 0.68], [0.96, 0.68])]
    },
    {
      id: 'etanol', nombre: 'Etanol', formula: 'C₂H₆O', smiles: 'CCO',
      nombre_en: 'ethanol',
      familia: 'Alcohol', color: '#57cc99', icono: '⌁',
      gesto: 'Un zig-zag corto con un punto al final',
      porque: 'El zig-zag es el esqueleto de carbono y el punto marca el oxígeno del -OH. Es notación esquelética real.',
      trazos: [zigzag(0.02, 0.72, 0.30, 0.86, 2), P([0.86, 0.22], [0.96, 0.12])]
    },
    {
      id: 'benceno', nombre: 'Benceno', formula: 'C₆H₆', smiles: 'C1=CC=CC=C1',
      nombre_en: 'benzene',
      familia: 'Aromático', color: '#3a86ff', icono: '⬡',
      gesto: 'Un anillo cerrado con un círculo dentro',
      porque: 'Es la notación química estándar: el círculo interior representa los electrones π deslocalizados por todo el anillo.',
      trazos: [poligono(0.5, 0.5, 0.48, 6), circulo(0.5, 0.5, 0.22)]
    },
    {
      id: 'tolueno', nombre: 'Tolueno', formula: 'C₇H₈', smiles: 'CC1=CC=CC=C1',
      nombre_en: 'toluene',
      familia: 'Aromático sustituido', color: '#8338ec', icono: '⬡',
      gesto: 'Un anillo cerrado con una cola corta saliendo por fuera',
      porque: 'Es el benceno con un metilo colgando: el anillo es el esqueleto y la cola, el grupo añadido.',
      trazos: [poligono(0.42, 0.58, 0.40, 6), P([0.72, 0.30], [0.98, 0.04])]
    },

    /*
     * ══ TRES TRAZOS ══════════════════════════════════
     *
     * Aquí falta la cafeína ("cruz + círculo alrededor"), que sí estaba en la
     * propuesta. Al dibujarla mal acababa siendo etilenglicol el 13 % de las
     * veces: la cruz interior se pierde y lo que queda es un trazo con marcas
     * sueltas alrededor. Convertirse en otra molécula es el fallo que rompe la
     * confianza, así que se queda fuera.
     *
     * Y falta la aspirina ("hexágono + dos colas") por lo mismo: al degradarse
     * se vuelve fenol el 19 % de las veces. Un anillo con dos colas y un anillo
     * con círculo y una cola son, mal dibujados, la misma figura. El conjunto
     * se queda sin fármacos: son fichas de catálogo.
     */
    {
      id: 'ozono', nombre: 'Ozono', formula: 'O₃', smiles: '[O-][O+]=O',
      nombre_en: 'ozone',
      familia: 'Contaminante atmosférico', color: '#90e0ef', icono: '∴',
      gesto: 'Una línea larga con dos puntos encima',
      porque: 'Tres oxígenos con carga repartida: la línea es la base y los dos puntos, los oxígenos de los extremos.',
      trazos: [P([0.04, 0.80], [0.96, 0.80]), P([0.30, 0.16], [0.40, 0.06]), P([0.60, 0.16], [0.70, 0.06])]
    },
    {
      id: 'etilenglicol', nombre: 'Etilenglicol', formula: 'C₂H₆O₂', smiles: 'OCCO',
      nombre_en: 'ethylene glycol',
      familia: 'Diol / anticongelante', color: '#80ed99', icono: '⌁',
      gesto: 'Un zig-zag con un punto en cada extremo',
      porque: 'Un diol tiene DOS grupos -OH, uno en cada punta de la cadena. Por eso dos puntos y no uno.',
      trazos: [zigzag(0.10, 0.78, 0.34, 0.90, 2), P([0.02, 0.24], [0.10, 0.16]), P([0.88, 0.24], [0.96, 0.16])]
    },
    {
      id: 'cloroformo', nombre: 'Cloroformo', formula: 'CHCl₃', smiles: 'C(Cl)(Cl)Cl',
      nombre_en: 'chloroform',
      familia: 'Halogenado', color: '#a2d2ff', icono: '▽',
      gesto: 'Un triángulo con una línea colgando por debajo',
      porque: 'Los tres vértices son los tres cloros y la línea de abajo, el hidrógeno que queda solo.',
      trazos: [poligono(0.5, 0.36, 0.34, 3), P([0.5, 0.70], [0.5, 0.98])]
    },
    {
      id: 'fenol', nombre: 'Fenol', formula: 'C₆H₆O', smiles: 'C1=CC=C(C=C1)O',
      nombre_en: 'phenol',
      familia: 'Aromático con -OH', color: '#e76f51', icono: '⬡',
      gesto: 'Un anillo con círculo dentro y una cola por fuera',
      porque: 'Es el benceno (anillo + círculo aromático) más el -OH de la cola. Los tres trazos son las tres piezas.',
      trazos: [poligono(0.40, 0.60, 0.38, 6), circulo(0.40, 0.60, 0.16), P([0.70, 0.32], [0.98, 0.04])]
    }

  ];

  // ══════════════════════════════════════════════════════
  //  Reconocimiento
  // ══════════════════════════════════════════════════════

  // Descriptor de cada plantilla, calculado una sola vez con el mismo
  // extractor que analiza el dibujo de la persona.
  PLANTILLAS.forEach(p => { p.descriptor = descriptor(p.trazos); });

  /*
   * Distancia por encima de la cual no se afirma nada.
   *
   * Medido sobre miles de trazos simulados a mano alzada: un dibujo normal
   * queda a 0.030 de su plantilla el 99% de las veces, y uno claramente
   * descuidado a 0.085 el 95% de las veces. 0.12 acepta ambos y sólo rechaza
   * descriptores que no se parecen a nada.
   *
   * No pretende filtrar garabatos: con nueve señales tan simples, un garabato
   * al azar a veces ES un zig-zag válido. Lo que evita es afirmar una molécula
   * cuando el trazo no se parece a ninguna.
   */
  const DISTANCIA_MAXIMA = 0.12;

  function reconocer(strokes) {
    const d = descriptor(strokes);
    if (!d) return null;
    const ranking = PLANTILLAS
      .map(p => {
        const dist = distancia(d, p.descriptor);
        return {
          ...p,
          distancia: dist,
          // 100 % cuando el descriptor coincide; 0 % en el corte.
          puntaje: Math.max(0, Math.round((1 - dist / DISTANCIA_MAXIMA) * 100))
        };
      })
      .sort((a, b) => a.distancia - b.distancia);
    return {
      descriptor: d,
      reconocida: ranking[0].distancia <= DISTANCIA_MAXIMA,
      ranking
    };
  }

  return {
    descriptor, distancia, reconocer,
    PLANTILLAS, PESOS, CAMPOS, DISTANCIA_MAXIMA,
    // Expuestos para las pruebas y para la animación de la guía.
    _util: { simplificar, remuestrear, longitud, caja, poligono, circulo, zigzag, P }
  };
}));
