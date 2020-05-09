'use strict'

const database = require('./database')
const parser = require('./parser')
const fs = require('fs')

const db = database.startDatabase()

const path = "/Users/owen/Documents/replays/"
const files = fs.readdirSync(path)
files.sort()

files.filter((file) => file.endsWith(".dem")).forEach((file) => {
    parser.parseReplay(path + file, async (err, matchData) => {
        if (err) {
            console.log("Error: Replay parse error:", err)
            return
        }
        await database.addMatch(db, matchData)
    })
})
