'use strict'

const promisify = require('util').promisify
const sql = require("sqlite3")
const utilities = require("./utilities")
const mmr = require('./mmr')
const steam = require('./steam_api')

sql.createDatabaseAsync = promisify(sql.Database)

// file name todo.
// use placeholder name for now.
const dbName = "match_database.sqllite3"

const seasonTime = 1672531200; // new year 2023.

exports.createDatabase = async function() {
    const db = exports.startDatabase()

    await db.runAsync("CREATE TABLE match_table(id bigint, duration float, winner int, timestamp bigint, radkills int, direkills int)")
    await db.runAsync("CREATE TABLE player_table(id char, id32 bigint, name char, mmr int, calibration_games, badges char)")

    // This table, after match_id, is sorted by key.
    await db.runAsync("CREATE TABLE match_player_table(match_id bigint, assists int, buffs char, captain int, damage int, deaths int, denies int, game_team int, gpm float, healing int, hero_name char, id32 bigint, items char, kills int, last_hits int, level int, player_name char, steam_id char, xpm float)")

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

exports.fetchMatches = async function(db, start, end) {
    const matches = await db.allAsync(`SELECT id, duration, winner, timestamp FROM(
        SELECT
            ROW_NUMBER() OVER (
                ORDER BY match_table.id DESC
                ) RowNum, *
            FROM match_table
            ) t
            WHERE RowNum > ? AND RowNum <= ?
            ORDER BY t.id DESC
            `, start, end)
    
    for (let i = 0; i < matches.length; i++)  {
        const matchId = matches[i].id
        const heroes = await db.allAsync("SELECT hero_name, game_team FROM match_player_table WHERE match_id = ?", matchId)
        matches[i].rad_heroes = heroes.filter(hero => hero.game_team === utilities.RADIANT).map(hero => hero.hero_name)
        matches[i].dire_heroes = heroes.filter(hero => hero.game_team === utilities.DIRE).map(hero => hero.hero_name)
    }
    
    return matches
}

exports.recentMatch = async function(db) {
    const match = await db.getAsync("SELECT * FROM match_table ORDER BY id DESC LIMIT 1")
    match.player = await db.allAsync("SELECT * FROM match_player_table ORDER BY match_id DESC LIMIT 10")

    return match
}

exports.fetchMatch = async function(db, matchID) {
    const match = await db.getAsync("SELECT * FROM match_table WHERE id = ?", matchID)
    match.player = await db.allAsync("SELECT * FROM match_player_table WHERE match_id = ?", matchID)

    return match
}

exports.fetchMatchCountForPlayers = async function(db, players) {
    return await Promise.all(players.map(async (player) => ({
            id32: player.id32,
            matchCount: (await db.getAsync("SELECT COUNT(*) FROM match_player_table where id32 = ?", player.id32))["COUNT(*)"]
        })
    ))
}

exports.fetchPlayersFromMatch = async function(db, matchID) {
    const match = await db.allAsync("SELECT player_table.mmr, player_table.id32, match_player_table.game_team, player_table.calibration_games FROM match_player_table INNER JOIN player_table ON match_player_table.id32 = player_table.id32 where match_player_table.match_id = ? ORDER BY player_table.id32 DESC", matchID)

    return match
}

exports.fetchMatchesForPlayer = async function(db, id32, matchBegin, matchEnd) {
    return await db.allAsync(`SELECT * FROM (
            SELECT
                ROW_NUMBER() OVER (
                    ORDER BY match_table.id DESC
                ) RowNum, *
            FROM
                match_player_table INNER JOIN match_table on match_table.id = match_player_table.match_id WHERE id32 = ?
        ) t
            WHERE RowNum > ? AND RowNum <= ?
            ORDER BY t.id DESC
        `, id32, matchBegin, matchEnd)
}

exports.fetchAllMatchesForPlayer = async function(db, id32) {
    return await db.allAsync(`SELECT * FROM (
            SELECT
                *
            FROM
                match_player_table INNER JOIN match_table on match_table.id = match_player_table.match_id WHERE id32 = ?
        ) t
            ORDER BY t.id DESC
        `, id32)
}

exports.updatePlayersMmr = async function(db, players) {
    await Promise.all(players.map(async (player) => {
        console.log(`Updating mmr of player: ${player.id32} to ${player.mmr}`)
        await db.runAsync(`UPDATE player_table SET mmr = ? WHERE id32 = ?`, player.mmr, player.id32)
    }))
}

exports.updatePlayersCalibration = async function(db, players) {
    await Promise.all(players.map(async (player) => {
        console.log(`Updating calibration of player: ${player.id32} to ${player.calibration_games}`)
        await db.runAsync(`UPDATE player_table SET calibration_games = ? WHERE id32 = ?`, player.calibration_games, player.id32)
    }))
}
exports.updatePlayersBadges = async function(db, players) {
    await Promise.all(players.map(async (player) => {
        await db.runAsync(`UPDATE player_table SET badges = ? WHERE id32 = ?`, player.badges, player.id32)
    }))
}

exports.playerOnStreak = async function(db, players, streakCount) {
    const queries = players.map(async (player) => {
        return await db.getAsync(`SELECT id32, 
       Count(streak_group) AS streak_count, 
       CASE 
         WHEN win_loss = 1 THEN "win" 
         ELSE "lose" 
       END                 AS streak_type 
FROM   (SELECT id32, 
               match_player_table.match_id, 
               winner, 
               game_team, 
               CASE 
                 WHEN game_team = winner THEN true 
                 ELSE false 
               END 
               AS 
                      win_loss, 
               ( Row_number() 
                   OVER ( 
                     ORDER BY match_id DESC) - Row_number() 
                 OVER ( 
                   partition BY CASE WHEN game_team 
                 = winner 
                 THEN true ELSE false END 
                   ORDER BY match_id DESC) ) AS 
               streak_group, 
               Row_number() 
                 OVER ( 
                   ORDER BY match_id DESC) 
               AS 
                      one, 
               Row_number() 
                 OVER ( 
                   partition BY CASE WHEN game_team = winner THEN true ELSE 
                 false END 
                   ORDER BY match_id DESC) 
               AS 
                      two 
        FROM   match_player_table 
               INNER JOIN match_table 
                       ON match_table.id = match_player_table.match_id 
        ORDER  BY match_id DESC)
        where id32 = ? GROUP BY
          streak_group, 
          win_loss 
ORDER  BY match_id DESC`, player.id32)
    })

    return await Promise.all(queries);
}

exports.fetchAllPlayers = async function(db) {
    const query = await db.allAsync("SELECT id, id32, mmr, name FROM player_table")

    return await Promise.all(query.map(async (player) => {
        let playerMetadata = {}
        try {
            playerMetadata = await steam.fetchLatestPlayerInformation(player.id)
            player.name = playerMetadata.personaname
        }
        catch (_) {
        }
        return player
    }))
}

exports.fetchPlayersByMmr = async function(db) {
    const query = await Promise.all((await db.allAsync(`
    SELECT *
    FROM
      (SELECT player_table.id32,
              player_table.id,
              player_table.calibration_games,
              name,
              mmr,
              count(match_id) AS match_count
       FROM match_player_table
       INNER JOIN player_table ON match_player_table.id32 = player_table.id32
       GROUP BY player_table.id32
       ORDER BY mmr DESC)
    WHERE calibration_games == 0
    LIMIT 50`)).map(async player => ({
        ...player,
        ...await exports.fetchPlayerRecent(db, player.id32, seasonTime)

    })))
    
    return query
}

exports.fetchPlayerRecent = async function(db, id32, timestamp) {
    const player = await db.getAsync("SELECT * from player_table WHERE id32 = ?", id32)
    
    player.matchCount = (await db.getAsync(`
    SELECT COUNT(*)
    FROM match_player_table
    INNER JOIN match_table ON match_table.id = match_player_table.match_id
    WHERE id32 = ? AND match_table.timestamp > ?`, id32, timestamp))["COUNT(*)"]
    player.winCount = (await db.getAsync(
        `SELECT COUNT(*)
        FROM match_player_table
        INNER JOIN match_table ON match_table.id = match_player_table.match_id
        AND match_player_table.game_team = match_table.winner
        WHERE match_player_table.id32 = ? AND match_table.timestamp > ?`, id32, timestamp))["COUNT(*)"]
    player.lossCount = player.matchCount - player.winCount

    return player
}

exports.fetchPlayer = async function(db, id32) {
    const player = await db.getAsync("SELECT * from player_table WHERE id32 = ?", id32)
    
    player.matchCount = (await db.getAsync("SELECT COUNT(*) FROM match_player_table where id32 = ?", id32))["COUNT(*)"]
    player.winCount = (await db.getAsync(
        `SELECT COUNT(*)
        FROM match_player_table
        INNER JOIN match_table ON match_table.id = match_player_table.match_id
        AND match_player_table.game_team = match_table.winner
        WHERE match_player_table.id32 = ?`, id32))["COUNT(*)"]
    player.lossCount = player.matchCount - player.winCount

    if (player.badges) {
        player.badges = JSON.parse(player.badges)
    }
    
    return player
}

async function updatePlayersMmrAfterMatch(db, matchID, winner) {
    const players = await exports.fetchPlayersFromMatch(db, matchID)
    const playerStreaks = await exports.playerOnStreak(db, players, 3)

    const calibratingPlayers = players.filter((player) => player.calibration_games > 0);

    playerStreaks.sort((a, b) => a.id32 < b.id32)
    for (let i = 0; i < playerStreaks.length; ++i) {

        players[i].streakCount = playerStreaks[i].streak_count
        if (playerStreaks[i].streak_count > 3) {
            players[i].winStreak = playerStreaks[i].streak_type == "win"
            players[i].loseStreak = playerStreaks[i].streak_type == "lose"
        }
        else {
            players[i].winStreak = false
            players[i].loseStreak = false
        }
    }
    
    mmr.updateMmrSystem(players, winner)
    await exports.updatePlayersMmr(db, players)
    await exports.updatePlayersCalibration(db, calibratingPlayers)
}

exports.addMatch = async function(db, matchData) {

    // first - reject the match if it's already in the DB.
    if (matchData.match_id == 0) {
        console.log("Error: match ID contains 0 - cannot upload.")
        console.log("Logging remaining JSON file: ", matchData)
        return
    }

    if (await exports.isValidMatch(db, matchData.match_id)) {
        return
    }

    await db.runAsync("INSERT INTO match_table(id, duration, winner, timestamp, radkills, direkills) VALUES(?, ?, ?, ?, ?, ?)", [
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
        newPlayers = newPlayers.map((player) => {
            player.mmr = mmr.startingMmr
            player.calibration_games = 6
            return player
        })
        let valueString = "(?, ?, ?, ?, ?),".repeat(newPlayers.length).slice(0, -1)
        await db.runAsync(`INSERT INTO player_table(id, id32, name, mmr, calibration_games) VALUES` + valueString, newPlayers.map((player) => Object.values(player)).flat())
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

        if (player.captain == undefined) {
            player.captain = null
        }
        
        const values = Object.keys(player).sort().map((key) => player[key])
        return [matchData.match_id, ...values]
    })

    // I don't believe this can lead to an SQL injection because a value string is
    // built off the length rather than inserted in directly.
    let smallValue = "(" + "?, ".repeat(matchPlayers[0].length).slice(0, -2) + "),"
    let valueString = smallValue.repeat(matchPlayers.length).slice(0, -1)

    await db.runAsync("INSERT INTO match_player_table(match_id, assists, buffs, captain, damage, deaths, denies, game_team, gpm, healing, hero_name, id32, items, kills, last_hits, level, player_name, steam_id, xpm) VALUES" + valueString, matchPlayers.flat())

    // mmr todo.
    await updatePlayersMmrAfterMatch(db, matchData.match_id, utilities.teamStringToInt(matchData.game_winner))
}
