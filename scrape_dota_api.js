const fs = require('fs')
const http = require('https')
const secrets = require('./secrets')

function fileClose(response) {
    if (response.statusCode != 200) {
        console.log(`Error attempting to read ${this.url} with code ${response.statusCode}: ${response.statusMessage}`)
        return
    }

    const path = "dota_assets/" + this.name;
    const file = fs.createWriteStream(path)
    response.pipe(file)
    file.on('finish', () => {
        file.close()
    }).on('error', (err) => {
        file.close()
        fs.exists(path, (exists) => {
                if (exists) {
                    fs.unlink(path, (err) => {if (err) console.log(err)})
                }
            })
        
        console.log(err)
    })
}

http.get(`https://api.steampowered.com/IEconDOTA2_570/GetHeroes/v1/?key=${secrets.steamKey}`, (response) => {
    if (response.statusCode != 200) {
        console.log(`Error attempting to read heroes json with code ${response.statusCode}: ${response.statusMessage}`)
        return
    }
    response.setEncoding("utf8")
    let str = ""
    response.on("data", (chunk) => {
        str += chunk
    })

    response.on("end", () => {
        const heroes = JSON.parse(str).result

        for (const hero of heroes.heroes) {
            const base = "https://cdn.dota2.com/apps/dota2/images/heroes/"
            const name = hero.name.replace("npc_dota_hero_", "")
        
            const appendices = ["_full.png", "_sb.png", "_lg.png", "_vert.jpg"]
        
            for (const appendix of appendices) {
                const url = base + name + appendix
                
                setTimeout( () => {
                    console.log("Fetching: " + url)
                    const request = http.get(url, {rejectUnauthorized: false}, fileClose.bind({name: name + appendix, url: url}))
                    .on('error', (err) => console.log("Bad response reading " + url + " " + err))
                }, 200)

            }
        }
    })
    
})
http.get(`https://api.steampowered.com/IEconDOTA2_570/GetGameItems/v1/?key=${secrets.steamKey}`, (response) => {
    if (response.statusCode != 200) {
        console.log(`Error attempting to read items json with code ${response.statusCode}: ${response.statusMessage}`)
        return
    }

    response.setEncoding("utf8")

    let str = ""
    response.on("data", (chunk) => {
        str += chunk
    })

    response.on("end", () => {
        const base = "https://cdn.dota2.com/apps/dota2/images/items/"
        const items = JSON.parse(str).result

        for (const item of items.items) {
            const url = item.name.replace("item_", base) + "_lg.png"
            
            setTimeout(() => {
                console.log("Fetching: " + url)
                const request = http.get(url, {rejectUnauthorized: false}, fileClose.bind({name: item.name + "_lg.png", url: url}))
                .on('error', (err) => console.log("Bad response reading " + url + " " + err))
            }, 200)

        }
    })    
})
