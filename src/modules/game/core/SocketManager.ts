import { WebSocket } from "ws"
import { IConnectionManager } from "./IConnectionManager.js"

class SocketManager implements IConnectionManager<WebSocket> {
  private connectionMap: Map<string, WebSocket>

  public constructor() {
    this.connectionMap = new Map()
  }

  public getConnectionMapEntries() {
    return this.connectionMap.entries()
  }

  public addConnection(playerId: string, socket: WebSocket): boolean {
    if (this.connectionMap.has(playerId)) {
      throw new Error("Connection already exists")
    }

    this.connectionMap.set(playerId, socket)

    console.log("A connection has been added")
    console.log("Current connections:", this.getConnectionMapEntries())

    return true
  }

  public removeConnection(socketId: string): boolean {
    const socket = this.connectionMap.get(socketId)

    if (!socket) {
      throw new Error("Socket not found")
    }

    socket.close()

    this.connectionMap.delete(socketId)

    console.log("A connection has been deleted")
    console.log("Current connections:", this.getConnectionMapEntries())

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
