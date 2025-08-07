import { createClient, RedisClientType } from "redis"
import { GameData, PlayerData } from "../../types.js"
import GameInstance from "../GameInstance.js"
import IDataStore, { IDataStoreTransaction } from "./IDataStore.js"

class RedisDataStore implements IDataStore {
  private client: RedisClientType

  private constructor(client: RedisClientType) {
    this.client = client
  }

  public static async create(url: string): Promise<RedisDataStore> {
    const redis = await createClient({ url })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect()

    return new RedisDataStore(redis)
  }

  public async getGameData(gameId: string): Promise<GameData> {
    const gameKey = this.getGameKey(gameId)

    const rawGameData = await this.client.get(gameKey)

    let parsedGameData
    try {
      parsedGameData = JSON.parse(rawGameData)
    } catch {
      throw new Error("Game data parsing error")
    }

    if (!GameInstance.validate(parsedGameData)) {
      throw new Error("Game data has invalid structure")
    }

    return parsedGameData
  }

  public async setGameData(gameId: string, gameData: GameData) {
    const gameKey = this.getGameKey(gameId)

    await this.client.hSet(gameKey, gameData)
  }

  public async addPlayerToGame(
    playerData: PlayerData,
    gameId: string,
  ): Promise<void> {
    const gameKey = `game:${gameId}`

    await this.client.watch(gameKey)

    const gameData = await this.getGameData(gameId)

    const modifiedGameData: GameData = {
      ...gameData,
      players: [...gameData.players, playerData],
    }

    const multi = this.client.multi()

    multi.set(gameKey, JSON.stringify(modifiedGameData))
    multi.sAdd(`games:${playerData.uuid}`, [gameKey])

    const replies = await multi.exec()

    console.log("addPlayerToGame() replies:", replies)
  }

  public async createGameWithPlayer(
    gameId: string,
    gameData: GameData,
    playerData: PlayerData,
  ): Promise<GameData> {
    const gameKey = this.getGameKey(gameId)

    const multi = this.client.multi()

    gameData.players = [playerData]

    multi.set(gameKey, JSON.stringify(gameData))
    multi.sAdd(`games:${playerData.uuid}`, [gameKey])

    const replies = await multi.exec()

    console.log("createGameWithPlayer() replies:", replies)

    return gameData
  }

  public async setPlayerActive(
    playerId: string,
    gameId: string,
    active: boolean,
  ): Promise<PlayerData> {
    const gameKey = `game:${gameId}`

    await this.client.watch(gameKey)

    const gameData = await this.getGameData(gameId)

    const playerIndex = gameData.players.findIndex(
      (player) => player.uuid === playerId,
    )

    if (playerIndex < 0) {
      throw new Error("Player not found in the game")
    }

    const newPlayerData: PlayerData = {
      ...gameData.players[playerIndex],
      active,
    }

    gameData.players[playerIndex] = newPlayerData

    const modifiedGameData: GameData = {
      ...gameData,
    }

    const result = await this.client.set(
      gameKey,
      JSON.stringify(modifiedGameData),
    )

    console.log("setPlayerActive result:", result)

    return newPlayerData
  }

  public async runTransaction<T>(
    actions: (store: IDataStoreTransaction) => Promise<T>,
  ): Promise<T> {
    const multi = this.client.multi()

    const txStore: IDataStoreTransaction = {
      getGameData: async (gameId) => {
        const data = this.getGameData(gameId)

        return data
      },
      setGameData: async (gameId, gameData) => {
        const gameKey = `game:${gameId}`
        multi.hSet(gameKey, gameData)
      },
    }

    const result = await actions(txStore)

    const replies = await multi.exec()

    console.log("Transaction replies:", replies)

    return result
  }

  private getGameKey(gameId: string) {
    return `game:${gameId}`
  }
}

export default RedisDataStore
