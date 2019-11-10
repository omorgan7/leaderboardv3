'use strict'

const database = require('./database')
const parser = require('./parser')
const render = require('./render')

const express = require('express')
const cookieParser = require('cookie-parser')
const crypto = require('bcryptjs')
const formidable = require('formidable')
const fs = require('fs')

const app = express()

const loginCookieOptions = {
    maxAge : 1000 * 60 * 10, // expires after 10 minutes
    httpOnly : true,
    signed : true
}

// todo: wire up a proper secret.
app.use(cookieParser("a"))
app.use(express.json())

function sendHomePage(req, res) {
    res.sendFile('index.html', {root: './'})
}

const db = database.startDatabase()
const renderer = new render(db)

app.get('/styles.css', (req, res, next) => {
    res.sendFile('styles.css', {root: './'})
})

app.get('/', (req, res, next) => { 
    if (req.signedCookies['logged-in'] == null) {
        res.cookie('logged-in', 'false', loginCookieOptions);
    }

    sendHomePage(req, res);
})

app.get(/\/matches\/(\d+)/, async (req, res, next) => {
    const matchID = parseInt(req.params[0])
    if (matchID == NaN) {
        res.sendStatus(404)
        return
    }

    try {
        const page = await renderer.matchPage(matchID)
        res.send(page)
    }
    catch (err) {
        console.log(err)
        res.sendStatus(404)
    }
})

app.get(/\/player\/(\d+)/, async (req, res, next) => {
    const playerID = parseInt(req.params[0])
    if (playerID == NaN) {
        res.sendStatus(404)
        return
    }

    try {
        const page = await renderer.playerPage(playerID)
        res.send(page)
    }
    catch (err) {
        console.log(err)
        res.sendStatus(404)
    }
})

app.get(/\/dota_assets\/(\w+\.(png|jpg))/, (req, res, next) => {
    fs.stat("./dota_assets/" + req.params[0], (err, stats) => {
        if (err) {
            console.log(err)
            return
        }
        res.sendFile(req.params[0], {root: './dota_assets/'})
    })
})

app.get("/unknown_profile.jpg", (req, res, next) => {
    res.sendFile("/unknown_profile.jpg", {root: "./steam_assets/"})
})

app.get("/background.jpg", (req, res, next) => {
    res.sendFile("background.jpg", {root: "./"})
})

app.get('/index.html', (req, res, next) => {
    res.redirect('/')
})

app.get('/upload', (req, res, next) => { 
    res.sendFile('upload.html', {root: './'});
})

app.post('/create', (req, res, next) => {
    const form = new formidable.IncomingForm()
    form.parse(req, (err, fields, files) => {
        if (err) {
            console.log("Error: ", err, "With: ", fields, files)
            return
        }
        parser.parseReplay(files.replay.path, async (err, matchData) => {
            if (err) {
                console.log("Error: Replay parse error:", err)
                return
            }
            await database.addMatch(db, matchData)
        })
        res.redirect("/")
    })
})

app.get('(*)', (req, res, next) => {
    res.sendStatus(404)
})

app.listen(8080)

