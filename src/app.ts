import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import { configDotenv } from "dotenv"
import express from "express"
import expressWs from "express-ws"
import { createClient } from "redis"
import { generatePlayerUuidCookie } from "./modules/auth/generatePlayerUuidCookie.js"
import GameManager from "./modules/game/core/GameManager.js"
import { GameData, PlayerData } from "./modules/game/types.js"
import SocketManager from "./modules/game/core/SocketManager.js"

configDotenv()

const app = express()
const port = 3000

expressWs(app)

const router = express.Router()

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
)
app.use(cookieParser())
app.use(bodyParser.json())
app.use(router)

const redis = await createClient({
  url: process.env.REDIS_URL,
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect()

const gameManager = new GameManager(redis, SocketManager)

router.ws("/play", async function (ws, req) {
  const { gameId, token: currentPlayerUuid } = req.query

  if (!currentPlayerUuid) {
    ws.close(1008, "Authentication token required")
    return
  }

  if (typeof gameId !== "string") {
    ws.close(1008, "Game ID is required")
    return
  }

  const gameInstance = await gameManager.getGame(gameId)

  if (!gameInstance) {
    ws.close(1008, "Game not found")
    return
  }

  let gameData: GameData
  try {
    gameData = await gameInstance.getData()
  } catch (error) {
    let errorMessage
    if (error instanceof Error) {
      errorMessage = error.message
    } else {
      errorMessage = "Unknown error"
    }

    ws.close(1008, errorMessage)
    return
  }

  if (
    gameData["player-0-uuid"] !== currentPlayerUuid &&
    gameData["player-1-uuid"] !== currentPlayerUuid
  ) {
    ws.close(1008, "Forbidden")
    return
  }

  try {
    await gameInstance.connect(currentPlayerUuid, ws)
  } catch {
    ws.close(1013, "Connection error")
    return
  }

  // propagate game status changes
  ws.on("message", function (msg) {
    const msgContent = JSON.stringify({
      message: msg,
    })

    gameInstance.broadcastMessage("player", currentPlayerUuid, msgContent)
  })

  ws.on("close", async () => {
    console.log(`Player ${currentPlayerUuid} has disconnected`)

    await gameInstance.disconnect(currentPlayerUuid)

    // notify other players that status changed
  })
})

router.post("/game/create", async function (req, res) {
  const cookies = req.cookies

  if (!cookies["player-name"]) {
    return res.status(400).send({ error: "Player name not provided" })
  }

  let playerUuid = cookies["player-uuid"]

  if (!playerUuid) {
    console.info("generating new player token")

    playerUuid = generatePlayerUuidCookie(res)
  }

  const playerData: PlayerData = {
    uuid: playerUuid,
    nickname: cookies["player-name"],
  }

  const gameId = await gameManager.createGame(playerData)

  res.json({ gameId })
})

router.post("/game/join", async function (req, res) {
  const cookies = req.cookies
  const { gameId } = req.body

  const playerName = cookies["player-name"]

  if (!gameId) {
    return res.status(400).send({ error: "Game ID not provided" })
  }

  if (!playerName) {
    return res.status(400).send({ error: "Player name not provided" })
  }

  let playerUuid = cookies["player-uuid"]

  if (!playerUuid) {
    console.info("Generating new player token...")
    playerUuid = generatePlayerUuidCookie(res)
  }

  const playerData: PlayerData = {
    uuid: playerUuid,
    nickname: playerName,
  }

  try {
    await gameManager.joinGame(gameId, playerData)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).send({ error: error.message })
    }

    return res.status(400).send({ error: "Unknown error" })
  }

  res.json({ success: true })
})

router.get("/", (req, res) => {
  res.send("Hello World!")
})

router.get("/games/:gameId", async (req, res) => {
  const { ["player-uuid"]: playerUuid } = req.cookies

  const { gameId } = req.params

  if (playerUuid == null) {
    return res.status(403).send({ error: "No permission" })
  }

  const gameInstance = await gameManager.getGame(gameId as string)
  if (!gameInstance) {
    return res.status(404).send({ error: "Game not found" })
  }

  let gameData: GameData
  try {
    gameData = await gameInstance.getData()
  } catch (error) {
    let errorMessage = "Unknown error"

    if (error instanceof Error) {
      errorMessage = error.message
    }

    return res.status(500).send({ error: errorMessage })
  }

  if (
    gameData["player-0-uuid"] !== playerUuid &&
    gameData["player-1-uuid"] !== playerUuid
  ) {
    return res.status(403).send({ error: "Forbidden" })
  }

  res.json({ success: true, game: gameData })
})

router.get("/player/me/games", async function (req, res) {
  const { ["player-uuid"]: playerUuid } = req.cookies

  if (playerUuid == null) {
    return res.status(403).send({ error: "No permission" })
  }

  const playerGameIds = await redis.sMembers(`games:${playerUuid}`)

  const multi = redis.multi()

  for (const gameId of playerGameIds) {
    multi.hGetAll(gameId)
  }

  const games = (await multi.execAsPipeline()) as unknown as GameData[]

  const transformedGames = []
  for (const game of games) {
    transformedGames.push({
      id: game.id,
      createdAt: game.createdAt,
      status: game.status,
      "player-0-nickname": game["player-0-nickname"],
      "player-1-nickname": game["player-1-nickname"],
    })
  }

  res.json({ success: true, games: transformedGames })
})

app.listen(port, () => {
  console.info(`Chess server is listening on port ${port}`)
})
