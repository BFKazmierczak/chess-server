import { WebSocket } from "ws"
import { IConnectionManager } from "./IConnectionManager.js"

class SocketManager implements IConnectionManager<WebSocket> {
  private connectionMap: Map<string, WebSocket>

  constructor() {
    this.connectionMap = new Map()
  }

  public getConnectionMapEntries() {
    return Object.entries(this.connectionMap)
  }

  public addConnection(playerId: string, socket: WebSocket): boolean {
    if (this.connectionMap.has(playerId)) {
      throw new Error("Connection already exists")
    }

    this.connectionMap.set(playerId, socket)

    return true
  }

  public removeConnection(socketId: string): boolean {
    const socket = this.connectionMap.get(socketId)

    if (!socket) {
      throw new Error("Socket not found")
    }

    socket.close()

    this.connectionMap.delete(socketId)

    return true
  }

  public broadcastMessage(socket: WebSocket, message: string): void {
    const msg = JSON.stringify({
      content: message,
    })

    socket.send(msg)
  }

  public printSocketMap() {
    for (const [socketId, socket] of this.connectionMap.entries()) {
      console.log("Socket:", socketId, "Data:", socket)
    }
  }
}

export default SocketManager
