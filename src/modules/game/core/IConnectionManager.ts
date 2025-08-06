export interface IConnectionManager<T> {
  getConnectionMapEntries(): MapIterator<[string, T]>
  addConnection(connectionId: string, ...args: any[]): boolean
  removeConnection(connectionId: string): boolean
  broadcastMessage(connection: T, message: string): void
}
