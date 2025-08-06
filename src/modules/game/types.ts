export type GameStatus = "awaiting" | "stopped" | "live"

export type GameType = {
  id: string
  createdAt: string
  status: GameStatus
  "player-0-uuid": string
  "player-0-nickname": string
  "player-0-active"?: boolean
  "player-1-uuid"?: string
  "player-1-nickname"?: string
  "player-1-active"?: boolean
}

export type PlayerData = {
  uuid: string
  nickname: string
  active?: boolean
}
