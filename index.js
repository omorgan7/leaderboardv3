'use strict'

require('log-timestamp')

const database = require('./database')
const parser = require('./parser')
const render = require('./render')

const express = require('express')
const cookieParser = require('cookie-parser')
const crypto = require('bcryptjs')
const formidable = require('formidable')
const fs = require('fs')
const secrets = require('./secrets')

const loginHash = secrets.loginHash

const app = express()

const loginCookieOptions = {
    maxAge : 1000 * 60 * 10, // expires after 10 minutes
    httpOnly : true,
    signed : true,
    sameSite : 'strict'
}

app.use(cookieParser(secrets.cookieSecret))
app.use(express.json())

const db = database.startDatabase()
const renderer = new render(db)

function logEndpoint(req) {
    console.log(`Requested: ${req.originalUrl}, headers: 'host: ${req.headers['host']}, user-agent: ${req.headers['user-agent']}, referer: ${req.headers['referer']},`)
}

app.get('/styles.css', (req, res, next) => {
    res.sendFile('styles.css', {root: './'})
})

app.get('/', async (req, res, next) => { 
    logEndpoint(req)
    if (req.signedCookies['logged-in'] == null) {
        res.cookie('logged-in', 'false', loginCookieOptions);
    }

    const page = await renderer.buildFrontpage()
    res.send(page)
})

app.get('/matches', async (req, res, next) => {
    logEndpoint(req)
    // permanent redirect.
    res.set('location', '/match+page=1')
    res.status(301).send()
})

app.get('/match', async (req, res, next) => {

    logEndpoint(req)
    // permanent redirect.
    res.set('location', '/match+page=1')
    res.status(301).send()
})

app.get(/match\+page=(\d+)/, async (req, res, next) => {
    logEndpoint(req)
    const paginate = Number.parseInt(req.params[0])
    if (paginate == NaN)
    {
        res.send(404)
        return
    }
    const page = await renderer.buildMatchesPage(paginate)
    res.send(page)
})

app.post('/login', async (req, res, next) => {
    logEndpoint(req)
    const numAttemptsOptions = {
        maxAge : 1000 * 60 * 60 * 24  
    }

    let numLoginAttempts = 0
    if (req.cookies['login-fail'] != undefined) {
         numLoginAttempts = parseInt(req.cookies['login-fail'])
    }
    if (numLoginAttempts != NaN) {
        if (numLoginAttempts > 10) {
            console.log("10 failed consecutive logins. 24hr block set.")
            res.cookie('login-fail', toString(numLoginAttempts), numAttemptsOptions) // expires after 24hours
            res.sendFile('login.html', {root: './'})
            return
        }
    }
    else {
        numLoginAttempts = 0
    }

    const form = new formidable.IncomingForm()
    form.parse(req, async (err, fields, files) => {
        const result = await crypto.compare(fields.pw, loginHash)
        if (result) {
            res.cookie('logged-in', 'true', loginCookieOptions)
            res.cookie('login-fail', '0', {maxAge: 0})
            console.log("Successful login.")
            res.redirect("/upload")
        }
        else {
            // modify the page to say wrong login
            numLoginAttempts += 1
            console.log("Login attempt failed. Login number: " + numLoginAttempts)
            res.cookie('login-fail', numLoginAttempts.toString(), numAttemptsOptions)
            res.sendFile('login.html', {root: './'})
        }
    })
})

app.get('/login', (req, res, next) => {
    logEndpoint(req)
    if (req.signedCookies['logged-in'] == "true") {
        res.redirect("/upload")
        return
    }
    res.sendFile('login.html', {root: './'})
})

app.get(/\/matches\/(\d+)/, async (req, res, next) => {
    logEndpoint(req)
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

app.get(/\/player\/(\d+)\/?(\d)*/, async (req, res, next) => {
    const playerID = parseInt(req.params[0])
    if (playerID == NaN) {
        res.sendStatus(404)
        return
    }

    try {
        const paginate = req.params[1] ? Number.parseInt(req.params[1]) : 1
        const page = await renderer.playerPage(playerID, paginate)
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

app.get(/\/badges\/(.+png)/, (req, res, next) => {
    res.sendFile(req.params[0], {root: "./badges/"})
})

app.get('/favicon.png', (req, res, next) => {
    res.sendFile('favicon.png', {root: './'} )
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
    logEndpoint(req)
    if (req.signedCookies['logged-in'] == "true") {
        res.sendFile('upload.html', {root: './'});
        return
    }
    
    res.redirect("/")
})

app.get('/api', async (req, res, next) => {
    try {
        const url = new URLSearchParams(req.query)
        const v = url.get('v')
        if (v == undefined || v < 1) {
            res.sendStatus(403)
            return
        }

        const key = url.get('key')
        if (key != secrets.apiKey) {
            res.sendStatus(403)
            return;
        }

        const match = url.get('match')
        if (match != undefined) {
            if (match === "recent") {
                res.send(JSON.stringify(await database.recentMatch(db)))
                return
            }
            else {
                const matchID = Number.parseInt(match)
                if (matchID == NaN) {
                    res.sendStatus(404)
                    return;
                }

                res.send(JSON.stringify(await database.fetchMatch(db, matchID)))
                return
            }
        }
        const p = url.get('player')

        if (p != undefined) {
            const playerID = Number.parseInt(p)
            if (playerID == NaN) {
                res.sendStatus(404)
                return;
            }

            const player = await database.fetchPlayer(db, playerID)
            player.matches = await database.fetchAllMatchesForPlayer(db, playerID);

            res.send(JSON.stringify(player))
            return
        }

        const all = url.get('all')
        if (all != undefined) {
            res.send(JSON.stringify(await database.fetchAllPlayers(db)))
            return
        }
    }
    catch(err) {
        console.log(err)
        res.send(500)
    }
})

app.get("/matchmaking", async (req, res, next) => {
    res.sendFile("matchmake.html", {root: './'})
})

app.post('/create', (req, res, next) => {
    logEndpoint(req)
    const form = new formidable.IncomingForm()
    form.maxFileSize = 512 * 1024 * 1024
    form.parse(req, (err, fields, files) => {
        if (err) {
            console.log("Error: ", err, "With: ", fields, files)
            res.end()
            return
        }
        parser.parseReplay(files.replay.path, async (err, matchData) => {
            if (err) {
                console.log("Error: Replay parse error:", err)
                res.end()
                return
            }
            await database.addMatch(db, matchData)
        })
        res.redirect("/")
    })
})

app.get('(*)', (req, res, next) => {
    logEndpoint(req)
    res.sendStatus(404)
})

app.listen(8081)

