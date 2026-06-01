export interface MockProduct {
  id: number
  nombre: string
  descripcion: string
  precio: number
  categoria: string
  disponible: boolean
  emoji: string
}

export const mockProducts: MockProduct[] = [
  {
    id: 1,
    nombre: 'Pepián de Res',
    descripcion: 'Guiso tradicional con recado de pepitoria, chiles y tomate. Acompañado de arroz y tortillas.',
    precio: 85.0,
    categoria: 'Platos fuertes',
    disponible: true,
    emoji: '🍲',
  },
  {
    id: 2,
    nombre: "Kak'ik de Chompipe",
    descripcion: 'Sopa ceremonial Q\'eqchi\' de pavo con chile cobanero, tomate y especias ancestrales.',
    precio: 95.0,
    categoria: 'Sopas',
    disponible: true,
    emoji: '🍵',
  },
  {
    id: 3,
    nombre: 'Jocón de Pollo',
    descripcion: 'Pollo en salsa verde de miltomate, cilantro, güisquil y chile. Plato del altiplano occidental.',
    precio: 78.0,
    categoria: 'Platos fuertes',
    disponible: true,
    emoji: '🍗',
  },
  {
    id: 4,
    nombre: 'Tamales Colorados',
    descripcion: 'Tamales de masa con recado colorado, aceitunas y chile pimiento. Dos unidades por orden.',
    precio: 45.0,
    categoria: 'Antojitos',
    disponible: true,
    emoji: '🫔',
  },
  {
    id: 5,
    nombre: 'Chuchitos con Salsa',
    descripcion: 'Chuchitos de masa rellenos de carne adobada, bañados en salsa de tomate y chile. Tres unidades.',
    precio: 38.0,
    categoria: 'Antojitos',
    disponible: true,
    emoji: '🌽',
  },
  {
    id: 6,
    nombre: 'Tostadas Surtidas',
    descripcion: 'Seis tostadas de frijol, hierbas, pollo desmenuzado y aguacate. Salsa verde y roja.',
    precio: 42.0,
    categoria: 'Antojitos',
    disponible: false,
    emoji: '🫓',
  },
  {
    id: 7,
    nombre: 'Atol de Elote',
    descripcion: 'Bebida caliente de maíz tierno, canela y azúcar. Preparación artesanal, vaso grande.',
    precio: 18.0,
    categoria: 'Bebidas',
    disponible: true,
    emoji: '☕',
  },
  {
    id: 8,
    nombre: 'Café de Huehuetenango',
    descripcion: 'Café de origen único de las tierras altas de Huehuetenango. Notas a caramelo y chocolate oscuro.',
    precio: 22.0,
    categoria: 'Bebidas',
    disponible: true,
    emoji: '☕',
  },
  {
    id: 9,
    nombre: 'Rellenitos de Plátano',
    descripcion: 'Bolitas de plátano maduro rellenas de frijol negro dulce, fritas y espolvoreadas con azúcar.',
    precio: 28.0,
    categoria: 'Postres',
    disponible: true,
    emoji: '🍩',
  },
  {
    id: 10,
    nombre: 'Caldo de Res',
    descripcion: 'Caldo tradicional con costilla, güisquil, ejote, zanahoria, elote y hierbas del campo.',
    precio: 72.0,
    categoria: 'Sopas',
    disponible: true,
    emoji: '🥣',
  },
  {
    id: 11,
    nombre: 'Fiambre Rojo',
    descripcion: 'Ensalada tradicional de Todos Santos con embutidos, verduras encurtidas y escabeche.',
    precio: 110.0,
    categoria: 'Platos fuertes',
    disponible: false,
    emoji: '🥗',
  },
  {
    id: 12,
    nombre: 'Borracho de Chocolate',
    descripcion: 'Pastel húmedo de chocolate con licor de café guatemalteco. Porción individual.',
    precio: 35.0,
    categoria: 'Postres',
    disponible: true,
    emoji: '🍰',
  },
]

export const mockCategories = [...new Set(mockProducts.map((p) => p.categoria))]
