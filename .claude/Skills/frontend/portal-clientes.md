---
name: cloudcommerce-portal-clientes
description: Skill de extensión para construir el portal del cliente cloudcommerce usando el mismo sistema visual del catálogo.
version: 1.0.0
scope: customer-portal, account-dashboard, ecommerce, frontend-ui
---

# Skill — Portal de clientes cloudcommerce

## 1. Objetivo

Extender el sistema visual del catálogo hacia un portal de cliente: resumen de gastos, compras, remitos, facturas, estados de pedido, direcciones, métodos de pago, puntos y beneficios.

Aunque esta skill no es necesaria para el primer catálogo, mantiene continuidad visual para que el producto completo parezca una plataforma única.

## 2. Módulos del portal

```txt
CustomerPortal
├─ AccountSidebar
├─ WelcomeSummary
├─ MetricCards
├─ SpendingChart
├─ RecentPurchases
├─ OrderStatusList
├─ FavoriteCategories
├─ RecentlyViewed
├─ SavedAddresses
├─ PaymentMethods
├─ DocumentsTable
│  ├─ Remitos
│  ├─ Facturas
│  └─ Notas de crédito
├─ ImpactCard
└─ LoyaltyProgress
```

## 3. Estética

Debe compartir tokens con el catálogo:

- fondo blanco,
- cards con radio `18px–22px`,
- azul primario `#0B6BFF`,
- verde para estados positivos,
- naranja para pendientes/preparando,
- sombras suaves,
- iconografía lineal.

## 4. Métricas principales

Cards superiores:

- Total gastado.
- Total ahorrado.
- Compras realizadas.
- CloudPoints.

Cada card debe tener:

- título pequeño,
- número grande,
- variación porcentual,
- mini gráfico o icono,
- hover sutil.

## 5. Resumen de gastos

Gráfico de línea con:

- monto total,
- variación anual,
- selector de periodo,
- tooltip,
- desglose por categoría.

Visual:

- línea azul,
- área azul muy suave,
- puntos redondos,
- gridline gris claro.

## 6. Últimas compras

Lista compacta:

```txt
[thumbnail] Televisor Samsung 55” QLED 4K
            $ 2.799.900 · Hace 2 días
```

Miniaturas con radio `8px–10px`, imagen centrada y fondo claro.

## 7. Estado de pedidos

Estados:

- En tránsito — azul.
- Preparando — naranja.
- Entregado — verde.
- Cancelado — gris.

Cada fila:

- icono circular,
- número de pedido,
- fecha/ETA,
- badge de estado alineado derecha.

## 8. Remitos, facturas y notas de crédito

Tabla premium:

```txt
Número | Pedido | Fecha | Estado | Total | Descargar
```

Reglas:

- Tab `Remitos` activo en azul.
- Estado `Disponible` en badge verde suave.
- Botón PDF pequeño con borde azul suave.
- Filas con hover `#F8FAFD`.
- Cabecera gris muy clara.

## 9. Direcciones y pagos

Cards compactas:

- `Casa`, `Oficina`, etc.
- Badge `Principal` verde suave.
- Botón `Agregar nueva dirección`.
- Métodos de pago con logos/labels y vencimiento.

## 10. Loyalty / cloudprime

Panel de progreso:

- anillo circular `75%`,
- texto de próximo nivel,
- beneficios activados,
- CTA `Conocer todos los beneficios`.

Usar azul como foco y fondo blanco.

## 11. Checklist

- ¿Se siente parte de cloudcommerce?
- ¿Las métricas son legibles?
- ¿Los documentos/remitos están claros?
- ¿Los estados usan colores consistentes?
- ¿Las cards mantienen el mismo radio y sombra del catálogo?
- ¿El portal no parece un dashboard administrativo genérico?
