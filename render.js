'use strict'

const fs = require('fs')
const database = require('./database')
const steam = require('./steam_api')
const utilities = require('./utilities')

function fixupBuffs(buffs) {
    // add new fixups here as they arrive
    const fixed = {
        "item_ultimatescepter_2" : "item_ultimate_scepter",
        "item_moonshard" : "item_moon_shard"
    }
    Object.keys(buffs).forEach((buff) => {
        if (fixed.hasOwnProperty(buff)) {
            buffs[fixed[buff]] = buffs[buff]
            delete buffs[buff]
        }
    })
}

class Formatter {
    constructor(page) {
        this.page = page
    }

    title(description) {
        this.page = this.page + `<title>${description}</title>`
        return this
    }
    div(className, str) {
        this.page = this.page + `<div class='${className}'>${str}</div>\n`
        return this
    }

    openDiv(className) {
        this.page = this.page + "<div class='" + className + "'>"
        return this
    }

    closeDiv() {
        this.page = this.page + "</div>"
        return this
    }

    openTableRow(className) {
        return this.openDiv("table-row " + (className == undefined ? "" : className))
    }

    tableCell(data, className) {
        this.div(className == undefined ? "cell" : className, data)
        return this
    }

    closeTableRow() {
        return this.closeDiv()
    }

    hero(hero) {
        const heroStr = hero.replace("npc_dota_hero_", "<img src='/dota_assets/") + "_vert.jpg'></img>"

        return this.tableCell(heroStr, "cell match-hero-img")
    }

    items(itemsStr) {
        const items = itemsStr.split(",").map((item) => "/dota_assets/" + item + "_lg.png")

        let extraClass = items.length > 6 ? "cell cell-item-adjust" : "cell cell-item-img"

        return this.tableCell(
            items.slice(0, 6)
            .reduce((prev, next) => prev + `<img src='${next}'></img>`, ""), extraClass)
            + this.tableCell(items.slice(6)
            .reduce((prev, next) => prev + `<img src='${next}'></img>`, ""), extraClass)
    }

    buffs(buffsStr) {
        if (buffsStr === "") {
            return this.tableCell("", "cell cell-buff")
        }

        const allbuffs = buffsStr.split(",")

        // allBuffs is comma separated by buffname, then the buff count
        const buffmap = {}

        for (let i = 0; i < allbuffs.length; i += 2) {
            buffmap[allbuffs[i].slice(6).toLowerCase()] = +allbuffs[i + 1]
        }

        fixupBuffs(buffmap)

        const buffCell = []

        for (const [buffName, buffValue] of Object.entries(buffmap)) {
            buffCell.push(
                `<div class='cell-buff-modifier'><img class='cell-buff-img' src='/dota_assets/${buffName}_lg.png'>`
                + (buffValue == 1 ? "" : `<div class='cell-buff-value'>${buffValue}</div>`) + "</div>")
        }

        return this.tableCell(
            buffCell.reduce((prev, next) => prev + next), "cell cell-buff")
    }

    matchDuration(duration, className) {
        const { hours, minutes, seconds } = utilities.calculateMatchLength(duration)
        return this.tableCell(`${hours > 0 ? `${hours}:`: ""}${minutes}:${seconds}`, className == undefined ? "cell cell-match-length" : className)
    }

    fullDateString(timestamp) {
        const date = new Date(timestamp * 1000)
        return `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")} ${date.getUTCDate().toString().padStart(2, "0")}/${(date.getUTCMonth() + 1).toString().padStart(2, "0")}/${date.getUTCFullYear()}`
    }

}

class FrontPageFormatter extends Formatter {
    constructor(page, match) {
        super(page)
    }

    playerTable(players) {
        this.openTableRow("table-row-big-header")
        this.tableCell("Rank", "cell cell-big")
        this.tableCell("", "cell  cell-big cell-player-profile-pic")
        this.tableCell("Name",  "cell cell-big cell-big-player-name")
        this.tableCell("Win/Loss",  "cell cell-big cell-win-loss")
        this.tableCell("MMR", "cell cell-big")
        this.closeTableRow()
        for (let i = 0; i < players.length; i++) {
            let player = players[i]
            this.openTableRow("table-row-big")
            let name = player.metadata.personaname

            this.tableCell(`#${i + 1}`, "cell cell-big cell-player-rank")
            this.tableCell(`<img src=${player.metadata.avatarfull}</img>`, "cell  cell-big cell-player-profile-pic")
            
            this.tableCell(`<a href=/player/${player.id32}> ${name}</a>`, "cell cell-big cell-big-player-name")
            this.tableCell(`${player.winCount}-${player.lossCount}`, "cell cell-big cell-win-loss")
            this.tableCell(player.mmr.toFixed(0), "cell cell-big")
            this.closeTableRow()
        }
        
    }
}

class MatchesPageFormatter extends Formatter {
    constructor(page, matches) {
        super(page)
        this.matches = matches
    }

    matchesTable() {
        this.openTableRow("table-row-big-header")
        this.tableCell("Match ID", "cell cell-player-match-id")
        this.tableCell("Date", "cell cell-player-date-header")
        this.tableCell("Length", "cell cell-match-length")
        this.tableCell("Radiant", "cell cell-team-heroes-header")
        this.tableCell("Dire", "cell cell-team-heroes-header")
        this.closeTableRow()

        for (const match of this.matches) {
            const { id, duration, winner, timestamp, rad_heroes, dire_heroes } = match
            this.openTableRow(`table-row ${winner === 2 ? "radiant" : "dire"}`)
            this.tableCell(`<a href="/matches/${id}">#${id}</a>`, "cell cell-player-match-id")
            this.tableCell(this.fullDateString(timestamp), "cell cell-player-date")
            this.matchDuration(duration)
            rad_heroes.forEach(hero => this.hero(hero))
            this.tableCell("", "cell cell-spacing")
            dire_heroes.forEach(hero => this.hero(hero))
            this.closeTableRow()
        }
    }
}

class MatchFormatter extends Formatter {

    constructor(page, match) {
        super(page)
        this.match = match
    }

    winner() {
        const winner = this.match.winner == utilities.RADIANT ? "Radiant Victory" : "Dire Victory"
        return this.div("winner " + winner, winner)
    }

    radiantHeader() {
        return this.div("radiant header", "Radiant team")
    }

    direHeader() {
        return this.div("dire header", "Dire team")
    }

    team(players) {
        for (let player of players) {
            this.openTableRow()
            this.hero(player.hero_name)
            let name = player.player_name
            if (name.length > 18) {
                name = name.slice(0, 17) + "..."
            }
            this.tableCell(`<a href=/player/${player.id32}> ${name}</a>`, "cell cell-player")
            this.tableCell(`${player.kills}`,)
            this.tableCell(`${player.deaths}`)
            this.tableCell(`${player.assists}`)
            this.tableCell(`${player.last_hits}`)
            this.tableCell(`${player.denies}`)
            this.tableCell(`${Number.parseInt(player.gpm)}`)
            this.tableCell(`${Number.parseInt(player.xpm)}`)
            this.tableCell(player.damage, "cell cell-extra")
            this.tableCell(player.healing, "cell cell-extra")
            this.buffs(player.buffs)
            this.items(player.items)
            this.closeTableRow()
        }
    }

    direTeam() {
        return this.team(this.match.player.filter(player => player.game_team == utilities.DIRE))
    }

    radiantTeam() {
        return this.team(this.match.player.filter(player => player.game_team == utilities.RADIANT))
    }

    matchTableHeader() {
        return this
        .openTableRow()
        .tableCell("Hero", "cell cell-hero-title")
        .tableCell("Player", "cell cell-player")
        .tableCell("K")
        .tableCell("D")
        .tableCell("A")
        .tableCell("LH")
        .tableCell("DN")
        .tableCell("GPM")
        .tableCell("XPM")
        .tableCell("DMG", "cell cell-extra")
        .tableCell("Heal", "cell cell-extra")
        .tableCell("Buffs", "cell cell-buff")
        .tableCell("Items", "cell cell-item").closeTableRow()
    }

    matchHeader() {
        return this.div("match-header", `#${this.match.id} – ${this.fullDateString(this.match.timestamp)}`)
    }

    duration() {
        const timestamp = utilities.calculateMatchLength(this.match.duration)
        return this.div("date", `Duration: ${timestamp.hours > 0 ? `${timestamp.hours}:` : ""}${timestamp.minutes}:${timestamp.seconds}`)
    }
}

class PlayerFormatter extends Formatter {
    constructor(page, player) {
        super(page)
        this.player = player
    }

    playerName() {
        return this.div("player-name", this.player.metadata.personaname)
    }

    profilePicture() {
        return this.div("player-pic", `<img src='${this.player.metadata.avatarfull}'></img>`)
    }

    mmr() {
        return this.openDiv("player-section").div("player-mmr-header", "MMR").div("player-mmr-value", this.player.mmr.toFixed(0)).closeDiv()
    }

    winLoss() {
        return this.openDiv("player-section").div("player-wl-header", "Wins/Losses").div("player-wl-value", `${this.player.winCount} - ${this.player.lossCount}`).closeDiv()
    }

    winPercentage() {
        const percent = this.player.winCount / this.player.matchCount * 100.0
        return this.openDiv("player-section").div("player-win-pc-header", "Win Rate").div("player-win-pc-value", `${percent.toFixed(1)}%`).closeDiv()
    }

    playerMatchTableHeader() {
        return this
        .openTableRow()
        .tableCell("Hero", "cell cell-hero-title")
        .tableCell("Date", "cell cell-player-date-header")
        .tableCell("Team", "cell cell-long")
        .tableCell("Victory", "cell cell-long")
        .tableCell("Match ID", "cell cell-player-match-id")
        .tableCell("Duration", "cell cell-long")
        .tableCell("K")
        .tableCell("D")
        .tableCell("A")
        .tableCell("LH")
        .tableCell("DN")
        .tableCell("GPM")
        .tableCell("XPM")
        .tableCell("Items", "cell cell-item").closeTableRow()
    }

    matches(matches) {
        for (let match of matches) {
            const winner = match.winner == match.game_team

            this.openTableRow(winner ? "radiant" : "dire")
            this.hero(match.hero_name)

            this.tableCell(this.fullDateString(match.timestamp), "cell cell-player-date")

            let team = utilities.teamIntToString(match.game_team)
            team = team.charAt(0).toLocaleUpperCase() + team.substr(1)
            this.tableCell(team, "cell cell-long")

            this.tableCell(winner ? "Victory" : "Defeat", "cell cell-long")
            this.tableCell(`<a href=/matches/${match.match_id}> #${match.match_id}</a>`, "cell cell-player-match-id")

            this.matchDuration(match.duration)
            this.tableCell(`${match.kills}`)
            this.tableCell(`${match.deaths}`)
            this.tableCell(`${match.assists}`)
            this.tableCell(`${match.last_hits}`)
            this.tableCell(`${match.denies}`)
            this.tableCell(`${Number.parseInt(match.gpm)}`)
            this.tableCell(`${Number.parseInt(match.xpm)}`)
            this.items(match.items)
            this.closeTableRow()
        }
    }

}

class Render {
    constructor(db) {
        this.db = db
        this.templateString = fs.readFileSync("template.html", "utf8")
        this.homePage = fs.readFileSync("index.html", "utf8")
        this.matchesPage = fs.readFileSync("matches.html", "utf8")
    }

    async buildFrontpage() {
        const formatter = new FrontPageFormatter(String(this.homePage))

        const players = await Promise.all((await database.fetchPlayersByMmr(this.db)).map(async (player) => {
            let playerMetadata = {}
            try {
                playerMetadata = await steam.fetchLatestPlayerInformation(player.id)
            }
            catch (_) {
                playerMetadata.avatarfull = "/unknown_profile.jpg"
                playerMetadata.personaname = player.name
                playerMetadata.profileurl = `https://steamcommunity.com/id/${player.steam_id}`
            }
            player.metadata = playerMetadata

            return player
        }))

        formatter.openDiv("table-big")

        formatter.playerTable(players)

        formatter.closeDiv()
        return this.closeTemplate(formatter.page)
    }

    async buildMatchespage() {
        const matches = await database.fetchMatches(this.db)
        const formatter = new MatchesPageFormatter(String(this.matchesPage), matches)

        formatter.openDiv("table")

        formatter.matchesTable(matches)

        formatter.closeDiv()

        return this.closeTemplate(formatter.page)
    }

    async buildPlayer(playerID, page) {

        const matchesPerPage = 10

        // page is going to be 1-indexed
        const startPage = (page - 1) * matchesPerPage
        const endPage = page * matchesPerPage

        const player = await database.fetchPlayer(this.db, playerID)
        let matches = await database.fetchMatchesForPlayer(this.db, playerID, startPage, endPage)

        let playerMetadata = {}
        try {
            playerMetadata = await steam.fetchLatestPlayerInformation(player.id)
        }
        catch (_) {
            playerMetadata.avatarfull = "/unknown_profile.jpg"
            playerMetadata.personaname = player.name
            playerMetadata.profileurl = `https://steamcommunity.com/id/${player.steam_id}`
        }
        player.metadata = playerMetadata

        const formatter = new PlayerFormatter(String(this.templateString), player)
        
        formatter.title(player.metadata.personaname + " - Stats")
        formatter.openDiv("player-header")
        formatter.profilePicture().playerName().mmr().winLoss().winPercentage().closeDiv()

        formatter.openDiv("table")
        if (!Array.isArray(matches)) {
            const tmp = []
            tmp.push(matches)
            matches = tmp
        }
        formatter.playerMatchTableHeader().matches(matches)
        formatter.closeDiv()

        formatter.openDiv("paginate")
        
        if (page != 1) {
            formatter.page += `<a href="/player/${player.id32}/${page - 1}">Previous Page | </a>`
        }
        formatter.page += `<a href="/player/${player.id32}/${page + 1}">Next Page </a>`
        formatter.closeDiv()
        return this.closeTemplate(formatter.page)
    }

    async buildMatch(matchID) {

        const match = await database.fetchMatch(this.db, matchID)

        const formatter = new MatchFormatter(String(this.templateString), match)

        formatter.title(`Match - ${matchID}`)
        formatter.matchHeader()
        formatter.winner()
        formatter.duration()

        formatter.radiantHeader()
        formatter.openDiv("table")

        formatter.matchTableHeader()
        formatter.radiantTeam()

        formatter.closeDiv()

        formatter.openDiv().closeDiv()

        formatter.direHeader()
        formatter.openDiv("table")
        formatter.direTeam()

        formatter.closeDiv()

        formatter.page += `<script>document.querySelector('body').id = '${utilities.teamIntToString(match.winner)}-filter'</script>`

        return this.closeTemplate(formatter.page)
    }

    async matchPage(matchID) {
        if (!await database.isValidMatch(this.db, matchID)) {
            throw Error(`Attempted to access ${matchID}, but was not found in database.`)
        }
        return this.buildMatch(matchID)
    }

    async playerPage(playerID, page) {
        if (!await database.isValidPlayer(this.db, playerID)) {
            throw Error(`Attempted to access ${playerID}, but was not found in database.`)
        }

        return this.buildPlayer(playerID, page)
    }
    
    closeTemplate(page) {
        page += "</body></html>"
        return page
    }

    // the template page is the base HTML at the point
    // where we can start writing stuff into it.
    // it requires closing with closeTemplate() before sending.
    template() {
        return this.templateString
    }
}

module.exports = Render