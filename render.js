'use strict'

const fs = require('fs')
const database = require('./database')

class Formatter {
    constructor(page, match) {
        this.page = page
        this.match = match
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

    winner() {
        const winner = this.match.winner + " Victory"
        return this.div("winner", winner)
    }

    matchHeader() {
        return this.div("match-header", `Match #${this.match.id}`)
    }

    radiantHeader() {
        return this.div("radiant-header", "Radiant team")
    }

    direHeader() {
        return this.div("dire-header", "Dire team")
    }

    hero(hero) {
        const heroStr = hero.replace("npc_dota_hero_", "<img class='match-hero-img' src='/dota_assets/") + "_vert.jpg'>"

        return this.tableCell(heroStr, "cell cell-hero-img")
    }

    items(itemsStr) {
        const items = itemsStr.split(",").map((item) => "/dota_assets/" + item + ".png")

        return this.tableCell(items.slice(0, 6).reduce((prev, next) => prev + "<img class='cell-item-img' src='" + next + "'>", "")+ items.slice(6).reduce((prev, next) => prev + "<img class='cell-bp-img' src='" + next + "'>", ""), "cell cell-item")
    }

    team(players) {
        for (let player of players) {
            this.openTableRow()
            this.hero(player.hero_name)
            let name = player.player_name
            if (name.length > 20) {
                name = name.slice(0, 15) + "..."
            }
            this.tableCell(name, "cell cell-player")
            this.tableCell(`${player.kills}`)
            this.tableCell(`${player.deaths}`)
            this.tableCell(`${player.assists}`)
            this.tableCell(`${player.last_hits}`)
            this.tableCell(`${player.denies}`)
            this.tableCell(`${Number.parseInt(player.gpm)}`)
            this.tableCell(`${Number.parseInt(player.xpm)}`)
            this.tableCell(player.damage)
            this.tableCell(player.healing)
            this.items(player.items)
            this.closeTableRow()
        }
    }

    direTeam() {
        return this.team(this.match.player.slice(5, 10))
    }

    radiantTeam() {
        return this.team(this.match.player.slice(0, 5))
    }

    matchTableHeader() {
        return this.openTableRow().tableCell("Hero").tableCell("Player", "cell cell-player").tableCell("K").tableCell("D").tableCell("A").tableCell("LH").tableCell("DN").tableCell("GPM").tableCell("XPM").tableCell("DMG").tableCell("Heal").tableCell("Items", "cell cell-item").closeTableRow()
    }

    date() {
        const date = new Date(this.match.timestamp * 1000)
        return this.div("date", date)
    }
}

class Render {
    constructor(db) {
        this.db = db
        this.templateString = fs.readFileSync("template.html", "utf8")
    }

    buildFile(matchID, callback) {
        const fileName = `cached/${matchID}.html`

        database.fetchMatch(this.db, matchID, (err, match) => {
            if (err) {
                callback(err, null)
                return
            }

            const formatter = new Formatter(String(this.templateString), match)
            formatter.matchHeader()
            formatter.date()
            formatter.winner()

            formatter.radiantHeader()
            formatter.openDiv("table")

            formatter.matchTableHeader()
            formatter.radiantTeam()

            formatter.closeDiv()

            formatter.direHeader()
            formatter.openDiv("table")
            formatter.direTeam()

            formatter.closeDiv()

            callback(err, this.closeTemplate(formatter.page))

            // fs.writeFile(fileName, this.closeTemplate(page + JSON.stringify(match)), (err) => {
            //     callback(err, err ? null : fileName)
            // })
        })
    }

    page(matchID, callback) {
        database.isValidMatch(this.db, matchID, (err, isValid) => {
            if (err) {
                callback(err, null)
            }

            if (!isValid) {
                callback(Error(`Attempted to access ${matchID}, but was not found in database.`), null)
                return
            }

            const cachedFile = `cached/${matchID}.html`
            fs.exists(cachedFile, (exists) => {
                // if (!exists) {
                    this.buildFile(matchID, callback)
                    // return
                // }
                // callback(null, cachedFile)
            })
        })
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