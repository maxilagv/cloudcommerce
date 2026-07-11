# Product

## Register

product

## Platform

web

## Users

Compradores online de habla hispana (Argentina — precios en ARS, `lang="es"`, `locale es_AR`) que buscan productos de consumo a precios competitivos con envío confiable. Llegan buscando un producto puntual (búsqueda o categoría), comparan precio/envío/reputación, y esperan un checkout rápido sin fricción. Usuarios recurrentes vuelven a trackear pedidos, revisar puntos de fidelidad (CloudPoints) y gestionar direcciones/documentos desde su panel de cuenta.

## Product Purpose

CloudCommerce Store es el escaparate público de una operación de dropshipping: el dueño importa productos de proveedores, los vende con markup, y el pedido se reenvía automáticamente al proveedor para su cumplimiento. El producto existe para que comprar se sienta simple, rápido y confiable — sin exponer nunca la complejidad del dropshipping al cliente. Éxito = conversión (agregar al carrito → completar checkout) y confianza suficiente para volver (tracking claro, panel de cuenta transparente).

## Positioning

Una tienda online que se ve y se siente premium sin la fricción ni los precios de una tienda "de marca" — a la altura de MercadoLibre en confianza percibida, con la pulcritud visual y las microinteracciones de una app moderna tipo Apple.

## Brand Personality

Confiable, moderno, accesible. Cercano pero no informal — el tono es claro y directo en español, nunca corporativo ni robótico. La estética existente ya lo expresa: azul de marca `#0B6BFF`, superficies muy limpias, radios generosos, sombras ambientales suaves, microinteracciones consistentes (hover lift, badge pop, stagger de entrada).

## Anti-references

- Gradientes morado-azul genéricos de IA, glassmorphism aplicado a todo, tres feature cards idénticas — los defaults de "AI slop".
- Marketplaces recargados y ruidosos (demasiados banners, densidad visual alta, contraste bajo en texto gris sobre gris).
- Checkouts largos, formularios sin feedback claro, spinners genéricos sin marca.

## Design Principles

- **Preservar, no reinventar**: el sistema `--cc-*` ya está bien resuelto (paleta, radios, sombras, tipografía). Este ciclo de trabajo lo eleva con motion y estados faltantes, no lo reemplaza.
- **Animación con propósito**: cada animación responde a la pregunta "¿por qué se mueve esto?" (framework de Emil Kowalski) — nunca movimiento decorativo en acciones frecuentes.
- **Velocidad percibida primero**: en e-commerce, un layout shift o un salto brusco de carga cuesta conversión más que la ausencia de una animación bonita.
- **Consistencia sobre novedad**: un solo lenguaje de springs/easings/duraciones (`lib/motion.ts` + tokens `--cc-*`) en toda la store.
- **Es-AR real**: copy, formato de moneda y tono siempre en español argentino, nunca literal del inglés.

## Accessibility & Inclusion

Objetivo WCAG 2.1 AA: contraste ≥4.5:1 en texto, touch targets ≥44px, navegación completa por teclado con foco visible, `prefers-reduced-motion` respetado en toda animación nueva. Sin requisitos de accesibilidad adicionales conocidos más allá del estándar AA.
