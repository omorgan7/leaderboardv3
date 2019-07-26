const fs = require('fs')
const http = require('http');

let heroes = JSON.parse(fs.readFileSync("heroes.json", "utf8"))
let items = JSON.parse(fs.readFileSync("items.json", "utf8"))

function fileClose(response) {
    if (response.statusCode != 200) {
        console.log(`Error attempting to read ${this.url} with code ${response.statusCode}: ${response.statusMessage}`)
        file.close()
        fs.unlink(path, (err) => {if (err) console.log(err)})
        return
    }
    const file = fs.createWriteStream("dota_assets/" + this.name + ".png")
    response.pipe(file)
    file.on('finish', () => {
        file.close()
    }).on('error', (err) => {
        fs.unlink(path, (err) => {if (err) console.log(err)})
        console.log(err)
    })
}

for (const item of items.items) {
    const request = http.get(item.url_image, fileClose.bind({name: item.name, url: item.url_image}))
}

for (const hero of heroes.heroes) {
    const base = "http://cdn.dota2.com/apps/dota2/images/heroes/"
    const name = hero.name.replace("npc_dota_hero_", "")

    const appendices = ["_full.png", "_sb.png", "_lg.png", "_vert.jpg"]

    for (const appendix of appendices) {
        const url = base + name + appendix
        const request = http.get(url, fileClose.bind({name: name + appendix, url: url}))
    }
}