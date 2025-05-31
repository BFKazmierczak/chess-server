import { v4 as uuidv4 } from "uuid"

export function generatePlayerUuidCookie(res) {
  const playerUuid = uuidv4()

  const currentDate = new Date()

  res.cookie("player-uuid", playerUuid, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    expires: new Date(currentDate.setDate(currentDate.getDate() + 1)),
  })

  return playerUuid
}
