# Plataforma de Compras Multi-Empresas

Sistema de seguimiento de órdenes de compra para múltiples empresas (Siamo, Proservis, Affine).

## Características

- **Multi-empresas**: Gestiona solicitudes para diferentes empresas desde una sola plataforma
- **Login con Google**: Autenticación segura con cuentas de Google
- **Autollenado**: Los campos se completan automáticamente según el centro de trabajo
- **Seguimiento en tiempo real**: Rastrea el estado de cada solicitud
- **Cotizaciones**: Gestiona hasta 3 proveedores por producto
- **Roles**: Solicitante, Abastecimiento, Admin de empresa, Super Admin

## Requisitos

- Node.js 18+
- npm o yarn
- Cuenta de Google Cloud Platform
- Proyecto de Firebase

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd plataforma-compras

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Firebase

# Ejecutar en desarrollo
npm run dev
```

## Configuración de Firebase

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com/)

2. Habilitar los siguientes servicios:
   - **Authentication**: Habilitar método "Google"
   - **Firestore Database**: Crear base de datos
   - **Hosting** (opcional): Para despliegue

3. Obtener la configuración del proyecto:
   - Ir a Project Settings > General > Your apps
   - Copiar los valores a `.env.local`

4. Configurar reglas de Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Reglas para empresas
    match /empresas/{empresaId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'super_admin';
    }

    // Reglas para usuarios
    match /usuarios/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol in ['admin_empresa', 'super_admin']);
      allow write: if request.auth != null && (request.auth.uid == uid || get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol in ['admin_empresa', 'super_admin']);
    }

    // Reglas para solicitudes
    match /solicitudes/{solicitudId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol in ['abastecimiento', 'admin_empresa', 'super_admin'];
    }
  }
}
```

## Estructura de Firestore

```
empresas/
  {empresaId}/
    nombre: string
    nit: string
    color: string
    activa: boolean

usuarios/
  {uid}/
    email: string
    nombre: string
    rol: 'solicitante' | 'abastecimiento' | 'admin_empresa' | 'super_admin'
    empresas: string[]
    empresaActual: string

asignaciones/
  {asignacionId}/
    empresaId: string
    uid: string
    centroTrabajo: string
    cliente: string
    contrato: string
    unidadNegocio: string
    proyecto: string
    sucursal: string

productos/
  {productoId}/
    empresaId: string
    codigo: string
    descripcion: string
    cuentaMayor: string
    precioUnitario: number

solicitudes/
  {solicitudId}/
    empresaId: string
    numero: number
    usuario: string
    nombreUsuario: string
    centroTrabajo: string
    prioridad: string
    items: array
    estado: string
    respuesta: string

proveedores/
  {proveedorId}/
    empresaId: string
    codigo: string
    precios: map
```

## Migración desde Google Apps Script

1. Abrir el Google Sheet de Siamo
2. Ir a Extensions > Apps Script
3. Pegar el código de `scripts/migrar-siamo.gs`
4. Configurar las variables de Firebase en el script
5. Ejecutar la función `migrarDatosAFirebase()`

## Despliegue

### Opción 1: Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel
```

### Opción 2: Firebase Hosting

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar
firebase init hosting

# Desplegar
firebase deploy
```

## Roles y Permisos

| Rol | Ver solicitudes | Crear solicitudes | Gestionar cotizaciones | Adminstrar usuarios |
|-----|-----------------|-------------------|------------------------|---------------------|
| Solicitante | Solo propias | Sí | No | No |
| Abastecimiento | Todas | No | Sí | No |
| Admin empresa | Todas | Sí | Sí | Sí |
| Super admin | Todas | Sí | Sí | Sí |

## Desarrollo

```bash
# Ejecutar en desarrollo
npm run dev

# Build de producción
npm run build

# Ejecutar producción
npm start

# Linting
npm run lint
```

## Licencia

Propietario - Uso interno
