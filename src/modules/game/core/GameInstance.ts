import { PlayerData } from "../types.js"
import { GameData } from "../types.js"
import { Constructor } from "../types.js"
import { IConnectionManager } from "./IConnectionManager.js"
import { RedisClient } from "../../../types.js"

class GameInstance {
  private redis: RedisClient
  private connectionManager: IConnectionManager<any>

  private id: string
  private gameKey: string

  public constructor(
    id: string,
    connectionManagerConstructor: Constructor<IConnectionManager<any>>,
    redis: RedisClient,
    playerData?: PlayerData,
  ) {
    this.connectionManager = new connectionManagerConstructor()
    this.redis = redis

    this.id = id
    this.gameKey = `game:${this.id}`

    if (playerData) {
      this.initializeData(playerData)
    }
  }

  public async initializeData(playerData: PlayerData) {
    const gameKey = `game:${this.id}`

    await this.redis.hSet(gameKey, {
      id: this.id,
      createdAt: new Date().toISOString(),
      status: "awaiting",
      "player-0-uuid": playerData.uuid,
      "player-0-nickname": playerData.nickname,
    })

    await this.redis.sAdd(`games:${playerData.uuid}`, [gameKey])
  }

  public async getData(): Promise<GameData> {
    const game = await this.redis.hGetAll(this.gameKey)

    if (!GameInstance.validate(game)) {
      throw new Error("Game validation error")
    }

    return game
  }

  public async join(playerData: PlayerData) {
    const gameData = await this.getData()

    if (gameData["player-0-uuid"] === playerData.uuid) {
      throw new Error("You cannot join your own game")
    }

    if (gameData["player-1-uuid"]) {
      throw new Error("Player 2 seat already taken")
    }

    await this.redis.hSet(this.gameKey, {
      "player-1-uuid": playerData.uuid,
      "player-1-nickname": playerData.nickname,
    })

    await this.redis.sAdd(`games:${playerData.uuid}`, [this.gameKey])
  }

  public async connect(playerId: string, ...args: any[]) {
    this.broadcastMessage("server", "Someone is connecting...")

    try {
      this.connectionManager.addConnection(playerId, ...args)
    } catch {
      throw new Error("Couldn't add a connection")
    }

    const gameData = await this.getData()

    const playerIndex = this.getPlayerIndex(playerId, gameData)

    await this.redis.hSet(this.gameKey, {
      [`player-${playerIndex}-active`]: "true",
    })
  }

  public async disconnect(playerId: string) {
    const gameData = await this.getData()

    const playerIndex = this.getPlayerIndex(playerId, gameData)

    await this.redis.hSet(this.gameKey, {
      status: "stopped",
      [`player-${playerIndex}-active`]: "false",
    })

    this.connectionManager.removeConnection(playerId)
  }

  public broadcastMessage(from: "server", content: string): void
  public broadcastMessage(
    from: "player",
    playerId: string,
    content: string,
  ): void
  public broadcastMessage(from: "server" | "player", a: string, b?: string) {
    if (from === "server") {
      const content = a

      const connectionEntries = this.connectionManager.getConnectionMapEntries()

      for (const [_, connection] of connectionEntries) {
        this.connectionManager.broadcastMessage(connection, content)
      }

      return
    }

    if (from === "player") {
      const playerId = a
      const content = b as string

      const connectionEntries = this.connectionManager.getConnectionMapEntries()

      for (const [connectionId, connection] of connectionEntries) {
        if (playerId === connectionId) {
          return
        }

        this.connectionManager.broadcastMessage(connection, content)
      }

      return
    }
  }

  public static validate(game: any): game is GameData {
    if (typeof game !== "object") {
      return false
    }

    if (!Object.keys(game).length) {
      return false
    }

    return true
  }

  private getPlayerIndex(playerId: string, gameData: GameData): number {
    const playerIndex =
      gameData["player-0-uuid"] === playerId
        ? 0
        : gameData["player-1-uuid"] === playerId
          ? 1
          : -1

    return playerIndex
  }
}

export default GameInstance
