export interface StorageDriver {
  /**
   * Guarda el archivo y devuelve la key con la que se referencia en la base
   * (por ejemplo `productos/<id>/<uuid>.webp`). Nunca se guarda la URL firmada.
   */
  save(
    file: Buffer | Uint8Array,
    opts: { prefix: string, contentType: string }
  ): Promise<{ ref: string }>
  url(ref: string): string | Promise<string>
  delete(ref: string): Promise<void>
}
