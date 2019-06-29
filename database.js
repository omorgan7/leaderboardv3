'use strict'

const sql = require("sqlite3")

// file name todo.
// use placeholder name for now.
const dbName = ""

function dbErrCallback(err, _) {
    if (err) {
        throw err
    }
}

exports.createDatabase = function(callback) {
    const db = new sql.Database(dbName, callback)
    db.run("CREATE TABLE match_table(id bigint, duration float, winner char)", callback)
    db.run("CREATE TABLE player_table(id bigint, name char)", callback)
    db.run("CREATE TABLE match_player_table(match_id bigint, player_id bigint, hero char)", callback)

    return db
}

exports.startDatabase = function(callback) {
    return new sql.Database(dbName, callback)
}

exports.addMatch = function(db, matchData) {
    db.run("INSERT INTO match_table(id, duration, winner) VALUES(?, ?, ?)", [
        matchData.match_id,
        matchData.game_time,
        matchData.game_winner
    ], dbErrCallback)

    const players = matchData.players.map((player) => 
        [player.steam_id, player.player_name]
    )

    let valueString = "(?, ?),".repeat(players.length).slice(0, -1)

    // this might create duplicate players because a player might change their name.
    // maybe check if the ID exists already?
    db.run("INSERT INTO player_table(id, name) VALUES" + valueString, players.flat(), dbErrCallback)

    const matchPlayers = matchData.players.map((player) =>
        [matchData.match_id, player.steam_id, player.hero_name]
    )

    valueString = "(?, ?, ?),".repeat(matchPlayers.length).slice(0, -1)

    db.run("INSERT INTO match_player_table(match_id, player_id, hero) VALUES" + valueString, matchPlayers.flat(), dbErrCallback)
}
