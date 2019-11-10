'use strict'

const fs = require('fs').promises
const database = require('./database')
const steam = require('./steam_api')
const utilities = require('./utilities')

class Formatter {
    constructor(page) {
        this.page = page
    }

    div(className, str) {
        this.page = this.page + "<div class='" + className + "'>" + str + "</div>"
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

    openTableRow() {
        return this.openDiv("table-row")
    }

    tableCell(data, className) {
        this.div(className == undefined ? "cell" : className, data)
        return this
    }

    closeTableRow() {
        return this.closeDiv()
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

    matchHeader() {
        return this.div("match-header", `Match #${this.match.id}`)
    }

    radiantHeader() {
        return this.div("radiant header", "Radiant team")
    }

    direHeader() {
        return this.div("dire header", "Dire team")
    }

    hero(hero) {
        const heroStr = hero.replace("npc_dota_hero_", "<img class='match-hero-img' src='/dota_assets/") + "_vert.jpg'>"

        return this.tableCell(heroStr, "cell cell-hero-img")
    }

    items(itemsStr) {
        const items = itemsStr.split(",").map((item) => "/dota_assets/" + item + "_lg.png")

        let extraClass = items.length > 6 ? "cell cell-item cell-item-adjust" : "cell cell-item"
        return this.tableCell(items.slice(0, 6).reduce((prev, next) => prev + "<img class='cell-item-img' src='" + next + "'>", "")+ items.slice(6).reduce((prev, next) => prev + "<img class='cell-bp-img' src='" + next + "'>", ""), extraClass)
    }

    team(players) {
        for (let player of players) {
            this.openTableRow()
            this.hero(player.hero_name)
            let name = player.player_name
            if (name.length > 20) {
                name = name.slice(0, 15) + "..."
            }
            this.tableCell(`<a href=/player/${player.id32}> ${name}</a>`, "cell cell-player")
            this.tableCell(`${player.kills}`)
            this.tableCell(`${player.deaths}`)
            this.tableCell(`${player.assists}`)
            this.tableCell(`${player.last_hits}`)
            this.tableCell(`${player.denies}`)
            this.tableCell(`${Number.parseInt(player.gpm)}`)
            this.tableCell(`${Number.parseInt(player.xpm)}`)
            this.tableCell(player.damage, "cell cell-extra")
            this.tableCell(player.healing, "cell cell-extra")
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
        return this.openTableRow().tableCell("Hero", "cell cell-hero-title").tableCell("Player", "cell cell-player").tableCell("K").tableCell("D").tableCell("A").tableCell("LH").tableCell("DN").tableCell("GPM").tableCell("XPM").tableCell("DMG", "cell cell-extra").tableCell("Heal", "cell cell-extra").tableCell("Items", "cell cell-item").closeTableRow()
    }

    date() {
        const date = new Date(this.match.timestamp * 1000)
        return this.div("date", date)
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
        return this.div("player-pic", `<img class=player-pic-img src='${this.player.metadata.avatarfull}'></img>`)
    }

    mmr() {
        return this.openDiv("player-section").div("player-mmr-header", "MMR").div("player-mmr-value", "9999").closeDiv()
    }

    winLoss() {
        return this.openDiv("player-section").div("player-wl-header", "Wins/Losses").div("player-wl-value", `${this.player.winCount} - ${this.player.lossCount}`).closeDiv()
    }

    winPercentage() {
        const percent = this.player.winCount / this.player.matchCount * 100.0;
        return this.openDiv("player-section").div("player-win-pc-header", "Win Rate").div("player-win-pc-value", `${percent.toFixed(1)}%`).closeDiv()
    }

}

class Render {
    constructor(db) {
        this.db = db
        this.templateString = require('fs').readFileSync("template.html", "utf8")
    }

    async buildPlayer(playerID) {
        const fileName = `cached/${playerID}.html`

        const player = await database.fetchPlayer(this.db, playerID)

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
        
        formatter.openDiv("player-header")
        formatter.profilePicture().playerName().mmr().winLoss().winPercentage().closeDiv()

        return this.closeTemplate(formatter.page)
    }

    async buildMatch(matchID) {
        const fileName = `cached/${matchID}.html`

        const match = await database.fetchMatch(this.db, matchID)

        const formatter = new MatchFormatter(String(this.templateString), match)
        formatter.matchHeader()
        formatter.date()
        formatter.winner()

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

        // fs.writeFile(fileName, this.closeTemplate(page + JSON.stringify(match)), (err) => {
        //     callback(err, err ? null : fileName)
        // })
    }

    async matchPage(matchID) {
        if (!await database.isValidMatch(this.db, matchID)) {
            throw Error(`Attempted to access ${matchID}, but was not found in database.`)
        }
        return this.buildMatch(matchID)
    }

    async playerPage(playerID) {
        if (!await database.isValidPlayer(this.db, playerID)) {
            throw Error(`Attempted to access ${playerID}, but was not found in database.`)
        }

        return this.buildPlayer(playerID)
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