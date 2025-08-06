export interface IConnectionManager<T> {
  getConnectionMapEntries(): [key: string, value: T][]
  addConnection(connectionId: string, ...args: any[]): boolean
  removeConnection(connectionId: string): boolean
  broadcastMessage(connection: T, message: string): void
}
