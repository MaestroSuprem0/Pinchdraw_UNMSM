// ══════════════════════════════════════════════════════════════════
//  ELEMENTOS QUÍMICOS — fichas educativas para PinchDraw
//
//  Incluye los 10 elementos del PRIMER y SEGUNDO PERÍODO (H → Ne) y
//  los elementos más comunes de la vida diaria (hierro, mercurio,
//  cobre, aluminio…).
//
//  IMPORTANTE: un átomo aislado NO tiene forma que dibujar en el aire,
//  por eso estas fichas son de CATÁLOGO, no de reconocimiento por trazo.
//  Tampoco se les piden predicciones a la GNN: está entrenada con
//  moléculas orgánicas y sus resultados para un átomo suelto (sobre todo
//  metales) no tendrían sentido químico. En su lugar se muestran datos
//  reales del elemento: número atómico, masa, grupo, período y usos.
//
//  Masas atómicas: valores estándar IUPAC redondeados.
// ══════════════════════════════════════════════════════════════════
window.PINCHDRAW_ELEMENTOS = [
  // ───────────── PERÍODO 1 ─────────────
  {
    id:'el_h', simbolo:'H', numero_atomico:1, masa_atomica:1.008,
    grupo:1, periodo:1, familia:'No metal · Gas',
    nombre:'Hidrógeno', nombre_en:'Hydrogen', formula:'H',
    smiles:'[H]', peso:'1.008 u', color:'#e0f7ff', icono:'H',
    descripcion:'El elemento más ligero y abundante del universo. Un solo protón y un solo electrón. Forma parte del agua (H₂O) y de casi todos los compuestos orgánicos.',
    uso:'Está en toda el agua que bebes y en cada molécula de tu cuerpo. En la industria se usa para producir amoniaco (fertilizantes) y como combustible limpio en celdas de hidrógeno: al arder solo produce agua.',
    dato:'Las estrellas, incluido el Sol, brillan fusionando hidrógeno en helio.'
  },
  {
    id:'el_he', simbolo:'He', numero_atomico:2, masa_atomica:4.003,
    grupo:18, periodo:1, familia:'Gas noble',
    nombre:'Helio', nombre_en:'Helium', formula:'He',
    smiles:'[He]', peso:'4.003 u', color:'#c77dff', icono:'He',
    descripcion:'Gas noble: su capa electrónica está completa, así que no reacciona con nada. Es el segundo elemento más abundante del universo.',
    uso:'Infla los globos que flotan (es más ligero que el aire) y enfría los imanes superconductores de las máquinas de resonancia magnética en los hospitales.',
    dato:'Se descubrió en el Sol antes que en la Tierra; por eso se llama helio, de "Helios".'
  },
  // ───────────── PERÍODO 2 ─────────────
  {
    id:'el_li', simbolo:'Li', numero_atomico:3, masa_atomica:6.94,
    grupo:1, periodo:2, familia:'Metal alcalino',
    nombre:'Litio', nombre_en:'Lithium', formula:'Li',
    smiles:'[Li]', peso:'6.94 u', color:'#ff9f1c', icono:'Li',
    descripcion:'El metal más ligero que existe. Tan blando que se corta con un cuchillo, y tan reactivo que se guarda sumergido en aceite.',
    uso:'Es el corazón de las baterías recargables de tu celular, laptop y de los autos eléctricos. También se usa en medicina para tratar el trastorno bipolar.',
    dato:'Flota en el agua… pero reacciona con ella liberando hidrógeno.'
  },
  {
    id:'el_be', simbolo:'Be', numero_atomico:4, masa_atomica:9.012,
    grupo:2, periodo:2, familia:'Metal alcalinotérreo',
    nombre:'Berilio', nombre_en:'Beryllium', formula:'Be',
    smiles:'[Be]', peso:'9.012 u', color:'#ffd166', icono:'Be',
    descripcion:'Metal gris, ligero y muy rígido. Es raro en la corteza terrestre y su polvo resulta tóxico al inhalarse.',
    uso:'Se usa en herramientas que no deben producir chispas y en ventanas de equipos de rayos X, porque los deja pasar casi sin absorberlos.',
    dato:'Las esmeraldas y aguamarinas son cristales de berilo, un mineral de berilio.'
  },
  {
    id:'el_b', simbolo:'B', numero_atomico:5, masa_atomica:10.81,
    grupo:13, periodo:2, familia:'Metaloide',
    nombre:'Boro', nombre_en:'Boron', formula:'B',
    smiles:'[B]', peso:'10.81 u', color:'#4cc9f0', icono:'B',
    descripcion:'Metaloide: se comporta a medio camino entre metal y no metal. Es muy duro y mal conductor a temperatura ambiente.',
    uso:'El bórax que se usa como limpiador y el vidrio borosilicato (Pyrex) del material de laboratorio, que aguanta cambios bruscos de temperatura sin romperse.',
    dato:'Es un nutriente esencial para las plantas, aunque en exceso las daña.'
  },
  {
    id:'el_c', simbolo:'C', numero_atomico:6, masa_atomica:12.011,
    grupo:14, periodo:2, familia:'No metal',
    nombre:'Carbono', nombre_en:'Carbon', formula:'C',
    smiles:'[C]', peso:'12.011 u', color:'#adb5bd', icono:'C',
    descripcion:'El elemento de la vida. Puede formar cuatro enlaces y encadenarse consigo mismo casi sin límite: por eso existen millones de compuestos orgánicos.',
    uso:'Es la base de todo lo vivo, de los plásticos, los combustibles y los medicamentos. Toda la química orgánica —y casi todo este catálogo— se construye sobre él.',
    dato:'El grafito de tu lápiz y el diamante son el MISMO elemento; solo cambia cómo se ordenan sus átomos.'
  },
  {
    id:'el_n', simbolo:'N', numero_atomico:7, masa_atomica:14.007,
    grupo:15, periodo:2, familia:'No metal · Gas',
    nombre:'Nitrógeno', nombre_en:'Nitrogen', formula:'N',
    smiles:'[N]', peso:'14.007 u', color:'#7b2cbf', icono:'N',
    descripcion:'Gas incoloro que forma el 78 % del aire que respiras. Como molécula N₂ tiene un triple enlace muy fuerte, lo que lo vuelve poco reactivo.',
    uso:'Es la materia prima de los fertilizantes que alimentan al mundo. En forma líquida (−196 °C) congela alimentos y conserva muestras biológicas.',
    dato:'Está en todos los aminoácidos y en tu ADN: sin nitrógeno no habría proteínas.'
  },
  {
    id:'el_o', simbolo:'O', numero_atomico:8, masa_atomica:15.999,
    grupo:16, periodo:2, familia:'No metal · Gas',
    nombre:'Oxígeno', nombre_en:'Oxygen', formula:'O',
    smiles:'[O]', peso:'15.999 u', color:'#ef476f', icono:'O',
    descripcion:'El elemento más abundante de la corteza terrestre y el 21 % del aire. Es muy electronegativo: arranca electrones con facilidad, por eso oxida.',
    uso:'Lo respiras para obtener energía de los alimentos. Permite toda combustión, se usa en hospitales y en soldadura. Combinado con hidrógeno forma el agua.',
    dato:'La herrumbre de una reja es hierro que reaccionó lentamente con el oxígeno del aire.'
  },
  {
    id:'el_f', simbolo:'F', numero_atomico:9, masa_atomica:18.998,
    grupo:17, periodo:2, familia:'Halógeno',
    nombre:'Flúor', nombre_en:'Fluorine', formula:'F',
    smiles:'[F]', peso:'18.998 u', color:'#80ed99', icono:'F',
    descripcion:'El elemento más electronegativo y reactivo de todos. Ataca casi cualquier material; en estado puro es un gas amarillo pálido peligrosísimo.',
    uso:'Como fluoruro protege el esmalte dental en las pastas de dientes. Sus compuestos forman el teflón antiadherente de las sartenes.',
    dato:'Los PFAS de este catálogo —los "químicos eternos"— deben su enorme persistencia al enlace carbono-flúor, uno de los más fuertes de la química orgánica.'
  },
  {
    id:'el_ne', simbolo:'Ne', numero_atomico:10, masa_atomica:20.180,
    grupo:18, periodo:2, familia:'Gas noble',
    nombre:'Neón', nombre_en:'Neon', formula:'Ne',
    smiles:'[Ne]', peso:'20.180 u', color:'#f72585', icono:'Ne',
    descripcion:'Gas noble inerte: con su capa electrónica completa, prácticamente no forma compuestos.',
    uso:'Los letreros luminosos de neón: al pasar electricidad por el gas, emite ese característico brillo rojo-anaranjado.',
    dato:'Cada gas noble brilla de un color distinto; el rojo intenso es la firma del neón.'
  },
  // ───────────── ELEMENTOS COMUNES DEL DÍA A DÍA ─────────────
  {
    id:'el_na', simbolo:'Na', numero_atomico:11, masa_atomica:22.990,
    grupo:1, periodo:3, familia:'Metal alcalino',
    nombre:'Sodio', nombre_en:'Sodium', formula:'Na',
    smiles:'[Na]', peso:'22.990 u', color:'#ffb703', icono:'Na',
    descripcion:'Metal blando y plateado tan reactivo que arde al contacto con el agua. Nunca se encuentra puro en la naturaleza.',
    uso:'Unido al cloro forma la sal de mesa (NaCl). En tu cuerpo, los iones sodio transmiten los impulsos nerviosos y regulan el agua corporal.',
    dato:'El sodio metálico explota en agua, pero como ion en la sal es inofensivo y esencial.'
  },
  {
    id:'el_mg', simbolo:'Mg', numero_atomico:12, masa_atomica:24.305,
    grupo:2, periodo:3, familia:'Metal alcalinotérreo',
    nombre:'Magnesio', nombre_en:'Magnesium', formula:'Mg',
    smiles:'[Mg]', peso:'24.305 u', color:'#e9c46a', icono:'Mg',
    descripcion:'Metal ligero y plateado que arde con una llama blanca deslumbrante.',
    uso:'Está en el centro de la clorofila: sin magnesio las plantas no harían fotosíntesis. También en ruedas de autos, laptops y suplementos para los músculos.',
    dato:'Los antiguos flashes de fotografía funcionaban quemando magnesio.'
  },
  {
    id:'el_al', simbolo:'Al', numero_atomico:13, masa_atomica:26.982,
    grupo:13, periodo:3, familia:'Metal',
    nombre:'Aluminio', nombre_en:'Aluminium', formula:'Al',
    smiles:'[Al]', peso:'26.982 u', color:'#adb5bd', icono:'Al',
    descripcion:'El metal más abundante de la corteza terrestre. Ligero y resistente a la corrosión porque se cubre de una capa protectora de óxido.',
    uso:'Papel de aluminio de la cocina, latas de bebida, ventanas, aviones. Se recicla infinitas veces gastando solo el 5 % de la energía original.',
    dato:'En el siglo XIX era más caro que el oro, porque no se sabía separarlo bien de su mineral.'
  },
  {
    id:'el_si', simbolo:'Si', numero_atomico:14, masa_atomica:28.085,
    grupo:14, periodo:3, familia:'Metaloide',
    nombre:'Silicio', nombre_en:'Silicon', formula:'Si',
    smiles:'[Si]', peso:'28.085 u', color:'#8ecae6', icono:'Si',
    descripcion:'Metaloide semiconductor, segundo elemento más abundante de la corteza terrestre. Está en la arena en forma de sílice (SiO₂).',
    uso:'Es la base de TODA la electrónica moderna: los chips de tu celular y computadora son obleas de silicio ultrapuro. También hace el vidrio y el cemento.',
    dato:'Silicon Valley se llama así por este elemento, no por la silicona.'
  },
  {
    id:'el_p', simbolo:'P', numero_atomico:15, masa_atomica:30.974,
    grupo:15, periodo:3, familia:'No metal',
    nombre:'Fósforo', nombre_en:'Phosphorus', formula:'P',
    smiles:'[P]', peso:'30.974 u', color:'#fb8500', icono:'P',
    descripcion:'No metal que existe en varias formas; el fósforo blanco arde espontáneamente en contacto con el aire.',
    uso:'Cabezas de cerillas y fertilizantes. En tu cuerpo forma los huesos y dientes, y el ATP que transporta la energía en cada célula.',
    dato:'La columna vertebral del ADN está hecha de grupos fosfato.'
  },
  {
    id:'el_s', simbolo:'S', numero_atomico:16, masa_atomica:32.06,
    grupo:16, periodo:3, familia:'No metal',
    nombre:'Azufre', nombre_en:'Sulfur', formula:'S',
    smiles:'[S]', peso:'32.06 u', color:'#ffd60a', icono:'S',
    descripcion:'Sólido amarillo brillante, conocido desde la antigüedad. Aparece en zonas volcánicas y tiene olor característico en sus compuestos.',
    uso:'Se usa para fabricar ácido sulfúrico (el químico industrial más producido del mundo) y para vulcanizar el caucho de los neumáticos.',
    dato:'El olor de la cebolla, el ajo y los huevos podridos viene de compuestos de azufre.'
  },
  {
    id:'el_cl', simbolo:'Cl', numero_atomico:17, masa_atomica:35.45,
    grupo:17, periodo:3, familia:'Halógeno',
    nombre:'Cloro', nombre_en:'Chlorine', formula:'Cl',
    smiles:'[Cl]', peso:'35.45 u', color:'#c1f000', icono:'Cl',
    descripcion:'Gas verde-amarillento, tóxico y de olor penetrante. Muy reactivo, pertenece a la familia de los halógenos.',
    uso:'Desinfecta el agua potable y las piscinas, eliminando bacterias. Con sodio forma la sal común. Es la base de la lejía y del plástico PVC.',
    dato:'Muchos pesticidas de este catálogo llevan cloro: eso los hace persistentes en el ambiente.'
  },
  {
    id:'el_k', simbolo:'K', numero_atomico:19, masa_atomica:39.098,
    grupo:1, periodo:4, familia:'Metal alcalino',
    nombre:'Potasio', nombre_en:'Potassium', formula:'K',
    smiles:'[K]', peso:'39.098 u', color:'#f4a261', icono:'K',
    descripcion:'Metal alcalino blando y muy reactivo. Su símbolo K viene del latín "kalium".',
    uso:'Es uno de los tres nutrientes principales de los fertilizantes (N-P-K). En tu cuerpo regula el latido del corazón y la contracción muscular.',
    dato:'El plátano es famoso por su potasio, clave para evitar calambres.'
  },
  {
    id:'el_ca', simbolo:'Ca', numero_atomico:20, masa_atomica:40.078,
    grupo:2, periodo:4, familia:'Metal alcalinotérreo',
    nombre:'Calcio', nombre_en:'Calcium', formula:'Ca',
    smiles:'[Ca]', peso:'40.078 u', color:'#e9edc9', icono:'Ca',
    descripcion:'Metal blanco plateado, quinto elemento más abundante de la corteza terrestre.',
    uso:'Forma tus huesos y dientes como fosfato de calcio. Como carbonato es la piedra caliza, el mármol, la tiza y las conchas marinas. Base del cemento.',
    dato:'El 99 % del calcio de tu cuerpo está en el esqueleto.'
  },
  {
    id:'el_fe', simbolo:'Fe', numero_atomico:26, masa_atomica:55.845,
    grupo:8, periodo:4, familia:'Metal de transición',
    nombre:'Hierro', nombre_en:'Iron', formula:'Fe',
    smiles:'[Fe]', peso:'55.845 u', color:'#9c6644', icono:'Fe',
    descripcion:'Metal de transición, el más usado del planeta. Su símbolo Fe viene del latín "ferrum". Se oxida formando herrumbre.',
    uso:'Aleado con carbono da el acero: vigas, puertas, herramientas, autos y electrodomésticos de tu casa. En tu sangre, la hemoglobina lleva un átomo de hierro que transporta el oxígeno.',
    dato:'El núcleo de la Tierra es mayormente hierro, y es lo que genera el campo magnético que nos protege.'
  },
  {
    id:'el_cu', simbolo:'Cu', numero_atomico:29, masa_atomica:63.546,
    grupo:11, periodo:4, familia:'Metal de transición',
    nombre:'Cobre', nombre_en:'Copper', formula:'Cu',
    smiles:'[Cu]', peso:'63.546 u', color:'#e07a5f', icono:'Cu',
    descripcion:'Metal rojizo, excelente conductor de electricidad y calor. Su símbolo Cu viene del latín "cuprum".',
    uso:'Todo el cableado eléctrico de tu casa, las tuberías de agua y los circuitos electrónicos. También en monedas y en utensilios de cocina.',
    dato:'Fue el primer metal trabajado por el ser humano; al mezclarlo con estaño nació la Edad del Bronce.'
  },
  {
    id:'el_zn', simbolo:'Zn', numero_atomico:30, masa_atomica:65.38,
    grupo:12, periodo:4, familia:'Metal de transición',
    nombre:'Zinc', nombre_en:'Zinc', formula:'Zn',
    smiles:'[Zn]', peso:'65.38 u', color:'#8d99ae', icono:'Zn',
    descripcion:'Metal azulado que se oxida formando una capa protectora, muy usado para proteger otros metales.',
    uso:'Galvaniza el hierro para que no se oxide (techos, clavos, rejas). Está en las pilas, en las cremas para quemaduras y en suplementos para el sistema inmune.',
    dato:'Mezclado con cobre forma el latón de las llaves y los instrumentos musicales.'
  },
  {
    id:'el_ag', simbolo:'Ag', numero_atomico:47, masa_atomica:107.868,
    grupo:11, periodo:5, familia:'Metal de transición',
    nombre:'Plata', nombre_en:'Silver', formula:'Ag',
    smiles:'[Ag]', peso:'107.868 u', color:'#dee2e6', icono:'Ag',
    descripcion:'Metal precioso blanco y brillante. Es el mejor conductor de electricidad y calor de todos los elementos. Su símbolo viene del latín "argentum".',
    uso:'Joyería, cubiertos y espejos. Sus sales fueron la base de la fotografía analógica, y hoy se usa como antibacteriano en vendajes y en paneles solares.',
    dato:'Los cubiertos de plata se ennegrecen por reacción con el azufre del aire, no por oxidación.'
  },
  {
    id:'el_au', simbolo:'Au', numero_atomico:79, masa_atomica:196.967,
    grupo:11, periodo:6, familia:'Metal de transición',
    nombre:'Oro', nombre_en:'Gold', formula:'Au',
    smiles:'[Au]', peso:'196.967 u', color:'#ffd700', icono:'Au',
    descripcion:'Metal precioso amarillo, muy denso y prácticamente inalterable: no se oxida ni se corroe. Su símbolo Au viene del latín "aurum".',
    uso:'Joyería y reserva de valor. Por no oxidarse y conducir muy bien, recubre los contactos eléctricos de celulares y computadoras. También en odontología.',
    dato:'Es tan maleable que con un gramo se puede estirar un hilo de más de dos kilómetros.'
  },
  {
    id:'el_hg', simbolo:'Hg', numero_atomico:80, masa_atomica:200.592,
    grupo:12, periodo:6, familia:'Metal de transición',
    nombre:'Mercurio', nombre_en:'Mercury', formula:'Hg',
    smiles:'[Hg]', peso:'200.592 u', color:'#b8c0c8', icono:'Hg',
    descripcion:'El único metal líquido a temperatura ambiente. Denso, plateado y brillante. Su símbolo Hg viene de "hydrargyrum" (plata líquida). Es muy tóxico.',
    uso:'Fue el metal de los termómetros clásicos porque se dilata de forma uniforme con el calor. Hoy está siendo retirado por su toxicidad: los termómetros modernos usan alcohol o son digitales.',
    dato:'Se acumula en los peces grandes como el atún, y por eso se recomienda moderar su consumo.'
  },
  {
    id:'el_pb', simbolo:'Pb', numero_atomico:82, masa_atomica:207.2,
    grupo:14, periodo:6, familia:'Metal',
    nombre:'Plomo', nombre_en:'Lead', formula:'Pb',
    smiles:'[Pb]', peso:'207.2 u', color:'#6c757d', icono:'Pb',
    descripcion:'Metal gris, muy denso y blando. Su símbolo Pb viene del latín "plumbum". Es un tóxico acumulativo, sobre todo peligroso para los niños.',
    uso:'Baterías de auto y blindajes contra la radiación en salas de rayos X. Se eliminó de las gasolinas y las pinturas al confirmarse que daña el sistema nervioso.',
    dato:'Las tuberías romanas eran de plomo: de "plumbum" viene la palabra plomería.'
  }
];
