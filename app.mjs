import express from 'express'
import expressWs from 'express-ws'
import bodyParser from 'body-parser'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from 'redis'
import { configDotenv } from 'dotenv'
import { validateGame } from './src/utils/index.mjs'

configDotenv()

const redis = await createClient({
  url: process.env.REDIS_URL
})
  .on('error', (err) => console.log('Redis Client Error', err))
  .connect()

const app = express()
const port = 3000

expressWs(app)

const router = express.Router()

app.use(bodyParser.json())
app.use(router)

const socketMap = new Map()

router.ws('/play', async function (ws, req) {
  console.log('connected')

  const { token, gameId } = req.query

  if (!token) {
    ws.close(1008, 'Authentication token required')
    return
  }

  if (!gameId) {
    ws.close(1008, 'Game ID is required')
    return
  }

  if (socketMap.has(token)) {
    console.log('the player re-connected')
  }



  const gameKey = `game:${gameId}`
  const game = await redis.hGetAll(gameKey)
  console.log({ game })

  const gameError = validateGame(game)
  if (gameError) {
    ws.close(1008, gameError)
    return
  }

  console.log({game})

  if (game['player-1'] !== token && game['player-2'] !== token) {
    ws.close(1008, 'Forbidden')
    return
  }

  let playerId = 0

  if (game['player-1'] === token) {
    console.log("Connecting player 1")
    playerId = 1
  }

  if (game['player-2'] === token) {
    playerId = 2
    console.log("Connecting player 2")
  }

  if (playerId === 0) return res.status(500).send({ error: "Unknown error" })

  await redis.hSet(gameKey, {
    [`player-${playerId}-active`]: "true"
  })

  ws.playerId = playerId
  socketMap.set(token, ws)

  ws.on('message', function (msg) {
    console.log('received: ', msg)
  })

  ws.on('close', async () => {
    console.log(`Player ${ws.playerId} disconnected`)

    await redis.hSet(gameKey, {
      [`player-${ws.playerId}-active`]: "false"
    })
  })
})

router.post('/game', async function (req, res) {
  const { playerId } = req.body

  if (!playerId)
    return res.status(400).send({ error: 'Player ID not provided' })

  const token = uuidv4()
  const gameId = uuidv4()

  const gameKey = `game:${gameId}`

  await redis.hSet(gameKey, { 
    'player-1': token, 
    'player-1-nickname': playerId
  })

  console.log('creating a game')

  res.json({ token, gameId })
})

router.post('/join', async function(req, res) {
  const { playerId, gameId } = req.body

  if (!gameId)
    return res.status(400).send({ error: 'Game ID not provided' })

  if (!playerId)
    return res.status(400).send({ error: 'Player ID not provided' })

  const gameKey = `game:${gameId}`

  const game = await redis.hGetAll(gameKey)

  const gameError = validateGame(game)
  if (gameError) {
    return res.status(400).send({ error: "Something went wrong" })
  }

  const playerToken = uuidv4()

  if (game['player-2']) {
    return res.status(400).send({ error: "Player 2 seat already taken" })
  }

  await redis.hSet(gameKey, { 
    'player-2': playerToken, 
    'player-2-nickname': playerId
  })

  res.json({ token: playerToken, gameId })
})

router.get('/', (req, res) => {
  console.log('accessing root')
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Chess server listening on port ${port}`)
})
