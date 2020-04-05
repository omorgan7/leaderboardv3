'use strict'

const promisify = require('util').promisify
const sql = require("sqlite3")
const utilities = require("./utilities")

sql.createDatabaseAsync = promisify(sql.Database)

// file name todo.
// use placeholder name for now.
const dbName = "match_database.sqllite3"

exports.createDatabase = async function() {
    const db = exports.startDatabase()

    await db.runAsync("CREATE TABLE match_table(id bigint, duration float, winner int, timestamp bigint)")
    await db.runAsync("CREATE TABLE player_table(id char, id32 bigint, name char)")

    // This table, after match_id, is sorted by key.
    await db.runAsync("CREATE TABLE match_player_table(match_id bigint, assists int, buffs char, damage int, deaths int, denies int, game_team int, gpm float, healing int, hero_name char, id32 bigint, items char, kills int, last_hits int, level int, player_name char, steam_id char, xpm float)")

    return db
}

exports.startDatabase = function() {
    const db = new sql.Database(dbName, null)

    db.runAsync = promisify(db.run)
    db.getAsync = promisify(db.get)
    db.allAsync = promisify(db.all)

    return db
}

exports.isValidMatch = async function(db, matchID) {
    return await db.getAsync("SELECT 1 FROM match_table WHERE id = ?", matchID) != undefined
}

exports.isValidPlayer = async function(db, id32) {
    return await db.getAsync("SELECT 1 from player_table WHERE id32 = ?", id32) != undefined
}

exports.validPlayers = async function(db, ids) {
    const queryString = "(" + "?,".repeat(ids.length).slice(0, -1) + ")"
    return await db.allAsync("SELECT * FROM player_table where id32 IN " + queryString, ids.flat())
}

exports.fetchMatch = async function(db, matchID) {
    const match = await db.getAsync("SELECT * FROM match_table WHERE id = ?", matchID)
    match.player = await db.allAsync("SELECT * FROM match_player_table WHERE match_id = ?", matchID)

    return match
}

exports.fetchMatchesForPlayer = async function(db, id32, matchCount) {
    const matches = await db.allAsync("SELECT * FROM match_player_table INNER JOIN match_table on match_table.id = match_player_table.match_id WHERE id32 = ? ORDER BY match_id DESC LIMIT ?", id32, matchCount)

    return matches
}

exports.playerOnStreak = async function(db, id32, streakCount) {
    // const query = await db.allAsync(`
    //     select match_player_table.[name], count(subquery1.temp)
    //     from(
    //         select match_player_table.[name](
    //             row_number() over(
    //                 order by match_player_table.[id]
    //             )
    //             - row_number() over(
    //                 partition by match.[win_lose_status]  order by match_player_table.[id]
    //             ) as temp
    //             from match
    //                 left join match_player_table
    //                 on match.[id] = match_player_table.[match_id] ) ) subquery1
        
    //     group by temp, match_player_table.[name]
    // `)

    const query = await db.getAsync(`
    SELECT win_loss, count(temp.win_loss) AS streak_length FROM
    (SELECT winner, game_team,
        CASE
            WHEN game_team = winner then true
            ELSE false
        END as win_loss
        FROM match_player_table
            INNER JOIN match_table
            ON match_table.id = match_player_table.match_id
            WHERE id32 = ?
            ORDER BY match_id DESC)
        AS temp
    GROUP BY temp.win_loss LIMIT 1
    `, id32)

    return query
}

exports.playerCalibrating = async function(db, id32, calibrationCount) {
    // const matchCount = (await db.getAsync("SELECT COUNT(*) FROM match_player_table where id32 = ?", id32))["COUNT(*)"]
    const query = await db.getAsync(`
    SELECT
    CASE
        WHEN COUNT(id32) < ? THEN true ELSE false
    END AS calibration
    FROM match_player_table WHERE id32 = ?`, calibrationCount, id32)
    return query.calibration 
}

exports.fetchPlayer = async function(db, id32) {
    const player = await db.getAsync("SELECT * from player_table WHERE id32 = ?", id32)
    
    player.matchCount = (await db.getAsync("SELECT COUNT(*) FROM match_player_table where id32 = ?", id32))["COUNT(*)"]
    player.winCount = (await db.getAsync(
        "SELECT COUNT(*) FROM match_player_table INNER JOIN match_table ON match_table.id = match_player_table.match_id AND match_player_table.game_team = match_table.winner WHERE match_player_table.id32 = ?", id32))["COUNT(*)"]
    player.lossCount = player.matchCount - player.winCount

    return player
}

exports.addMatch = async function(db, matchData) {

    // first - reject the match if it's already in the DB.
    if (await exports.isValidMatch(db, matchData.match_id)) {
        return
    }

    await db.runAsync("INSERT INTO match_table(id, duration, winner, timestamp) VALUES(?, ?, ?, ?)", [
        matchData.match_id,
        matchData.game_time,
        utilities.teamStringToInt(matchData.game_winner),
        matchData.game_timestamp
    ])

    for (const player of matchData.players) {
        player.id32 = utilities.maskBottom32Bits(BigInt(player.steam_id))
    }

    const players = matchData.players.map((player) => ({
            steam_id: player.steam_id,
            id32: player.id32,
            player_name: player.player_name
        })
    )

    
    const existingPlayers = await exports.validPlayers(db, players.map(player => player.id32))

    // don't add duplicate players
    // unfortunately this prevents a player from updating his/her name.
    // We fetch that information from steam anyway (when available)
    let newPlayers = players.filter((player) => {
        for (const p of existingPlayers) {
            if (p.id32 == player.id32) {
                return false
            }
        }
        return true
    })

    if (newPlayers.length > 0) {
        let valueString = "(?, ?, ?),".repeat(newPlayers.length).slice(0, -1)
        await db.runAsync("INSERT INTO player_table(id, id32, name) VALUES" + valueString, newPlayers.map((player) => Object.values(player)).flat())
    }

    // sort all match keys by alphabetical order within the table
    // and prepare for sql statement
    const strReduce = (bigStr, thisStr) => bigStr.concat(",", thisStr)

    const matchPlayers = matchData.players.map((player) => {
        player.items = player.items.reduce(strReduce)

        if (player.buffs == undefined) {
            player.buffs = ""
        }
        else {
            player.buffs = Object.entries(player.buffs)
                                 .flat()
                                 .reduce(strReduce)
        }
        
        const values = Object.keys(player).sort().map((key) => player[key])
        return [matchData.match_id, ...values]
    })

    // I don't believe this can lead to an SQL injection because a value string is
    // built off the length rather than inserted in directly.
    let smallValue = "(" + "?, ".repeat(matchPlayers[0].length).slice(0, -2) + "),"
    let valueString = smallValue.repeat(matchPlayers.length).slice(0, -1)

    await db.runAsync("INSERT INTO match_player_table(match_id, assists, buffs, damage, deaths, denies, game_team, gpm, healing, hero_name, id32, items, kills, last_hits, level, player_name, steam_id, xpm) VALUES" + valueString, matchPlayers.flat())
}
