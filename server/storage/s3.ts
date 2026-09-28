import crypto from 'node:crypto'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageDriver } from './types'

export interface S3StorageConfig {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export const EXTENSIONES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
}

// Duración de las URLs firmadas de lectura (segundos)
const URL_EXPIRES_IN = 60

// Storage S3-compatible de Neon (bucket `assets`)
export class S3StorageDriver implements StorageDriver {
  private client: S3Client
  private bucket: string

  constructor(config: S3StorageConfig) {
    const faltantes = Object.entries({
      AWS_ENDPOINT_URL_S3: config.endpoint,
      AWS_REGION: config.region,
      AWS_ACCESS_KEY_ID: config.accessKeyId,
      AWS_SECRET_ACCESS_KEY: config.secretAccessKey,
      S3_BUCKET: config.bucket
    }).filter(([, value]) => !value).map(([name]) => name)

    if (faltantes.length) {
      throw new Error(`[storage] Faltan variables de entorno: ${faltantes.join(', ')}`)
    }

    this.bucket = config.bucket
    this.client = new S3Client({
      forcePathStyle: true,
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    })
  }

  async save(file: Buffer | Uint8Array, opts: { prefix: string, contentType: string }) {
    const ext = EXTENSIONES[opts.contentType] ?? ''
    const prefix = opts.prefix.replace(/^\/+|\/+$/g, '')
    const key = `${prefix}/${crypto.randomUUID()}${ext}`

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: opts.contentType
    }))

    return { ref: key }
  }

  url(ref: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: ref }),
      { expiresIn: URL_EXPIRES_IN }
    )
  }

  async delete(ref: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: ref }))
  }
}
