'use strict'

const database = require('./database')
const parser = require('./parser')
const fs = require('fs')

const db = database.startDatabase()

const path = "/Users/owen/Documents/replays/"
let files = fs.readdirSync(path)
files.sort()
files = files.filter((file) => file.endsWith(".dem"))

const length = files.length
var i = 0

const parse = async function() {
    let file = files[i]
    parser.parseReplay(path + file, async (err, matchData) => {
        if (err) {
            console.log("Error: Replay parse error:", err)
            return
        }
        
        await database.addMatch(db, matchData)
        if (i + 1 < length) {
            ++i
            await parse()
        }
    })
}

parse().then(()=>{console.log("done")})