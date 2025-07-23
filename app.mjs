import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import { configDotenv } from "dotenv"
import express from "express"
import expressWs from "express-ws"
import { createClient } from "redis"
import { v4 as uuidv4 } from "uuid"
import validateGame from "./src/modules/game/utils/validateGame.mjs"
import { generatePlayerUuidCookie } from "./src/modules/auth/generatePlayerUuidCookie.mjs"

configDotenv()

const redis = await createClient({
  url: process.env.REDIS_URL,
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect()

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

const socketMap = new Map()

router.ws("/play", async function (ws, req) {
  const { gameId } = req.query
  const { ["player-name"]: playerName, ["player-uuid"]: currentPlayerUuid } =
    req.cookies

  if (!currentPlayerUuid) {
    ws.close(1008, "Authentication token required")
    return
  }

  if (!gameId) {
    ws.close(1008, "Game ID is required")
    return
  }

  const gameKey = `game:${gameId}`
  const game = await redis.hGetAll(gameKey)

  console.log("Found game:", game)

  const gameError = validateGame(game)
  if (gameError) {
    ws.close(1008, gameError)
    return
  }

  if (
    game["player-0-uuid"] !== currentPlayerUuid &&
    game["player-1-uuid"] !== currentPlayerUuid
  ) {
    ws.close(1008, "Forbidden")
    return
  }

  /**
   * Mapping of playerUuid -> websocket instance
   */
  let gameMap = socketMap.get(gameId)
  if (!gameMap) {
    socketMap.set(gameId, new Map())
    gameMap = socketMap.get(gameId)
  }

  if (gameMap.has(currentPlayerUuid)) {
    console.log("player re-connected")
  } else {
    gameMap.set(currentPlayerUuid, ws)
    console.log("player is connecting for the first time")
  }

  let playerIndex =
    game["player-0-uuid"] === currentPlayerUuid
      ? 0
      : game["player-1-uuid"] === currentPlayerUuid
        ? 1
        : -1

  if (playerIndex === -1) {
    return res.status(500).send({ error: "Unknown game error" })
  }

  ws.playerIndex = playerIndex

  // notify other players that someone is connecting
  for (const [playerUuid, socket] of gameMap.entries()) {
    if (playerUuid === currentPlayerUuid) {
      continue
    }

    const msgContent = JSON.stringify({
      playerName: "Server",
      message: `Player ${game[`player-${ws.playerIndex}-nickname`]} is connecting`,
    })

    socket.send(msgContent)
  }

  await redis.hSet(gameKey, {
    [`player-${playerIndex}-active`]: "true",
  })

  // propagate game status changes

  ws.on("message", function (msg) {
    console.log(`Player ${ws.playerIndex} has sent a message:`, msg)

    console.log("Socket map size:", Array.from(gameMap.values()).length)

    for (const [playerUuid, socket] of gameMap.entries()) {
      if (playerUuid === currentPlayerUuid) {
        continue
      }

      console.log("Sending to:", pId)

      const msgContent = JSON.stringify({
        playerName: game[`player-${ws.playerIndex}-nickname`],
        message: msg,
      })

      socket.send(msgContent)
    }
  })

  ws.on("close", async () => {
    console.log(`Player ${ws.playerIndex} has disconnected`)

    await redis.hSet(gameKey, {
      status: "stopped",
      [`player-${ws.playerIndex}-active`]: "false",
    })

    // notify other players that status change
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

  const gameId = uuidv4()

  const gameKey = `game:${gameId}`

  await redis.hSet(gameKey, {
    id: gameId,
    createdAt: new Date().toISOString(),
    status: "awaiting",
    "player-0-uuid": playerUuid,
    "player-0-nickname": cookies["player-name"],
  })

  await redis.sAdd(`games:${playerUuid}`, [gameKey])

  res.json({ gameId })
})

router.post("/game/join", async function (req, res) {
  const cookies = req.cookies
  const { gameId } = req.body

  const playerName = cookies["player-name"]

  if (!gameId) return res.status(400).send({ error: "Game ID not provided" })

  if (!playerName) {
    return res.status(400).send({ error: "Player name not provided" })
  }

  let playerUuid = cookies["player-uuid"]

  if (!playerUuid) {
    console.info("generating new player token")

    playerUuid = generatePlayerUuidCookie(res)
  }

  const gameKey = `game:${gameId}`

  const game = await redis.hGetAll(gameKey)

  const gameError = validateGame(game)
  if (gameError) {
    return res.status(400).send({ error: "Something went wrong" })
  }

  if (game["player-0-uuid"] === playerUuid) {
    return res.status(400).send({ error: "You cannot join your own game" })
  }

  if (game["player-1-uuid"]) {
    return res.status(400).send({ error: "Player 2 seat already taken" })
  }

  await redis.hSet(gameKey, {
    "player-1-uuid": playerUuid,
    "player-1-nickname": playerName,
  })

  await redis.sAdd(`games:${playerUuid}`, [gameKey])

  res.json({ success: true })
})

router.get("/", (req, res) => {
  console.log("accessing root")
  res.send("Hello World!")
})

router.get("/games/:gameId", async (req, res) => {
  const { ["player-uuid"]: playerUuid } = req.cookies

  const { gameId } = req.params

  if (playerUuid == null) {
    return res.status(403).send({ error: "No permission" })
  }

  const game = await redis.hGetAll(`game:${gameId}`)
  console.log("Game:", game)
  console.log("player uuid:", playerUuid)

  if (
    game["player-0-uuid"] !== playerUuid &&
    game["player-1-uuid"] !== playerUuid
  ) {
    return res.status(403).send({ error: "No permission" })
  }

  res.json({ success: true, game })
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

  const games = await multi.execAsPipeline()

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
  console.log(`Chess server listening on port ${port}`)
})
