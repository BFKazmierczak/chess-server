import { v4 as uuidv4 } from "uuid"
import { RedisClient } from "../../../types.js"
import { Constructor, PlayerData } from "../types.js"
import GameInstance from "./GameInstance.js"
import { IConnectionManager } from "./IConnectionManager.js"

class GameManager {
  private redis: RedisClient
  private gameInstances: Map<string, GameInstance>

  private connectionManagerConstructor: Constructor<IConnectionManager<any>>

  public constructor(
    redisClient: RedisClient,
    connectionManagerConstructor: Constructor<IConnectionManager<any>>,
  ) {
    this.redis = redisClient
    this.connectionManagerConstructor = connectionManagerConstructor

    this.gameInstances = new Map()
  }

  public async createGame(playerData: PlayerData): Promise<string> {
    const gameId = uuidv4()

    const game = new GameInstance(
      gameId,
      this.connectionManagerConstructor,
      this.redis,
      playerData,
    )

    console.log("Created game:", game)

    this.gameInstances.set(gameId, game)

    return gameId
  }

  public async joinGame(gameId: string, playerData: PlayerData) {
    const game = await this.getGame(gameId)

    if (!game) {
      throw new Error("Game not found")
    }

    await game.join(playerData)
  }

  public async getGame(gameId: string): Promise<GameInstance | undefined> {
    const inMemoryInstance = this.gameInstances.get(gameId)

    if (inMemoryInstance) {
      return inMemoryInstance
    }

    console.log("Searching for game with id", gameId)

    const existingGameData = await this.redis.hGetAll(`game:${gameId}`)

    if (!GameInstance.validate(existingGameData)) {
      return undefined
    }

    const newInstance = new GameInstance(
      gameId,
      this.connectionManagerConstructor,
      this.redis,
    )

    this.gameInstances.set(gameId, newInstance)

    return newInstance
  }
}

export default GameManager
