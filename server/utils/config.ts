// Con nitro.experimental.envExpansion, una variable ausente deja el texto `{{VAR}}`
// tal cual: se trata como vacía para que el error sea claro.
function envValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  return /^\{\{.*\}\}$/.test(value.trim()) ? '' : value.trim()
}

export function getServerConfig() {
  const config = useRuntimeConfig()
  return {
    databaseUrl: envValue(config.databaseUrl),
    betterAuthSecret: envValue(config.betterAuthSecret),
    betterAuthUrl: envValue(config.betterAuthUrl),
    s3: {
      endpoint: envValue(config.s3.endpoint),
      region: envValue(config.s3.region),
      accessKeyId: envValue(config.s3.accessKeyId),
      secretAccessKey: envValue(config.s3.secretAccessKey),
      bucket: envValue(config.s3.bucket)
    }
  }
}
