const fsSync = require('fs')
const database = require('./database')
const badges = JSON.parse(fsSync.readFileSync("badges.json", "utf-8"))
const db = database.startDatabase()

async function resetSeason(seasonNumber) {
    const players = (await database.fetchPlayersByMmr(db)).slice(0, 10)

    badges.forEach((badge) => {
        badge.alt_text = badge.alt_text.replace("###", seasonNumber.toString())
    })

    for (let i = 0; i < players.length; ++i) {
        const player = players[i]
        if (player.badges == null) {
            player.badges = '[]'
        }
        const playerBadge = JSON.parse(player.badges)
        playerBadge.push(badges[i > 2 ? 3 : i])
        player.badges = JSON.stringify(playerBadge)
    }

    await database.updatePlayersBadges(db, players)

    const allPlayers = (await database.fetchAllPlayers(db)).map((player) => {
        player.calibration_games = 6
        player.mmr = 2000
        return player
    })

    await Promise.all([
        await database.updatePlayersCalibration(db, allPlayers),
        await database.updatePlayersMmr(db, allPlayers)
    ])
}


resetSeason(4).then(() => {})

