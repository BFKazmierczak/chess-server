function validateGame(game) {
  if ((!game) instanceof Object) {
    return "Game must be an Object"
  }

  if (!Object.keys(game).length) return "Game does not exist"
}

export default validateGame
