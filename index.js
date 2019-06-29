'use strict'

const database = require('./database')
const parser = require('./parser')

const db = database.createDatabase(dbErrCallback)

parser.parseReplay(process.argv[2], (err, matchData) => {
    if (err) throw err
    database.addMatch(db, matchData)
})