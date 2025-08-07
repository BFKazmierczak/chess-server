import { Constructor, GameData, PlayerData } from "../types.js"
import { IConnectionManager } from "./IConnectionManager.js"
import IDataStore from "./persistence/IDataStore.js"

class GameInstance {
  private store: IDataStore
  private connectionManager: IConnectionManager<any>

  private id: string

  public constructor(
    id: string,
    connectionManagerConstructor: Constructor<IConnectionManager<any>>,
    dataStore: IDataStore,
    playerData?: PlayerData,
  ) {
    this.connectionManager = new connectionManagerConstructor()
    this.store = dataStore

    this.id = id
    this.gameKey = `game:${this.id}`

    if (playerData) {
      this.initializeData(playerData)
    }
  }

  public async initializeData(playerData: PlayerData) {
    const data: GameData = {
      id: this.id,
      createdAt: new Date().toISOString(),
      status: "awaiting",
      players: [],
    }

    const gameData = await this.store.createGameWithPlayer(
      this.id,
      data,
      playerData,
    )

    console.log("Created game data:", gameData)
  }

  public async getData(): Promise<GameData> {
    const gameData = await this.store.getGameData(this.id)

    if (!GameInstance.validate(gameData)) {
      throw new Error("Game validation error")
    }

    return gameData
  }

  public async join(playerData: PlayerData) {
    const gameData = await this.getData()

    if (gameData.players.some((player) => player.uuid === playerData.uuid)) {
      throw new Error("Player is already registered in this game")
    }

    try {
      await this.store.addPlayerToGame(playerData, gameData.id)
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Failed to add player: " + error.message)
      }

      throw new Error("Failed to add player: Unknown error")
    }
  }

  public async connect(playerId: string, ...args: any[]) {
    this.broadcastMessage(
      "server",
      JSON.stringify({
        playerName: "Server",
        message: "Someone is connecting...",
      }),
    )

    try {
      this.connectionManager.addConnection(playerId, ...args)
    } catch {
      throw new Error("Couldn't add a connection")
    }

    const playerData = await this.store.setPlayerActive(playerId, this.id, true)

    const connectionMessage = JSON.stringify({
      playerName: "Server",
      message: `Player ${playerData.nickname} has connected`,
    })

    this.broadcastMessage("server", connectionMessage)
  }

  public async disconnect(playerId: string) {
    const playerData = await this.store.setPlayerActive(
      playerId,
      this.id,
      false,
    )

    this.connectionManager.removeConnection(playerId)

    const msg = JSON.stringify({
      playerName: "Server",
      message: `Player ${playerData.nickname} has disconnected`,
    })

    this.broadcastMessage("server", msg)
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
        console.log("Server is sending a message to", _)

        this.connectionManager.broadcastMessage(connection, content)
      }

      return
    }

    if (from === "player") {
      const playerId = a
      const content = b as string

      console.log(`Player ${a} is sending a message`)

      const connectionEntries = this.connectionManager.getConnectionMapEntries()

      for (const [connectionId, connection] of connectionEntries) {
        if (playerId === connectionId) {
          continue
        }

        console.log("Sending the message to player", connectionId)

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

  public async getPlayerData(playerId: string) {
    const gameData = await this.getData()

    const playerData = gameData.players.find(
      (player) => player.uuid === playerId,
    )

    if (!playerData) {
      throw new Error("No such player")
    }

    return playerData
  }
}

export default GameInstance
