export type GameStatus = "awaiting" | "stopped" | "live"

export type MessageSender = "server" | "player"

export type GameData = {
  id: string
  createdAt: string
  status: GameStatus
  players: PlayerData[]
}

export type PlayerData = {
  uuid: string
  nickname: string
  active: boolean
}

export type Constructor<T> = new (...args: any[]) => T
