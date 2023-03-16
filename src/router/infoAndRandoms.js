
import { Router } from 'express'
import { fork } from 'child_process'
import * as os from 'os'

const infoAndRandoms = new Router()

infoAndRandoms.get('/info', (req, res) => {
    const processInfo = {
        args: process.argv,
        platform: process.platform,
        version: process.version,
        projectFolder: process.cwd(),
        projectPath: process.execPath,
        processId: process.pid,
        memUsage: process.memoryUsage().rss,
        CPUsQty: os.cpus().length
    }
    if (process.env.INFOCONSOLE == 'ON') { console.log(processInfo) }
    res.render('info', { processInfo })
})

infoAndRandoms.get('/randoms', (req, res) => {
    const randomNumbersFork = fork('./utils/randomNumbers.js')
    const numbersQty = req.query.cant || 500000
    randomNumbersFork.send(numbersQty)
    randomNumbersFork.on('message', (randomNumbersGenerated) => {
        res.render('random', { randomNumbersGenerated })
    })
})

export default infoAndRandoms