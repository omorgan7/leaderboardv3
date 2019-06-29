'use strict'

const database = require('./database')
const parser = require('./parser')
const express = require('express')
const cookieParser = require('cookie-parser');
const crypto = require('bcryptjs');
const formidable = require('formidable');

const app = express();

const loginCookieOptions = {
    maxAge : 1000 * 60 * 10, // expires after 10 minutes
    httpOnly : true,
    signed : true
}

// todo: wire up a proper secret.
app.use(cookieParser("a"));
app.use(express.json());

function sendHomePage(req, res) {
    res.sendFile('index.html', {root: './'});
}

const db = database.createDatabase()

app.get('/styles.css', (req, res, next) => {
    res.sendFile('styles.css', {root: './'})
})

app.get('/', (req, res, next) => { 
    if (req.signedCookies['logged-in'] == null) {
        res.cookie('logged-in', 'false', loginCookieOptions);
    }

    sendHomePage(req, res);
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
        parser.parseReplay(files.replay.path, (err, matchData) => {
            if (err) {
                console.log("Error: Replay parse error:", err)
                return
            }
            database.addMatch(db, matchData)
            console.log("Added match to DB")
        })
        res.redirect("/")
    })
})

app.get('*', (req, res, next) => { 
    res.status(404).send("404")
})

app.listen(8080)

