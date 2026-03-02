# Manual de Operación — Mercado Pago (Merchant)

## 1. Objetivo

Definir la operación diaria y contingencias para pagos Mercado Pago en Orders Management.

## 2. Operación Diaria

1. Validar que la terminal esté en línea.
2. Confirmar que la cuenta MP siga conectada.
3. Procesar cobros PDV/QR por orden cerrada.
4. Monitorear notificaciones en Configuración → Notificaciones.

## 3. Gestión de Estados de Pago

- approved: pedido cobrado correctamente.
- processing/pending: esperar actualización webhook.
- rejected: solicitar nuevo intento de pago.
- canceled/error: reiniciar flujo de cobro.

## 4. Reintentos y Cancelaciones

- Ante rechazo, crear nuevo intento de cobro.
- Si cliente abandona, cancelar intento activo.
- Evitar múltiples intentos simultáneos para la misma orden.

## 5. Reembolsos

1. Identificar payment_id.
2. Ejecutar reembolso completo o parcial.
3. Confirmar en dashboard de MP y en auditoría interna.

## 6. Alertas de Dispositivo

Cuando exista alerta de dispositivo (reset/desconexión):

1. Revisar alimentación y red de la terminal.
2. Confirmar modo operativo (PDV/STANDALONE).
3. Ejecutar cobro de prueba de bajo monto.
4. Escalar a soporte si persiste la falla.

## 7. Suscripción y Entitlements

- Si la suscripción está activa o en gracia, funciones MP habilitadas.
- Si está canceled/expired/past_due sin regularizar, funciones MP bloqueadas.
- Revisar eventos de suscripción en notificaciones.

## 8. Monitoreo y Auditoría

- Revisar eventos de webhook y errores de integración.
- Revisar alertas críticas (claims, mp-connect, device alerts).
- Consultar reportes de settlement/release en ventanas periódicas.

## 9. Escalación

Escalar cuando:

- Más de 3 rechazos consecutivos en terminal.
- Webhooks no aplican cambios de estado.
- OAuth se desvincula repetidamente.
- Reportes financieros no cuadran con ventas.
