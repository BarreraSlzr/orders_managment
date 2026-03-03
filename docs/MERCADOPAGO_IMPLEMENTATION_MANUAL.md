# Manual de Implementación — Mercado Pago (Merchant)

## 1. Objetivo

Este manual guía al comercio para activar Mercado Pago en Orders Management con OAuth, terminales Point y cobro QR.

## 2. Requisitos Previos

- Cuenta activa de Mercado Pago del comercio
- Usuario con rol manager/admin en Orders Management
- Acceso a Configuración → Mercado Pago

## 3. Conectar Cuenta (OAuth)

1. Entrar a Configuración.
2. Abrir la sección Mercado Pago.
3. Capturar correo de contacto del comercio.
4. Hacer clic en Conectar Mercado Pago.
5. Autorizar permisos en Mercado Pago.
6. Volver a Orders Management y confirmar estado conectado.

## 4. Configurar Sucursal y Caja (Store/POS)

1. En Configuración → Mercado Pago, crear o actualizar Sucursal.
2. Crear o actualizar POS asociado a esa Sucursal.
3. Confirmar que aparece al menos una terminal en el listado.

## 5. Flujos de Cobro

### 5.1 Cobro en Terminal Point (PDV)

1. Cerrar orden.
2. Elegir Cobrar con Mercado Pago.
3. Seleccionar flujo PDV.
4. Esperar aprobación/rechazo en la orden.

### 5.2 Cobro con QR

1. Cerrar orden.
2. Elegir Cobrar con Mercado Pago.
3. Seleccionar flujo QR.
4. Mostrar QR al cliente y esperar confirmación.

## 6. Suscripción de Plataforma

1. Abrir /onboardings/billing.
2. Capturar correo de Mercado Pago.
3. Presionar Suscribirse.
4. Completar checkout en Mercado Pago.
5. Verificar estatus activo tras callback/webhook.

## 7. Verificación Rápida (Checklist)

- OAuth conectado
- Sucursal y POS creados
- Terminal visible
- Cobro PDV exitoso
- Cobro QR exitoso
- Suscripción activa

## 8. Errores Comunes

- No autenticado: volver a iniciar sesión.
- Suscripción inactiva: renovar pago del plan.
- Terminal no disponible: revisar conexión y modo del dispositivo.
- Webhook sin efectos: validar configuración de webhook en MP.
