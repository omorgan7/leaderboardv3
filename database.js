'use strict'

const sql = require("sqlite3")

// file name todo.
// use placeholder name for now.
const dbName = "match_database.sqllite3"

function dbErrCallback(err, _) {
    if (err) {
        console.log(err)
    }
}

exports.createDatabase = function(callback) {
    const db = startDatabase(callback)
    db.run("CREATE TABLE match_table(id bigint, duration float, winner char, timestamp bigint)", callback)
    db.run("CREATE TABLE player_table(id bigint, name char)", callback)

    // This table, after match_id, is sorted by key.
    db.run("CREATE TABLE match_player_table(match_id bigint, assists int, damage int, deaths int, denies int, game_team int, gpm float, healing int, hero_name char, items char, kills int, last_hits int, level int, player_name char, steam_id bigint, xpm float)", callback)

    return db
}

exports.startDatabase = function(callback) {
    return new sql.Database(dbName, callback)
}

exports.isValidMatch = function(db, matchID, callback) {
    db.get("SELECT 1 FROM match_table WHERE id = ?", matchID, (err, row) => {
        callback(err, row != undefined)
    })
}

exports.fetchMatch = function(db, matchID, callback) {
    db.get("SELECT * FROM match_table WHERE id = ?", matchID, (err, row) => {
        if (err) {
            // this should never be reached...
            callback(err, null)
            return
        }

        const match = row

        db.all("SELECT * FROM match_player_table WHERE match_id = ?", matchID, (err, rows) => {
            if (err) {
                // this _definitely_ should never be reached...
                callback(err, null)
                return
            }

            match.player = rows

            callback(null, match)
        })
    })
}

exports.addMatch = function(db, matchData) {
    db.run("INSERT INTO match_table(id, duration, winner, timestamp) VALUES(?, ?, ?, ?)", [
        matchData.match_id,
        matchData.game_time,
        matchData.game_winner,
        matchData.game_timestamp
    ], dbErrCallback)

    const players = matchData.players.map((player) => 
        [player.steam_id, player.player_name]
    )

    let valueString = "(?, ?),".repeat(players.length).slice(0, -1)

    // this might create duplicate players because a player might change their name.
    // maybe check if the ID exists already?
    db.run("INSERT INTO player_table(id, name) VALUES" + valueString, players.flat(), dbErrCallback)

    const matchPlayers = matchData.players.map((player) => {
        player.items = player.items.reduce((bigStr, thisStr) => bigStr.concat(",", thisStr))
        const values = Object.keys(player).sort().map((key) => player[key])
        return [matchData.match_id, ...values]
    })

    let smallValue = "(" + "?, ".repeat(matchPlayers[0].length).slice(0, -2) + "),"
    valueString = smallValue.repeat(matchPlayers.length).slice(0, -1)

    db.run("INSERT INTO match_player_table(match_id, assists, damage, deaths, denies, game_team, gpm, healing, hero_name, items, kills, last_hits, level, player_name, steam_id, xpm) VALUES" + valueString, matchPlayers.flat(), dbErrCallback)
}
