import { v4 as uuidv4 } from "uuid"
import { RedisClient } from "../../../types"
import { PlayerData } from "../types"
import validateGame from "../utils/validateGame.mjs"
import GameInstance from "./GameInstance"

class GameManager {
  private redis: RedisClient
  private gameInstances: Map<string, GameInstance>

  constructor(redisClient: RedisClient) {
    this.redis = redisClient
    this.gameInstances = new Map()
  }

  public async createGame(playerData: PlayerData): Promise<string> {
    const gameId = uuidv4()

    const gameKey = `game:${gameId}`

    await this.redis.hSet(gameKey, {
      id: gameId,
      createdAt: new Date().toISOString(),
      status: "awaiting",
      "player-0-uuid": playerData.uuid,
      "player-0-nickname": playerData.nickname,
    })

    await this.redis.sAdd(`games:${playerData.uuid}`, [gameKey])

    return gameId
  }

  public async joinGame(gameId: string, playerData: PlayerData) {
    const gameKey = `game:${gameId}`

    const game = await this.redis.hGetAll(gameKey)

    const gameError = validateGame(game)
    if (gameError) {
      throw new Error("Unable to validating the game")
    }

    if (game["player-0-uuid"] === playerData.uuid) {
      throw new Error("You cannot join your own game")
    }

    if (game["player-1-uuid"]) {
      throw new Error("Player 2 seat already taken")
    }

    await this.redis.hSet(gameKey, {
      "player-1-uuid": playerData.uuid,
      "player-1-nickname": playerData.nickname,
    })

    await this.redis.sAdd(`games:${playerData.uuid}`, [gameKey])
  }

  public async getGame(gameId: string) {
    const gameKey = `game:${gameId}`
    const game = await this.redis.hGetAll(gameKey)

    const gameError = validateGame(game)
    if (gameError) {
      throw new Error("Game validation error: " + gameError)
    }

    return game
  }
}

export default GameManager
