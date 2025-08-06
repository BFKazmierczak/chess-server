import { createClient } from "redis"

export type RedisClient = Awaited<ReturnType<typeof createClient>>
