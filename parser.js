'use strict'

const spawn = require("child_process")
const fs = require("fs")

function fileFromStdOut(stdout) {
    // the file name should be the first line in stdout.
    let fileName = stdout.split("\n")[0]

    // validate stdout
    const matched = /^[\d]+\.json$/.exec(fileName)
    if (matched == null) {
        console.log("Invalid output from stdout from parser", fileName)
        return null
    }

    return fileName
}

exports.parseReplay = function(fileName, callback) {
const javaParser = spawn.exec("java -jar /Users/Owen/Documents/Code/Java/clarity-examples/target/mjollnir.one-jar.jar " + fileName, (err, stdout, stderr) => {
        if (err && err.code != 0) {
            callback(err)
            return
        }

        const tempName = fileFromStdOut(stdout)    
        const fileName = "replays/" + tempName

        fs.rename(tempName, fileName, (err) => {
            if (err) return callback(err)

            fs.readFile(fileName, "utf8", (err, data) => {
                if (err) return callback(err)
        
                const matchData = JSON.parse(data)
                callback(null, matchData)
            })
        })    
    })
}