# Contexto para seguir mejorando el HTML en Codex

## Archivo principal
`disney_feb_2027_tab_cronograma.html`

## Objetivo
Página simple, mobile-first, para mostrar el presupuesto del viaje Disney World febrero 2027.
Tiene que funcionar bien en iPhone y ser fácil de entender para Moni.

## Audiencia
- Pablo, Lore y Franco: vista del costo base de ellos tres.
- Moni: vista separada para ver cuánto le costaría sumarse.
- Importante: no usar “Vista familia” porque Moni también es familia. Usar “Vista Lore, Pablo y Franco”.

## Estructura deseada
La página debe tener:
1. Resumen comparativo arriba.
2. Selector/tabs:
   - Value
   - Moderate
   - Deluxe
   - 📅 Cronograma
3. Detalle por hotel.
4. Vista separada de costos:
   - Lore, Pablo y Franco
   - Adicional Moni / total a pagar por Moni
5. Solapa de cronograma.
6. Pros/contras.
7. Cosas a hacer ya.
8. Notas de estimaciones.

## Requerimientos UX
- En iPhone tiene que poder seleccionarse hotel sin problemas.
- Las tarjetas del resumen deben ser tocables.
- Si se toca una tarjeta arriba, debe seleccionarse la misma opción abajo.
- Si se toca un tab, debe sincronizar:
  - tab activo
  - tarjeta resumen activa
  - detalle visible
- Evitar tablas anchas en mobile.
- Preferir cards verticales y texto corto.

## Datos principales
### Hoteles
- Value: Pop Century
  - Ventaja: Skyliner a EPCOT y Hollywood Studios.
  - Más visual/Disney para Franco.
- Moderate: Coronado Springs / Gran Destino Tower
  - Sweet spot costo/calidad.
  - Más adulto y cómodo.
- Deluxe: Polynesian
  - Monorriel a Magic Kingdom.
  - Extended Evening Hours en días/parques selectos.
  - Más caro, más experiencia premium.

### Cronograma sugerido — 9 días tranqui
1. Llegada MCO, check-in, descanso, pileta hotel.
2. Magic Kingdom día completo, llegar para opening.
3. Día tranqui: Disney Springs, cena, pileta.
4. EPCOT más tranqui, ideal con Franco: Frozen, Nemo.
5. Compras día 1: Premium Outlets + Mall at Millenia.
6. Animal Kingdom, mucha sombra, ideal mañana.
7. Legoland Florida, 1h en Uber, día completo.
8. Magic Kingdom repe + cena temática.
9. Compras día 2: souvenirs Disney Springs + Walmart/Target y vuelo nocturno.

## Recomendaciones de mejora futuras
- Agregar badges por día:
  - Tranqui
  - Medio
  - Intenso
  - Conviene Lightning Lane
- Agregar selector “viaje eficiente” vs “viaje mágico Franco”.
- Agregar una vista imprimible/PDF.
- Agregar conversión ARS aproximada opcional.
- Agregar nota: no incluye compras.
- Revisar textos de transporte:
  - Pop: Skyliner a EPCOT y Hollywood.
  - Polynesian: monorriel a Magic Kingdom; EPCOT requiere combinación vía TTC; Hollywood va por bus/Uber.
