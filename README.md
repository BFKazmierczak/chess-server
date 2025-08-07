# Turn-Based Game Server

A scalable, extensible real-time server for turn-based multiplayer games.
Built with Node, TypeScript, Express, WebSockets and Redis (supports pluggable data stores via `IDataStore`).
Designed with modularity in mind to allow multiple game types via dependency injection and an abstract persistence layer.


## Project Status
This project is currently in active development, focusing on building a solid, extensible MVP architecture. 
Core features such as WebSocket management, Redis persistence, and REST API endpoints are implemented and functional. 
Ongoing work includes enhancing authentication, adding support for more game types, improving persistence abstraction, 
and refining transactional operations. 


## Goals
The main goal of this project is to implement a scalable and modular backend server for various turn-based multiplayer
games with decoupled architecture in mind that allows to implement game logic independent of the server internals.
Games are implemented via an `IGameLogic` interface consumed by the `GameManager` class.

## Features
- [*] Message broadcasting to players
- [*] Abstract data persistence layer
- [ ] Pluggable data storages
    - [*] Redis
    - [ ] SQL
- [*] Modular connection management with injectable connection manager implementations
- [ ] Basic player session management via cookies and UUIDs
- [ ] Game logic decoupled from server implementation (`IGameLogic` interface)
- [ ] Support for plugging bot implementations for non-human players
