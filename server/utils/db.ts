import { createDb, type Db } from '../db'

let _db: Db | null = null

export function useDb(): Db {
  if (!_db) {
    _db = createDb(getServerConfig().databaseUrl)
  }
  return _db
}
