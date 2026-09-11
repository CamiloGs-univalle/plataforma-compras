'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  File,
  Trash2,
} from 'lucide-react';
import { 
  generateTemplateExcel, 
  parseExcelUpload, 
  EXCEL_TEMPLATES 
} from '@/lib/excel-templates';

interface ExcelUploadProps {
  templateKey: string;
  onUpload: (data: any[]) => Promise<void>;
  className?: string;
}

export function ExcelUpload({ templateKey, onUpload, className }: ExcelUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const template = EXCEL_TEMPLATES[templateKey];

  const handleDownloadTemplate = () => {
    generateTemplateExcel(templateKey);
  };

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrors([]);
    setPreview([]);
    setSuccess(false);

    try {
      const { data, errors: parseErrors } = await parseExcelUpload(selectedFile, templateKey);
      setPreview(data);
      setErrors(parseErrors);
    } catch (err) {
      setErrors(['Error al procesar el archivo']);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      handleFileChange(droppedFile);
    } else {
      setErrors(['Solo se permiten archivos .xlsx']);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    
    setUploading(true);
    try {
      await onUpload(preview);
      setSuccess(true);
      setFile(null);
      setPreview([]);
    } catch (err) {
      setErrors(['Error al subir los datos']);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
    setSuccess(false);
  };

  if (!template) return null;

  return (
    <div className={className}>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Carga Masiva - {template.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {template.description}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="shrink-0"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Plantilla
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : file
                ? 'border-green-500 bg-green-50'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) handleFileChange(selectedFile);
              }}
            />
            
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center"
                >
                  <CheckCircle2 className="h-12 w-12 text-green-600 mb-3" />
                  <p className="font-medium text-green-700">Datos cargados exitosamente</p>
                  <p className="text-sm text-green-600 mt-1">
                    {preview.length} registros procesados
                  </p>
                </motion.div>
              ) : file ? (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center"
                >
                  <File className="h-12 w-12 text-green-600 mb-3" />
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {preview.length} registros encontrados
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center"
                >
                  <Upload className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="font-medium text-foreground">
                    Arrastra tu archivo aqui o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Solo archivos .xlsx
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="font-medium text-destructive">
                  Errores encontrados ({errors.length})
                </p>
              </div>
              <ul className="text-sm text-destructive/80 space-y-1 max-h-32 overflow-y-auto">
                {errors.slice(0, 10).map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
                {errors.length > 10 && (
                  <li className="font-medium">... y {errors.length - 10} errores mas</li>
                )}
              </ul>
            </motion.div>
          )}

          {/* Preview Table */}
          {preview.length > 0 && !success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border rounded-lg overflow-hidden"
            >
              <div className="bg-muted/50 px-4 py-2 border-b">
                <p className="text-sm font-medium">
                  Vista previa ({preview.length} registros)
                </p>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      {template.headers.slice(0, 5).map((header) => (
                        <th
                          key={header}
                          className="px-4 py-2 text-left font-medium text-muted-foreground border-b"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        {template.headers.slice(0, 5).map((header) => (
                          <td key={header} className="px-4 py-2">
                            {row[header.toLowerCase().replace(/\s+/g, '')] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 5 && (
                <div className="bg-muted/30 px-4 py-2 text-center text-sm text-muted-foreground">
                  Mostrando 5 de {preview.length} registros
                </div>
              )}
            </motion.div>
          )}

          {/* Action Buttons */}
          {file && !success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end gap-3"
            >
              <Button variant="outline" onClick={handleClear}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || preview.length === 0 || errors.length > 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Subir {preview.length} registros
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* Required Fields Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Campos obligatorios:</p>
            <div className="flex flex-wrap gap-2">
              {template.requiredFields.map((field) => (
                <Badge key={field} variant="secondary" className="text-xs">
                  {field}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
