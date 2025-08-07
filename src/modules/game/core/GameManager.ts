import { v4 as uuidv4 } from "uuid"
import { Constructor, PlayerData } from "../types.js"
import GameInstance from "./GameInstance.js"
import { IConnectionManager } from "./IConnectionManager.js"
import IDataStore from "./persistence/IDataStore.js"

class GameManager {
  private store: IDataStore
  private gameInstances: Map<string, GameInstance>

  private connectionManagerConstructor: Constructor<IConnectionManager<any>>

  public constructor(
    dataStore: IDataStore,
    connectionManagerConstructor: Constructor<IConnectionManager<any>>,
  ) {
    this.store = dataStore
    this.connectionManagerConstructor = connectionManagerConstructor

    this.gameInstances = new Map()
  }

  public async createGame(playerData: PlayerData): Promise<string> {
    const gameId = uuidv4()

    const game = new GameInstance(
      gameId,
      this.connectionManagerConstructor,
      this.store,
      playerData,
    )

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

    const existingGameData = await this.store.getGameData(gameId)

    if (!GameInstance.validate(existingGameData)) {
      return undefined
    }

    const newInstance = new GameInstance(
      gameId,
      this.connectionManagerConstructor,
      this.store,
    )

    this.gameInstances.set(gameId, newInstance)

    return newInstance
  }
}

export default GameManager
