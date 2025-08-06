import { createClient, RedisClientType } from "redis"
import { RedisClient } from "../../../../types.js"
import { GameData } from "../../types.js"
import IDataStore, { IDataStoreTransaction } from "./IDataStore.js"

class RedisDataStore implements IDataStore {
  private client: RedisClientType

  private constructor(client: RedisClientType) {
    this.client = client
  }

  public static async create(url: string): Promise<RedisDataStore> {
    const redis = await createClient({
      url: process.env.REDIS_URL,
    })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect()

    return new RedisDataStore(redis)
  }

  public async getGameData(gameId: string): Promise<GameData> {
    const gameKey = `game:${gameId}`

    const gameData = await this.client.hGetAll(gameKey)

    return gameData
  }

  public async setGameData(gameId: string, gameData: GameData) {
    const gameKey = `game:${gameId}`

    await this.client.hSet(gameKey, gameData)

    await this.client.sAdd(`games:${playerData.uuid}`, [gameKey])
  }

  public async runTransaction<T>(
    actions: (store: IDataStoreTransaction) => Promise<T>,
  ): Promise<T> {
    const multi = this.client.multi()

    const txStore: IDataStoreTransaction = {
      getGameData: (gameId) => {
        const data = this.getGameData(gameId)

        return data
      },
      setGameData: (gameId, gameData) => {
        const gameKey = `game:${gameId}`
        multi.hSet(gameKey, gameData)
      },
    }

    const result = await actions(txStore)

    const replies = await multi.exec()

    console.log("Transaction replies:", replies)

    return result
  }
}

export default RedisDataStore
