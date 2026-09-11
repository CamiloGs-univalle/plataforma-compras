/**
 * Script de migración de Google Apps Script a Firebase/Firestore
 *
 * Este script lee los datos del Google Sheet de Siamo y los exporta a Firestore.
 * Ejecutar desde Google Apps Script Editor.
 *
 * INSTRUCCIONES:
 * 1. Abrir el Google Sheet de Siamo
 * 2. Ir a Extensions > Apps Script
 * 3. Pegar este código
 * 4. Ejecutar la función migrarDatosAFirebase()
 */

// Configuración de Firebase
const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

function migrarDatosAFirebase() {
  const empresaId = "siamo"; // ID de la empresa en Firestore

  Logger.log("=== INICIO DE MIGRACIÓN ===");

  try {
    // 1. Migrar Usuarios
    Logger.log("Migrando usuarios...");
    const usuarios = migrarUsuarios(empresaId);
    Logger.log(`${usuarios.length} usuarios migrados`);

    // 2. Migrar Asignaciones
    Logger.log("Migrando asignaciones...");
    const asignaciones = migrarAsignaciones(empresaId);
    Logger.log(`${asignaciones.length} asignaciones migradas`);

    // 3. Migrar Productos
    Logger.log("Migrando productos...");
    const productos = migrarProductos(empresaId);
    Logger.log(`${productos.length} productos migrados`);

    // 4. Migrar Proveedores
    Logger.log("Migrando proveedores...");
    const proveedores = migrarProveedores(empresaId);
    Logger.log(`${proveedores.length} proveedores migrados`);

    Logger.log("=== MIGRACIÓN COMPLETADA ===");
    Logger.log("Resumen:");
    Logger.log(`- Usuarios: ${usuarios.length}`);
    Logger.log(`- Asignaciones: ${asignaciones.length}`);
    Logger.log(`- Productos: ${productos.length}`);
    Logger.log(`- Proveedores: ${proveedores.length}`);

  } catch (error) {
    Logger.log("Error en la migración: " + error.message);
  }
}

function migrarUsuarios(empresaId) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
  if (!hoja) {
    Logger.log("No se encontró la hoja 'Usuarios'");
    return [];
  }

  const datos = hoja.getDataRange().getValues();
  const usuarios = [];

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const usuario = {
      email: fila[0] + "@siamo.com.co", // Generar email basado en cédula
      nombre: fila[2] || "Sin nombre",
      rol: fila[3] === "Abastecimiento" ? "abastecimiento" : "solicitante",
      empresas: [empresaId],
      empresaActual: empresaId,
      activo: true,
      uid: fila[0].toString(), // Usar cédula como UID temporal
    };

    // Guardar en Firestore
    const docId = crearDocumentoEnFirestore("usuarios", usuario.uid, usuario);
    usuarios.push({ id: docId, ...usuario });
  }

  return usuarios;
}

function migrarAsignaciones(empresaId) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("AsignacionesUsuario");
  if (!hoja) {
    Logger.log("No se encontró la hoja 'AsignacionesUsuario'");
    return [];
  }

  const datos = hoja.getDataRange().getValues();
  const asignaciones = [];

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const asignacion = {
      empresaId: empresaId,
      uid: fila[0].toString(),
      centroTrabajo: fila[1] || "",
      cliente: fila[2] || "",
      contrato: fila[3] || "",
      unidadNegocio: fila[4] || "",
      proyecto: fila[5] || "",
      sucursal: fila[6] || "",
    };

    const docId = crearDocumentoEnFirestore("asignaciones", null, asignacion);
    asignaciones.push({ id: docId, ...asignacion });
  }

  return asignaciones;
}

function migrarProductos(empresaId) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Productos");
  if (!hoja) {
    Logger.log("No se encontró la hoja 'Productos'");
    return [];
  }

  const datos = hoja.getDataRange().getValues();
  const productos = [];

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const producto = {
      empresaId: empresaId,
      codigo: fila[0] || "",
      descripcion: fila[1] || "",
      cuentaMayor: fila[2] || "",
      nombreCuentaMayor: fila[3] || "",
      precioUnitario: parseFloat(fila[4]) || 0,
      indicadorImpuestos: fila[5] || "",
      activo: true,
    };

    if (producto.codigo) {
      const docId = crearDocumentoEnFirestore("productos", null, producto);
      productos.push({ id: docId, ...producto });
    }
  }

  return productos;
}

function migrarProveedores(empresaId) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("BaseProveedores");
  if (!hoja) {
    Logger.log("No se encontró la hoja 'BaseProveedores'");
    return [];
  }

  const datos = hoja.getDataRange().getValues();
  const encabezados = datos[0];
  const proveedores = [];

  // Los proveedores están en las columnas D en adelante (índice 3+)
  const nombresProveedores = [];
  for (let col = 3; col < encabezados.length; col++) {
    if (encabezados[col]) {
      nombresProveedores.push(encabezados[col]);
    }
  }

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const codigo = fila[0];
    if (!codigo) continue;

    const precios = {};
    for (let col = 3; col < encabezados.length; col++) {
      const nombreProveedor = encabezados[col];
      if (!nombreProveedor) continue;

      const valorCelda = fila[col];
      let precio = 0;

      if (typeof valorCelda === "number") {
        precio = valorCelda;
      } else {
        const textoLimpio = String(valorCelda || "")
          .replace(/[^0-9.,-]/g, "")
          .replace(/\./g, "")
          .replace(",", ".");
        precio = parseFloat(textoLimpio) || 0;
      }

      if (precio > 0) {
        precios[nombreProveedor] = precio;
      }
    }

    if (Object.keys(precios).length > 0) {
      const proveedor = {
        empresaId: empresaId,
        codigo: String(codigo),
        descripcion: fila[1] || "",
        grupoArticulo: fila[2] || "",
        precios: precios,
      };

      const docId = crearDocumentoEnFirestore("proveedores", null, proveedor);
      proveedores.push({ id: docId, ...proveedor });
    }
  }

  return proveedores;
}

function crearDocumentoEnFirestore(coleccion, documentoId, datos) {
  const url = documentoId
    ? `${FIREBASE_URL}/${coleccion}/${documentoId}`
    : `${FIREBASE_URL}/${coleccion}`;

  const options = {
    method: documentoId ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    payload: JSON.stringify({
      fields: convertirAFirestoreFormat(datos),
    }),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resultado = JSON.parse(response.getContentText());
    Logger.log(`Documento creado en ${coleccion}: ${resultado.name}`);
    return resultado.name.split("/").pop();
  } catch (error) {
    Logger.log(`Error al crear documento en ${coleccion}: ${error.message}`);
    return null;
  }
}

function convertirAFirestoreFormat(objeto) {
  const resultado = {};

  for (const [key, value] of Object.entries(objeto)) {
    if (value === null || value === undefined) {
      resultado[key] = { nullValue: null };
    } else if (typeof value === "string") {
      resultado[key] = { stringValue: value };
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) {
        resultado[key] = { integerValue: value };
      } else {
        resultado[key] = { doubleValue: value };
      }
    } else if (typeof value === "boolean") {
      resultado[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      resultado[key] = {
        arrayValue: {
          values: value.map((v) => convertirAFirestoreFormat({ temp: v }).temp),
        },
      };
    } else if (typeof value === "object") {
      resultado[key] = { mapValue: { fields: convertirAFirestoreFormat(value) } };
    }
  }

  return resultado;
}
