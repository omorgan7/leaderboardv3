'use strict'

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
    signed : true
}

app.use(cookieParser(secrets.cookieSecret))
app.use(express.json())

const db = database.startDatabase()
const renderer = new render(db)

app.get('/styles.css', (req, res, next) => {
    res.sendFile('styles.css', {root: './'})
})

app.get('/', async (req, res, next) => { 
    if (req.signedCookies['logged-in'] == null) {
        res.cookie('logged-in', 'false', loginCookieOptions);
    }

    const page = await renderer.buildFrontpage()
    res.send(page)
})

app.get('/matches', async (req, res, next) => {

    // permanent redirect.
    res.set('location', '/match+page=1')
    res.status(301).send()
})

app.get('/match', async (req, res, next) => {

    // permanent redirect.
    res.set('location', '/match+page=1')
    res.status(301).send()
})

app.get(/match\+page=(\d+)/, async (req, res, next) => {
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
    if (req.signedCookies['logged-in'] == "true") {
        res.redirect("/upload")
        return
    }
    res.sendFile('login.html', {root: './'})
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
    if (req.signedCookies['logged-in'] == "true") {
        res.sendFile('upload.html', {root: './'});
        return
    }
    
    res.redirect("/")
})

app.post('/create', (req, res, next) => {
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
    res.sendStatus(404)
})

app.listen(8081)

