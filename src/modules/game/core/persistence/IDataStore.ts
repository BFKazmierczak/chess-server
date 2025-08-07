import { GameData, PlayerData } from "../../types.js"

interface IDataStore {
  getGameData(gameId: string): Promise<GameData>
  setGameData(gameId: string, gameData: GameData): Promise<void>
  addPlayerToGame(playerData: PlayerData, gameId: string): Promise<void>
  createGameWithPlayer(
    gameId: string,
    gameData: GameData,
    playerData: PlayerData,
  ): Promise<GameData>
  setPlayerActive(
    playerId: string,
    gameId: string,
    active: boolean,
  ): Promise<PlayerData>
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
