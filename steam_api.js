'use strict'

const http = require('https')
const secrets = require('./secrets')

http.getAsync = function(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error('Failed to load page, status code: ' + response.statusCode))
            }
            const body = []
            response.on('data', (chunk) => body.push(chunk))
            response.on('end', () => resolve(body.join('')))
        })
        request.on('error', (err) => reject(err))
    })
}

const maxTries = 4

async function fetchLatestPlayerInformation(steam_id, tryCount = 0) {
    const apiCall = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v1/?key=${secrets.steamKey}&steamids=${steam_id}`

    if (tryCount == maxTries) {
        throw Error("SteamAPI timed out - server unavailable")
    }

    try {
        const payload = await http.getAsync(apiCall)
        const playerInformation = JSON.parse(payload).response.players.player[0]

        return playerInformation
    }
    catch(err) {
        if (err instanceof TypeError) {
            // this shouldn't really happen - if the SteamAPI responded correctly
            // then we should've gotten a valid JSON file, this indicates
            // that something isn't set up correctly.
            throw err
        }

        // retry recursively, with exponential backoff.
        await new Promise(resolve => setTimeout(resolve, 5 + Math.pow(2, tryCount)))
        await fetchLatestPlayerInformation(steam_id, tryCount + 1)
    }
}

exports.fetchLatestPlayerInformation = fetchLatestPlayerInformation
