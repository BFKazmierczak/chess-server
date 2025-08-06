import { GameData, PlayerData } from "../../types.js"

interface IDataStore {
  createGameWithPlayer(
    gameId: string,
    gameData: GameData,
    playerData: PlayerData,
  ): Promise<GameData>
  getGameData(gameId: string): Promise<GameData>
  setGameData(gameId: string, gameData: GameData): Promise<void>
  runTransaction<T>(
    actions: (store: IDataStoreTransaction) => Promise<T>,
  ): Promise<T>
}

interface IDataStoreTransaction {
  getGameData(gameId: string): Promise<GameData>
  setGameData(gameId: string, gameData: GameData): Promise<void>
}

export { IDataStoreTransaction }
export default IDataStore
